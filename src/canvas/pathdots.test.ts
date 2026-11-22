// Path dots (Joseph 2026-11-22): the found path is dots marching Arrow -> Duck;
// reduced motion: static dots that grow toward the Duck; the march is throttled
// and stops when the path is cleared, a new run starts, or the tab is hidden.
import { CellAnim } from './cellAnim';
import { LegacyMirror } from './mirror';
import { Board } from '../model/board';
import { PALETTES } from './palette';
import { PATH_DOT, drawMarch, frameHint, marchBox, pathDots, render, rmDotScale, type MarchItem, type Scene } from './render';

const arrow = { x: 10, y: 10 }, duck = { x: 110, y: 10 };

test('dots run from the Arrow to the Duck: the first dot is nearest the Arrow, arc position strictly increasing', () => {
	const dots = pathDots([arrow, { x: 60, y: 10 }, duck], 10, 0);
	expect(dots).toHaveLength(11);
	expect(dots[0]).toMatchObject({ x: 10, y: 10, u: 0 });
	expect(dots.at(-1)).toMatchObject({ x: 110, y: 10 });
	for (let i = 1; i < dots.length; i++) {
		expect(dots[i].u).toBeGreaterThan(dots[i - 1].u);
		expect(Math.hypot(dots[i].x - arrow.x, dots[i].y - arrow.y)).toBeGreaterThan(Math.hypot(dots[i - 1].x - arrow.x, dots[i - 1].y - arrow.y));
	}
});

test('the march moves every dot toward the Duck as the phase grows, and the trace-in lays them in order', () => {
	const a = pathDots([arrow, duck], 10, 2), b = pathDots([arrow, duck], 10, 5);
	expect(b[0].x - a[0].x).toBeCloseTo(3); // same dot, 3 px further along
	expect(pathDots([arrow, duck], 10, 0, 35).map((d) => d.x)).toEqual([10, 20, 30, 40]); // only the first 35 px are laid
	expect(pathDots([arrow, duck], 10, 12)[0].u).toBeCloseTo(2); // phase wraps by the spacing
});

test('teleporter jumps: the arc continues on the far pad, still in order', () => {
	const dots = pathDots([arrow, { x: 30, y: 10 }, null, { x: 200, y: 50 }, { x: 220, y: 50 }], 10, 0);
	expect(dots.map((d) => d.x)).toEqual([10, 20, 30, 210, 220]);
});

test('reduced motion: the dot size ramps up from the Arrow to the Duck', () => {
	expect(rmDotScale(0, 100)).toBeCloseTo(PATH_DOT.rmFrom);
	expect(rmDotScale(100, 100)).toBeCloseTo(PATH_DOT.rmTo);
	for (let u = 10; u <= 100; u += 10) expect(rmDotScale(u, 100)).toBeGreaterThan(rmDotScale(u - 10, 100));
	expect(PATH_DOT.rmTo / PATH_DOT.rmFrom).toBeGreaterThan(2); // the ramp is easy to see
});

// a recording context: path-colour fills and the arc radii inside them
function recorder() {
	const fills: { fill: string; radii: number[] }[] = [];
	let radii: number[] = [];
	const state: Record<string, unknown> = { fillStyle: '#000' };
	const ctx = new Proxy(state, {
		get(t, k: string) {
			if (k in t) return t[k];
			if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
			if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
			if (k === 'getLineDash') return () => [];
			if (k === 'createPattern') return () => ({ setTransform() {} });
			if (k === 'beginPath') return () => void (radii = []);
			if (k === 'arc') return (_x: number, _y: number, r: number) => void radii.push(r);
			if (k === 'fill') return () => void fills.push({ fill: String(t.fillStyle), radii });
			return () => {};
		},
		set(t, k: string, v) { t[k] = v; return true; },
	}) as unknown as CanvasRenderingContext2D;
	return { ctx, fills };
}
const p = PALETTES['paper-light'];
const path = Array.from({ length: 30 }, (_, i) => ({ r: 10, c: 5 + i }));
const scene = (over: Partial<Scene> = {}): Scene => ({
	view: { panX: 0, panY: 0, zoom: 1 }, width: 1280, height: 800, dpr: 1, palette: p, board: new Board(), mirror: new LegacyMirror(),
	trace: null, anim: new CellAnim(), speed: 'fast', learnCurrent: false, hover: null, bestPath: path, now: 1e7, activeAt: 0, reducedMotion: false, ...over,
});
const dotFill = (fills: { fill: string; radii: number[] }[]) => fills.filter((f) => f.fill === p.path && f.radii.length > 10).at(-1);

test('reduced motion: render draws the dots once, growing toward the Duck, and asks for no frames', () => {
	const { ctx, fills } = recorder();
	expect(render(ctx, scene({ reducedMotion: true, now: 2e7 }))).toBe(false);
	const r = dotFill(fills)!.radii;
	expect(r.length).toBeGreaterThan(40);
	expect(r.at(-1)! / r[0]).toBeGreaterThan(2);
	for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
});

test('the march keeps asking for frames at ~30 fps while the path shows, and stops when hidden, cleared, or a new run starts', () => {
	const base = scene({ now: 3e7 });
	render(recorder().ctx, base); // schedules the trace-in at 3e7
	const later = { ...base, now: 3e7 + 10_000 }; // long after the trace and the duck hop
	expect(render(recorder().ctx, later)).toBe(true);
	expect(frameHint.minGap).toBe(PATH_DOT.frameMs);
	// the dots move between frames
	const a = recorder(), b = recorder();
	render(a.ctx, later);
	render(b.ctx, { ...later, now: later.now + 100 });
	expect(dotFill(a.fills)).toBeTruthy();
	// hidden tab: no frames
	expect(render(recorder().ctx, { ...later, hidden: true })).toBe(false);
	expect(frameHint.minGap).toBe(0);
	// path cleared (reset / new run clears it): no frames, no dots
	const c = recorder();
	expect(render(c.ctx, { ...later, bestPath: null })).toBe(false);
	expect(dotFill(c.fills)).toBeUndefined();
	expect(frameHint.minGap).toBe(0);
});

test('a new run (trace still searching, the old path cleared) draws no dots and asks for no march frames', () => {
	const searching = { done: false, paths: [], visited: new Map(), frontier: new Map(), current: null, trace: { result: { found: false, paths: [] } } } as unknown as Scene['trace'];
	const c = recorder();
	render(c.ctx, scene({ trace: searching, bestPath: null, now: 4e7 }));
	expect(dotFill(c.fills)).toBeUndefined();
	expect(frameHint.minGap).toBe(0);
});

test('overlay: with scene.march the main canvas leaves the marching dots to a small layer that redraws only them, off the Arrow and Duck', () => {
	const base = scene({ now: 5e7 });
	render(recorder().ctx, base);
	const march: MarchItem[] = [];
	const main = recorder();
	expect(render(main.ctx, { ...base, now: 5e7 + 10_000, march })).toBe(true);
	expect(dotFill(main.fills)).toBeUndefined();
	expect(march.length).toBe(1);
	const box = marchBox(march, 1280, 800)!;
	expect(box.w).toBeLessThan(1280);
	expect(box.h).toBeLessThan(200);
	const o = recorder(), o2 = recorder();
	drawMarch(o.ctx, march, 5e7 + 10_000, box, 1);
	drawMarch(o2.ctx, march, 5e7 + 10_100, box, 1);
	const d = dotFill(o.fills)!;
	expect(d.radii.length).toBeGreaterThan(20);
	expect(o.fills.filter((f) => f.fill === p.path)).toHaveLength(1); // one batched dot fill per frame
	expect(dotFill(o2.fills)).toBeTruthy();
});
