// Checkpoints are numbered in visit order once a run plans the order: a round ink
// badge per checkpoint, above the path; no cost label on the sheet.
import { CellAnim } from './cellAnim';
import { render, type Scene } from './render';
import { PALETTES } from './palette';
import { Board } from '../model/board';
import { LegacyMirror } from './mirror';
import { TraceState } from '../learn/player';
import { runSearch } from '../engine/search';
import { buildSnapshot } from '../shell/snapshot';

function texts(scene: Scene) {
	const out: string[] = [];
	const state: Record<string, unknown> = { fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1 };
	const ctx = new Proxy(state, {
		get(t, k: string) {
			if (k in t) return t[k];
			if (k === 'fillText') return (s: string) => void out.push(String(s));
			if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
			if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
			if (k === 'getLineDash') return () => [];
			if (k === 'createPattern') return () => ({ setTransform() {} });
			return () => {};
		},
		set(t, k: string, v) { t[k] = v; return true; },
	}) as unknown as CanvasRenderingContext2D;
	render(ctx, scene);
	return out;
}

describe.each(Object.keys(PALETTES) as (keyof typeof PALETTES)[])('%s', (name) => {
	test.each([2, 0.75])('zoom %s: badges 1..3 in visit order after a run, none before', (zoom) => {
		const board = new Board();
		// reading order (5,40), (10,20), (25,30); the shortest order from the Arrow (17,15) is different
		board.set(5, 40, { kind: 'weight', cost: 5 });
		board.set(10, 20, { kind: 'weight', cost: 10 });
		board.set(25, 30, { kind: 'weight', cost: 2 });
		const mirror = new LegacyMirror();
		const scene: Scene = {
			view: { panX: 0, panY: 0, zoom }, width: 4000, height: 2000, dpr: 1, palette: PALETTES[name], board, mirror,
			trace: null, anim: new CellAnim(), speed: 'fast' as const, learnCurrent: false, hover: null, bestPath: null, now: 1e9, activeAt: 0, reducedMotion: true,
		};
		expect(texts(scene).filter((t) => /^\d+$/.test(t))).toEqual([]); // no cost labels, no numbers yet
		const snap = { ...buildSnapshot(board, { kind: new Uint8Array(0), start: -1, end: -1 } as never), start: { r: 17, c: 15 }, goals: [{ r: 17, c: 64 }] };
		const trace = runSearch('astar', snap);
		const st = new TraceState(trace);
		st.seek(trace.events.length);
		const order = trace.result.checkpoints!.order;
		expect(order).toEqual(['10-20', '25-30', '5-40']);
		const nums = texts({ ...scene, trace: st }).filter((t) => /^\d+$/.test(t));
		expect(nums).toEqual(['1', '2', '3']);
	});
});

// Prism gate on f59d622: 9 px digit floor (3), a board-coloured ring of max(1.5, .15 r) (4),
// and hollow ink badges for checkpoints that were never reached (2).
import { badgeRadius, badgeRing } from './render';
import { luminance } from './palette';
import { keyOf } from '../model/cell';
const contrast = (a: string, b: string) => {
	const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
};
type Op = { op: string; args: unknown[]; fill: string; stroke: string; width: number; font: string };
function ops(scene: Scene) {
	const out: Op[] = [];
	const state: Record<string, unknown> = { fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1, font: '' };
	const stack: Record<string, unknown>[] = [];
	const ctx = new Proxy(state, {
		get(t, k: string) {
			if (k === 'save') return () => void stack.push({ ...t });
			if (k === 'restore') return () => void Object.assign(t, stack.pop());
			if (k in t) return t[k];
			if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
			if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
			if (k === 'getLineDash') return () => [];
			if (k === 'createPattern') return () => ({ setTransform() {} });
			return (...args: unknown[]) => void out.push({ op: k, args, fill: String(t.fillStyle), stroke: String(t.strokeStyle), width: Number(t.lineWidth), font: String(t.font) });
		},
		set(t, k: string, v) { t[k] = v; return true; },
	}) as unknown as CanvasRenderingContext2D;
	render(ctx, scene);
	return out;
}
/** Each badge: the fill, ring and digit ops that follow its roundRect. */
function badges(o: Op[]) {
	const res: { fill: string; ring: string; width: number; digit: string; color: string; px: number }[] = [];
	o.forEach((x, i) => {
		if (x.op !== 'fillText' || !/^\d+$/.test(String(x.args[0]))) return;
		const fill = o.slice(0, i).reverse().find((y) => y.op === 'fill')!;
		const ring = o.slice(0, i).reverse().find((y) => y.op === 'stroke')!;
		res.push({ fill: fill.fill, ring: ring.stroke, width: ring.width, digit: String(x.args[0]), color: x.fill, px: parseInt(x.font.split(' ')[1], 10) });
	});
	return res;
}

describe.each(Object.keys(PALETTES) as (keyof typeof PALETTES)[])('%s badges (Prism f59d622)', (name) => {
	const p = PALETTES[name];
	test.each([0.23, 0.56, 2])('zoom %s: 9 px digit floor, ring max(1.5, .15 r); a walled-off checkpoint is hollow ink', (zoom) => {
		const board = new Board();
		board.set(10, 20, { kind: 'weight', cost: 5 });
		board.set(25, 30, { kind: 'weight', cost: 5 });
		board.set(5, 40, { kind: 'weight', cost: 5 });
		for (const [r, c] of [[4, 40], [6, 40], [5, 39], [5, 41]]) board.set(r, c, { kind: 'wall' });
		const scene: Scene = {
			view: { panX: 0, panY: 0, zoom }, width: 4000, height: 2000, dpr: 1, palette: p, board, mirror: new LegacyMirror(),
			trace: null, anim: new CellAnim(), speed: 'fast' as const, learnCurrent: false, hover: null, bestPath: null, now: 1e9, activeAt: 0, reducedMotion: true,
		};
		const walls = [[4, 40], [6, 40], [5, 39], [5, 41]].map(([r, c]) => keyOf(r, c)); // the board's walls (no table here)
		const snap = { ...buildSnapshot(board, { kind: new Uint8Array(0), start: -1, end: -1 } as never), walls, start: { r: 17, c: 15 }, goals: [{ r: 17, c: 64 }] };
		const trace = runSearch('astar', snap);
		expect(trace.result.checkpoints).toMatchObject({ order: ['10-20', '25-30', '5-40'], reached: 2 });
		const st = new TraceState(trace);
		st.seek(trace.events.length);
		const s = 20 * zoom;
		const r = badgeRadius(s);
		expect(r).toBe(Math.max(7.5, Math.min(14, 0.36 * s)));
		const b = badges(ops({ ...scene, trace: st }));
		expect(b.map((x) => x.digit)).toEqual(['1', '2', '3']);
		for (const x of b) {
			expect(x.px).toBeGreaterThanOrEqual(9);
			expect(x.width).toBe(Math.max(1.5, 0.15 * r));
			expect(x.width).toBe(badgeRing(r));
		}
		// reached: ink badge, board-coloured ring and digit
		expect(b.slice(0, 2).every((x) => x.fill === p.ink && x.ring === p.home && x.color === p.home)).toBe(true);
		// never reached: hollow, ink ring and digit on the board colour, no red
		expect(b[2]).toMatchObject({ fill: p.home, ring: p.ink, color: p.ink });
		expect([b[2].fill, b[2].ring, b[2].color]).not.toContain(p.fail);
	});
	test('contrast: ring vs gold path >= 5.09, digits >= 4.5 on both badge kinds', () => {
		expect(contrast(p.home, p.pathEdge ?? p.path)).toBeGreaterThanOrEqual(5.09);
		expect(contrast(p.home, p.ink)).toBeGreaterThanOrEqual(4.5);
	});
});
