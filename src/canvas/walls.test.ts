// Prism P1: wall masks, corner rule, chunk cache; minimal flat walls (2026-11-22).
import { N, E, S, W, WallCache, cornerRadii, drawWalls, wallLook, wallMask } from './walls';
import { PALETTES } from './palette';

const set = (...ids: [number, number][]) => {
	const k = new Set(ids.map(([r, c]) => `${r},${c}`));
	return (r: number, c: number) => k.has(`${r},${c}`);
};

test('4-neighbour mask: N=1 E=2 S=4 W=8', () => {
	const isWall = set([5, 5], [4, 5], [5, 6], [6, 5], [5, 4]);
	expect(wallMask(isWall, 5, 5)).toBe(N | E | S | W);
	expect(wallMask(isWall, 4, 5)).toBe(S);
	expect(wallMask(isWall, 5, 6)).toBe(W);
});

test('outer corners round only where both orthogonal sides are open', () => {
	expect(cornerRadii(0, 4)).toEqual([4, 4, 4, 4]);
	expect(cornerRadii(E, 4)).toEqual([4, 0, 0, 4]);
	expect(cornerRadii(N | S, 4)).toEqual([0, 0, 0, 0]);
});

// a no-op 2D context that counts calls
const fakeCtx = () => {
	const calls: Record<string, number> = {};
	return new Proxy({ calls } as Record<string, unknown>, {
		get(t, k: string) {
			if (k in t) return t[k];
			return (..._a: unknown[]) => void (calls[k] = (calls[k] ?? 0) + 1);
		},
		set(t, k: string, v) {
			t[k] = v;
			return true;
		},
	}) as unknown as CanvasRenderingContext2D & { calls: Record<string, number> };
};
(globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = class {
	constructor(public width: number, public height: number) {}
	getContext() {
		return fakeCtx();
	}
};

const view = { zoom: 1, panX: 0, panY: 0 };
const vb = { r0: 0, c0: 0, r1: 34, c1: 79 };

test('chunks are baked once and reused until their walls change', () => {
	const cache = new WallCache();
	const walls = new Set(['3,3', '3,4', '20,40']);
	const src = { isWall: (r: number, c: number) => walls.has(`${r},${c}`) };
	const ctx = fakeCtx();
	drawWalls(ctx, src, view, vb, PALETTES['paper-light'], 1, cache);
	expect(cache.baked).toBe(2); // two chunks hold walls
	drawWalls(ctx, src, view, vb, PALETTES['paper-light'], 1, cache);
	expect(cache.baked).toBe(2); // pure blits
	walls.add('3,5');
	drawWalls(ctx, src, view, vb, PALETTES['paper-light'], 1, cache);
	expect(cache.baked).toBe(3); // only the dirty chunk
});

test('minimal: walls land at once (no flutter or peel), so drawing them never asks for another frame', () => {
	const cache = new WallCache();
	const src = { isWall: (r: number, c: number) => r === 3 && c === 3 };
	expect(drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-dark'], 1, cache)).toBeUndefined();
	expect(cache.baked).toBe(1);
});

test('minimal walls at 25 / 50 / 100 / 200 / 400 %: one flat ply, no deckle, radius 0.10 s, a small cast from 100 %', () => {
	for (const P of [PALETTES['paper-light'], PALETTES['paper-dark'], PALETTES['classic-dark']]) {
		const r = (s: number) => {
			const L = wallLook(s, P);
			const f = (n: number) => Math.round(n * 10) / 10;
			return { under: L.under, ambient: L.ambient, cast: L.cast ? [f(L.cast.dx), f(L.cast.dy), f(L.cast.blur)] : null, deckle: L.jitter, radius: f(L.radius) };
		};
		expect(r(5)).toEqual({ under: null, ambient: null, cast: null, deckle: 0, radius: 0 });
		expect(r(10)).toEqual({ under: null, ambient: null, cast: [0, 1, 0], deckle: 0, radius: 1 });
		expect(r(20)).toMatchObject({ under: null, ambient: null, deckle: 0, radius: 2 });
		expect(r(40)).toMatchObject({ under: null, ambient: null, deckle: 0, radius: 4 });
		expect(r(80).cast).not.toBeNull();
	}
});

test('a wall crossing a chunk border is cut as one piece: each chunk sees its neighbour cells (halo), so a change there re-bakes both', () => {
	const cache = new WallCache();
	const walls = new Set(['3,14', '3,15']); // chunk (0,0) only
	const src = { isWall: (r: number, c: number) => walls.has(`${r},${c}`) };
	drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-light'], 1, cache);
	expect(cache.baked).toBe(1);
	walls.add('3,16'); // first cell of chunk (0,1), touching 3,15
	drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-light'], 1, cache);
	expect(cache.baked).toBe(3); // the new chunk, and chunk (0,0) whose edge is no longer a cut
	walls.add('20,40'); // far away: nothing else re-bakes
	drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-light'], 1, cache);
	expect(cache.baked).toBe(4);
});
