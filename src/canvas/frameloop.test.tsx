// Prism review (paper v2.1) must-fix 1: an idle board costs no frames. The duck
// bob runs 3 cycles (3 x 2400 ms) after the last change, then the rAF loop stops
// until something marks the canvas dirty again.
import { render as mount, fireEvent, act } from '@testing-library/react';
// @ts-expect-error legacy JS module
import { TableContextProvider } from '../Context/TableContext';
import AppShell from '../shell/AppShell';
import { render, type Scene } from './render';
import { PALETTES } from './palette';
import { Board } from '../model/board';
import { LegacyMirror } from './mirror';

const noopCtx = () =>
	new Proxy({} as Record<string | symbol, unknown>, {
		get(t, k) {
			if (k in t) return t[k];
			if (k === 'canvas') return { width: 1280, height: 800 };
			if (k === 'measureText') return (s: string) => ({ width: String(s).length * 6 });
			if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
			if (k === 'createPattern') return () => ({ setTransform() {} });
			if (k === 'getLineDash') return () => [];
			if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
			return () => {};
		},
		set(t, k, v) {
			t[k] = v;
			return true;
		},
	});

test('render(): the bob keeps animating for 3 cycles after the last change, then reports idle', () => {
	const board = new Board();
	const scene = (age: number, reducedMotion = false): Scene => ({
		view: { panX: 0, panY: 0, zoom: 1 }, width: 1280, height: 800, dpr: 1, palette: PALETTES['paper-light'], board, mirror: new LegacyMirror(),
		trace: null, traceTimes: new Map(), learnCurrent: false, hover: null, bestPath: null, now: 1e6 + age, activeAt: 1e6, reducedMotion,
	});
	const m = new LegacyMirror();
	m.end = 17 * 80 + 64; // a duck on the board
	const withDuck = (age: number, rm = false) => ({ ...scene(age, rm), mirror: m });
	const ctx = noopCtx() as unknown as CanvasRenderingContext2D;
	expect(render(ctx, withDuck(0))).toBe(true); // the first frame after a change (sin 0 = 0) still keeps going
	expect(render(ctx, withDuck(3 * 2400 - 10))).toBe(true);
	expect(render(ctx, withDuck(3 * 2400 + 10))).toBe(false);
	expect(render(ctx, withDuck(0, true))).toBe(false); // reduced motion: no bob at all
});

test('the frame loop goes idle (no rAF pending) after the bob ends, and wakes on input', () => {
	let clock = 1000;
	const queue = new Map<number, FrameRequestCallback>();
	let id = 0;
	const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => (queue.set(++id, cb), id));
	const cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((h) => void queue.delete(h));
	const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
	const ctxSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => noopCtx()) as never);
	try {
		mount(
			<TableContextProvider>
				<AppShell />
			</TableContextProvider>,
		);
		// run frames at 60 fps; returns how many frames ran before the queue emptied
		const pump = (maxMs: number) => {
			let frames = 0;
			for (let t = 0; t < maxMs && queue.size; t += 16) {
				clock += 16;
				const cbs = [...queue.values()];
				queue.clear();
				act(() => cbs.forEach((cb) => cb(clock)));
				frames++;
			}
			return frames;
		};
		const first = pump(20000);
		expect(queue.size).toBe(0); // idle: nothing scheduled
		expect(first * 16).toBeGreaterThanOrEqual(3 * 2400 - 50); // it did bob ~7.2 s
		expect(first * 16).toBeLessThan(3 * 2400 + 1000);
		clock += 60000; // a minute of idle: still nothing
		expect(queue.size).toBe(0);
		const canvas = document.querySelector('canvas')!;
		act(() => void fireEvent.pointerMove(canvas, { clientX: 200, clientY: 200, pointerId: 1, pointerType: 'mouse' }));
		expect(queue.size).toBeGreaterThan(0); // input wakes the loop
		pump(20000);
		expect(queue.size).toBe(0); // and it sleeps again
	} finally {
		rafSpy.mockRestore();
		cafSpy.mockRestore();
		nowSpy.mockRestore();
		ctxSpy.mockRestore();
	}
});
