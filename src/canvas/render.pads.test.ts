// Mochi check 3: pad letters stay readable when a path crosses the pad.
import { CellAnim } from './cellAnim';
import { padLetterGeometry, padRing, render, type Scene } from './render';
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
			if (k === 'createPattern') return () => ({ setTransform() {} });
			return (...a: unknown[]) => calls.push({ op: k, text: k === 'fillText' ? String(a[0]) : undefined, fill: String(t.fillStyle), stroke: String(t.strokeStyle) });
		},
		set(t, k: string, v) { t[k] = v; return true; },
	}) as unknown as CanvasRenderingContext2D;
	return { ctx, calls };
}

test('pad letters (A, A′, lone C) draw after the path line, white in the punched hole from 200 % (§4.4)', () => {
	const p = PALETTES['paper-light'];
	const board = new Board();
	board.set(10, 10, { kind: 'pad', pair: 0 });
	board.set(10, 20, { kind: 'pad', pair: 0 });
	board.set(15, 5, { kind: 'pad', pair: 2 });
	const scene: Scene = {
		view: { panX: 0, panY: 0, zoom: 2 }, width: 2000, height: 1000, dpr: 1, palette: p, board,
		mirror: new LegacyMirror(), trace: null, anim: new CellAnim(), speed: 'fast' as const, learnCurrent: false, hover: null,
		bestPath: [{ r: 10, c: 8 }, { r: 10, c: 9 }, { r: 10, c: 10 }, { r: 10, c: 20 }, { r: 10, c: 21 }],
		now: 1e9, activeAt: 0, reducedMotion: true,
	};
	const { ctx, calls } = recorder();
	render(ctx, scene);
	const texts = calls.filter((c) => c.op === 'fillText');
	const at = (t: string) => calls.findIndex((c) => c.op === 'fillText' && c.text === t);
	expect(texts.map((c) => c.text)).toEqual(expect.arrayContaining(['A', 'A′', 'C']));
	const firstLetter = Math.min(at('A'), at('A′'), at('C'));
	const pathStrokes = calls.flatMap((c, i) => ((c.op === 'stroke' && c.stroke === p.path) || (c.op === 'fill' && c.fill === p.path) ? [i] : [])); // path dots are one fill
	expect(pathStrokes.length).toBeGreaterThan(0);
	expect(Math.max(...pathStrokes)).toBeLessThan(firstLetter);
	expect(texts.find((c) => c.text === 'A')!.fill).toBe('#ffffff');
	expect(texts.find((c) => c.text === 'C')!.fill).toBe('#ffffff');
});

test('Prism gate: at 35 % on phones pads keep a 5 px ring and a letter tag outside the ring', () => {
	const s = 20 * 0.35;
	expect(padRing(s).ro).toBeGreaterThanOrEqual(5);
	const g = padLetterGeometry(100, 100, s);
	expect(g.inHole).toBe(false);
	expect(g.r * 2).toBeGreaterThanOrEqual(13); // 9 px letter on a 13 px tag
	expect(Math.hypot(g.x - 100, g.y - 100)).toBeGreaterThan(padRing(s).ri);
	expect(padLetterGeometry(100, 100, 40).inHole).toBe(true);
});
