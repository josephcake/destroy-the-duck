// Prism search-motion spec §6/§7 and one-way spec §3/§6: the render budget in
// draw calls, and the idle rule (no frames once nothing moves).
import { render, type Scene } from './render';
import { PALETTES } from './palette';
import { Board, Dir } from '../model/board';
import { LegacyMirror } from './mirror';
import { CellAnim, MOTION, St } from './cellAnim';
import { BOARD_COLS, BOARD_ROWS } from '../model/bounds';

function recorder() {
	let strokes = 0, fills = 0;
	const state: Record<string, unknown> = {};
	const ctx = new Proxy(state, {
		get(t, k: string) {
			if (k in t) return t[k];
			if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
			if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
			if (k === 'getLineDash') return () => [];
			if (k === 'createPattern') return () => ({ setTransform() {} });
			if (k === 'stroke') return () => void strokes++;
			if (k === 'fill') return () => void fills++;
			return () => {};
		},
		set(t, k: string, v) {
			t[k] = v;
			return true;
		},
	}) as unknown as CanvasRenderingContext2D;
	return { ctx, count: () => ({ strokes, fills }) };
}
const T0 = 1e6;
const scene = (over: Partial<Scene> = {}): Scene => ({
	view: { panX: 0, panY: 0, zoom: 0.8 }, width: 1280, height: 800, dpr: 2, palette: PALETTES['paper-light'], board: new Board(), mirror: new LegacyMirror(),
	trace: null, anim: new CellAnim(), speed: 'fast', learnCurrent: false, hover: null, bestPath: null, now: T0, activeAt: 0, reducedMotion: false, ...over,
});
const fakeTrace = { done: false, paths: [], visited: new Map(), frontier: new Map(), current: null, trace: { result: { found: false, paths: [] } } } as unknown as Scene['trace'];
const strokesOf = (s: Scene) => {
	const r = recorder();
	const animating = render(r.ctx, s);
	const c = r.count();
	return { ...c, draws: c.strokes + c.fills, animating }; // visited cells are fills now (no dashes)
};

test('every cell live (half entering, half settling) costs at most 16 draws, and the run idles once settled', () => {
	const anim = new CellAnim();
	anim.reset(T0);
	const N = BOARD_ROWS * BOARD_COLS;
	for (let i = 0; i < N; i++) anim.frontierAt(i, 0, i % 50);
	for (let i = 0; i < N; i += 2) anim.visitAt(i, 50);
	const base = strokesOf(scene({ trace: fakeTrace, anim: new CellAnim() })).draws;
	const mid = strokesOf(scene({ trace: fakeTrace, anim, now: T0 + 100 }));
	expect(anim.liveCount).toBeGreaterThan(1000);
	expect(mid.draws - base).toBeLessThanOrEqual(16 + 1); // + the frontier-hold stroke
	expect(mid.animating).toBe(true);
	// all settled: the layer draws in 2 fills, nothing is live, the frame loop may sleep
	for (let i = 1; i < N; i += 2) anim.visitAt(i, 60);
	const done = strokesOf(scene({ trace: { ...fakeTrace!, done: true } as Scene['trace'], anim, now: T0 + 60 + MOTION.fast.settle + 1 }));
	expect(anim.liveCount).toBe(0);
	expect(anim.settledCount).toBe(N);
	expect(done.draws - base).toBeLessThanOrEqual(2);
	expect(done.animating).toBe(false);
});

test('Prism gate ruling 1: half the board settled, half live, still costs at most 16 live + 1 frontier + 2 settled draws', () => {
	const anim = new CellAnim();
	anim.reset(T0);
	const N = BOARD_ROWS * BOARD_COLS;
	for (let i = 0; i < N; i++) anim.frontierAt(i, 0, i % 50);
	for (let i = 0; i < N / 2; i++) anim.visitAt(i, 0); // settled by T0 + settle
	for (let i = N / 2; i < N; i += 2) anim.visitAt(i, MOTION.fast.settle); // settling now
	const base = strokesOf(scene({ trace: fakeTrace, anim: new CellAnim() })).draws;
	const mixed = strokesOf(scene({ trace: fakeTrace, anim, now: T0 + MOTION.fast.settle + 100 }));
	expect(anim.settledCount).toBeGreaterThan(1000);
	expect(anim.liveCount).toBeGreaterThan(500);
	expect(mixed.draws - base).toBeLessThanOrEqual(16 + 1 + 2);
});

test('reduced motion: cells land in their final state at once (no live strokes, no frames)', () => {
	const anim = new CellAnim();
	anim.reset(T0);
	for (let i = 0; i < 500; i++) anim.frontierAt(i, 0, NaN);
	for (let i = 0; i < 250; i++) anim.visitAt(i, 0);
	const r = strokesOf(scene({ trace: { ...fakeTrace!, done: true } as Scene['trace'], anim, now: T0 + 10, reducedMotion: true }));
	expect(anim.liveCount).toBe(0);
	expect(anim.state[0]).toBe(St.Done);
	expect(anim.state[400]).toBe(St.Hold);
	expect(r.animating).toBe(false);
});

test('scrubbing more than 200 steps lands cells settled (phase D) with no animation', () => {
	const anim = new CellAnim();
	anim.reset(T0);
	for (let i = 0; i < 300; i++) anim.visitAt(i, 5, true);
	expect(anim.liveCount).toBe(0);
	expect(anim.settledCount).toBe(300);
});

test('lanes: at most 8 chevron strokes however many lanes; drifting only while the tool is active, idle when none are in view', () => {
	const board = new Board();
	for (let c = 0; c < 80; c++) for (const [r, d] of [[3, 1], [5, 3], [7, 0], [9, 2]] as [number, Dir][]) board.set(r, c, { kind: 'oneway', dir: d });
	const base = strokesOf(scene({ activeAt: -1e9 })).draws;
	const on = strokesOf(scene({ board, tool: 'oneway', activeAt: -1e9 }));
	expect(on.strokes - base).toBeLessThanOrEqual(8);
	expect(on.animating).toBe(true);
	// out of view: zero cost, nothing to animate
	const far = { panX: 0, panY: -5000, zoom: 0.8 };
	const off = strokesOf(scene({ board, tool: 'oneway', activeAt: -1e9, view: far }));
	expect(off.strokes).toBe(strokesOf(scene({ activeAt: -1e9, view: far })).strokes);
	expect(off.animating).toBe(false);
	// reduced motion: static chevrons, no frames
	expect(strokesOf(scene({ board, tool: 'oneway', activeAt: -1e9, reducedMotion: true })).animating).toBe(false);
});

test('lanes: the drift eases to a stop over 400 ms when nothing calls for it, then the loop idles', () => {
	const board = new Board();
	board.set(4, 4, { kind: 'oneway', dir: 1 });
	const r = recorder();
	const s = scene({ board, tool: 'oneway', activeAt: -1e9 });
	expect(render(r.ctx, s)).toBe(true);
	expect(render(r.ctx, { ...s, tool: 'wall', now: T0 + 16 })).toBe(true); // easing out
	expect(render(r.ctx, { ...s, tool: 'wall', now: T0 + 16 + 401 })).toBe(false);
});
