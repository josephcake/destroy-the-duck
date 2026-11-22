// Prism P1: wall masks, corner rule, chunk cache and pop-in.
import { N, E, S, W, POP_MS, WallCache, cornerRadii, drawWalls, wallMask } from './walls';
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
	const src = { isWall: (r: number, c: number) => walls.has(`${r},${c}`), changedAt: () => 0 };
	const ctx = fakeCtx();
	drawWalls(ctx, src, view, vb, PALETTES['pond-light'], 1, 1000, false, cache);
	expect(cache.baked).toBe(2); // two chunks hold walls
	drawWalls(ctx, src, view, vb, PALETTES['pond-light'], 1, 2000, false, cache);
	expect(cache.baked).toBe(2); // pure blits
	walls.add('3,5');
	drawWalls(ctx, src, view, vb, PALETTES['pond-light'], 1, 3000, false, cache);
	expect(cache.baked).toBe(3); // only the dirty chunk
});

test('a freshly painted wall pops in for 120 ms, then joins the cached union; reduced motion is instant', () => {
	const cache = new WallCache();
	const src = { isWall: (r: number, c: number) => r === 3 && c === 3, changedAt: () => 1000 };
	const ctx = fakeCtx();
	expect(drawWalls(ctx, src, view, vb, PALETTES['pond-dark'], 1, 1000 + POP_MS / 2, false, cache)).toBe(true);
	expect(cache.baked).toBe(0);
	expect(drawWalls(ctx, src, view, vb, PALETTES['pond-dark'], 1, 1000 + POP_MS + 1, false, cache)).toBe(false);
	expect(cache.baked).toBe(1);
	expect(drawWalls(ctx, src, view, vb, PALETTES['pond-dark'], 1, 1000 + POP_MS / 2, true, new WallCache())).toBe(false);
});
