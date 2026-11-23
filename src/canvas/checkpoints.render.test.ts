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
