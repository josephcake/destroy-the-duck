// Prism P1: wall masks, corner rule, chunk cache and pop-in.
import { N, E, S, W, FLUTTER_MS, PEEL_MS, LIVE_MAX, WallCache, cornerRadii, drawWalls, wallLook, wallMask } from './walls';
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
	drawWalls(ctx, src, view, vb, PALETTES['paper-light'], 1, 1000, false, cache);
	expect(cache.baked).toBe(2); // two chunks hold walls
	drawWalls(ctx, src, view, vb, PALETTES['paper-light'], 1, 2000, false, cache);
	expect(cache.baked).toBe(2); // pure blits
	walls.add('3,5');
	drawWalls(ctx, src, view, vb, PALETTES['paper-light'], 1, 3000, false, cache);
	expect(cache.baked).toBe(3); // only the dirty chunk
});

test('§4.1 paint flutter: a fresh wall flutters 220 ms on the live layer, then joins the cached union; reduced motion is instant', () => {
	expect(FLUTTER_MS).toBe(220);
	const cache = new WallCache();
	const src = { isWall: (r: number, c: number) => r === 3 && c === 3, changedAt: () => 1000 };
	const ctx = fakeCtx();
	expect(drawWalls(ctx, src, view, vb, PALETTES['paper-dark'], 1, 1000 + FLUTTER_MS / 2, false, cache)).toBe(true);
	expect(cache.baked).toBe(0);
	expect(drawWalls(ctx, src, view, vb, PALETTES['paper-dark'], 1, 1000 + FLUTTER_MS + 1, false, cache)).toBe(false);
	expect(cache.baked).toBe(1);
	expect(drawWalls(ctx, src, view, vb, PALETTES['paper-dark'], 1, 1000 + FLUTTER_MS / 2, true, new WallCache())).toBe(false);
});

test('§4.1 erase peel-away: an erased wall peels for 160 ms; reduced motion is instant', () => {
	expect(PEEL_MS).toBe(160);
	const src = { isWall: () => false, changedAt: () => 1000, erasedAt: (r: number, c: number) => (r === 3 && c === 3 ? 1000 : 0) };
	expect(drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-light'], 1, 1000 + PEEL_MS / 2, false, new WallCache())).toBe(true);
	expect(drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-light'], 1, 1000 + PEEL_MS + 1, false, new WallCache())).toBe(false);
	expect(drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-light'], 1, 1000 + PEEL_MS / 2, true, new WallCache())).toBe(false);
});

test('§4.1: at most 64 cells animate per frame; the rest land in the cached union at once', () => {
	const cache = new WallCache();
	const src = { isWall: (r: number, c: number) => r < 10 && c < 20, changedAt: () => 1000 }; // 200 fresh walls
	expect(drawWalls(fakeCtx(), src, view, vb, PALETTES['paper-light'], 1, 1050, false, cache)).toBe(true);
	expect(LIVE_MAX).toBe(64);
	expect(cache.baked).toBeGreaterThan(0); // the other 136 were baked
});

test('§4.1 table: ply, shadow, blur and deckle at 25 / 50 / 100 / 200 / 400 %', () => {
	const P = PALETTES['paper-light'];
	const r = (s: number) => {
		const L = wallLook(s, P);
		const f = (n: number | undefined) => (n === undefined ? null : Math.round(n * 10) / 10);
		return { under: L.under ? [f(L.under.dx), f(L.under.dy)] : null, cast: L.cast ? [f(L.cast.dx), f(L.cast.dy), f(L.cast.blur)] : null, deckle: f(L.jitter) };
	};
	expect(r(5)).toEqual({ under: null, cast: null, deckle: 0 });
	expect(r(10)).toEqual({ under: null, cast: [0, 1, 0], deckle: 0 });
	expect(r(20)).toEqual({ under: [1.2, 2.4], cast: [1.8, 4.4, 3.2], deckle: 0.6 });
	expect(r(40)).toEqual({ under: [2.4, 4.8], cast: [3.6, 8.8, 6.4], deckle: 1.2 });
	expect(r(80)).toEqual({ under: [3.6, 7.2], cast: [6, 15.2, 12.8], deckle: 2.4 });
	expect(wallLook(20, P).radius).toBeCloseTo(0.14 * 20);
	// Classic: one ply, no deckle, radius 0.10 s
	const C = wallLook(40, PALETTES['classic-dark']);
	expect([C.under, C.jitter, C.radius, C.topFibre]).toEqual([null, 0, 4, 0]);
});
