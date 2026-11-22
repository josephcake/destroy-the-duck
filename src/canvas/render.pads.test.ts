// Mochi check 3: pad letters stay readable when a path crosses the pad.
import { render, type Scene } from './render';
import { PALETTES } from './palette';
import { Board } from '../model/board';
import { LegacyMirror } from './mirror';

function recorder() {
	const calls: { op: string; text?: string; fill?: string; stroke?: string }[] = [];
	const state: Record<string, unknown> = { fillStyle: '#000' };
	const ctx = new Proxy(state, {
		get(t, k: string) {
			if (k in t) return t[k];
			if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
			if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
			if (k === 'getLineDash') return () => [];
			return (...a: unknown[]) => calls.push({ op: k, text: k === 'fillText' ? String(a[0]) : undefined, fill: String(t.fillStyle), stroke: String(t.strokeStyle) });
		},
		set(t, k: string, v) { t[k] = v; return true; },
	}) as unknown as CanvasRenderingContext2D;
	return { ctx, calls };
}

test('pad letters (A, A′, lone C) draw after the path line, in the pair colour', () => {
	const p = PALETTES['pond-light'];
	const board = new Board();
	board.set(10, 10, { kind: 'pad', pair: 0 });
	board.set(10, 20, { kind: 'pad', pair: 0 });
	board.set(15, 5, { kind: 'pad', pair: 2 });
	const scene: Scene = {
		view: { panX: 0, panY: 0, zoom: 2 }, width: 2000, height: 1000, dpr: 1, palette: p, board,
		mirror: new LegacyMirror(), trace: null, traceTimes: new Map(), learnCurrent: false, hover: null,
		bestPath: [{ r: 10, c: 8 }, { r: 10, c: 9 }, { r: 10, c: 10 }, { r: 10, c: 20 }, { r: 10, c: 21 }],
		now: 1e9, reducedMotion: true,
	};
	const { ctx, calls } = recorder();
	render(ctx, scene);
	const texts = calls.filter((c) => c.op === 'fillText');
	const at = (t: string) => calls.findIndex((c) => c.op === 'fillText' && c.text === t);
	expect(texts.map((c) => c.text)).toEqual(expect.arrayContaining(['A', 'A′', 'C']));
	const firstLetter = Math.min(at('A'), at('A′'), at('C'));
	const pathStrokes = calls.flatMap((c, i) => (c.op === 'stroke' && c.stroke === p.path ? [i] : []));
	expect(pathStrokes.length).toBeGreaterThan(0);
	expect(Math.max(...pathStrokes)).toBeLessThan(firstLetter);
	expect(texts.find((c) => c.text === 'A')!.fill).toBe(p.pads[0]);
	expect(texts.find((c) => c.text === 'C')!.fill).toBe(p.pads[2]);
});
