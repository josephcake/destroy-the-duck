// Joseph: "get rid of all dashes". Prism gate on c1e597d (2026-11-22): the hover
// guide, the lone teleporter ring and the teleport jump arc were the last dashed
// strokes; each is now solid, quieter and thinner than the path and frontier.
import { CellAnim } from './cellAnim';
import { render, type Scene } from './render';
import { PALETTES } from './palette';
import { Board } from '../model/board';
import { LegacyMirror } from './mirror';

type Call = { op: string; args: unknown[]; stroke: string; alpha: number; width: number; cap: string };
function recorder() {
	const calls: Call[] = [];
	const state: Record<string, unknown> = { fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1, lineCap: 'butt' };
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
			return (...args: unknown[]) => void calls.push({ op: k, args, stroke: String(t.strokeStyle), alpha: Number(t.globalAlpha), width: Number(t.lineWidth), cap: String(t.lineCap) });
		},
		set(t, k: string, v) { t[k] = v; return true; },
	}) as unknown as CanvasRenderingContext2D;
	return { ctx, calls };
}

describe.each(Object.keys(PALETTES) as (keyof typeof PALETTES)[])('%s', (name) => {
	test.each([2, 0.35])('zoom %s: hover, lone pad and a teleport jump are all solid, at Prism’s values', (zoom) => {
		const p = PALETTES[name];
		const s = 20 * zoom;
		const board = new Board();
		board.set(10, 10, { kind: 'pad', pair: 0 });
		board.set(10, 20, { kind: 'pad', pair: 0 });
		board.set(15, 5, { kind: 'pad', pair: 1 }); // lone: no partner yet
		const scene: Scene = {
			view: { panX: 0, panY: 0, zoom }, width: 2000, height: 1000, dpr: 1, palette: p, board,
			mirror: new LegacyMirror(), trace: null, anim: new CellAnim(), speed: 'fast' as const, learnCurrent: false, hover: { r: 3, c: 3 },
			bestPath: [{ r: 10, c: 8 }, { r: 10, c: 9 }, { r: 10, c: 10 }, { r: 10, c: 20 }, { r: 10, c: 21 }],
			now: 1e9, activeAt: 0, reducedMotion: true,
		};
		const { ctx, calls } = recorder();
		render(ctx, scene);
		// no dash pattern anywhere in a frame
		expect(calls.filter((c) => c.op === 'setLineDash' && (c.args[0] as number[]).length > 0)).toEqual([]);
		const strokes = calls.filter((c) => c.op === 'stroke');
		// hover pencil guide: ink, .3, 1 px
		expect(strokes.some((c) => c.stroke === p.ink && c.alpha === 0.3 && c.width === 1)).toBe(true);
		// lone ring: pair B colour, .5, max(1, .04 s)
		expect(strokes.some((c) => c.stroke === p.pads[1] && c.alpha === 0.5 && c.width === Math.max(1, 0.04 * s))).toBe(true);
		// jump arc: pair A colour, .55, max(1.25, .05 s), round caps
		expect(strokes.some((c) => c.stroke === p.pads[0] && c.alpha === 0.55 && c.width === Math.max(1.25, 0.05 * s) && c.cap === 'round')).toBe(true);
	});
});
