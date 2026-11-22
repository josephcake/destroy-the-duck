// Walls: Paper v2.1 2-ply card (style.md §4.1), cached per 16x16 chunk.
// - 4-neighbour mask (N=1, E=2, S=4, W=8) and one union path per chunk, built
//   with paper-kit's addCutCell: shared sides overlap, outer corners round only
//   where both orthogonal sides are open, open sides get the seeded inward
//   deckle (hash of r, c: stable across chunk re-bakes).
// - Two cached bitmaps per chunk: "shadow" (cast + ambient + under-ply) and
//   "body" (top ply + top fibre + cut edges). All shadows are blitted before any
//   body, so a neighbour chunk's blur or under-ply never lands on a wall top.
// - The cast shadow is not motion, so it stays under reduced motion.
// - Paint: flutter (220 ms). Erase: peel-away (160 ms). Both on the live layer,
//   at most 64 cells a frame; the rest land instantly. Reduced motion: instant.
import { Bounds, inHome } from '../model/cell';
import { Palette } from './palette';
import { View, cellToScreen } from './view';
import { CellRef, DURATION, Shadow, edgeBand, elevation, fibreTile, flutter, peelAway, unionPath } from '../vendor/paper-kit/paper-kit';

export const WALL_CHUNK = 16;
export const FLUTTER_MS = DURATION.flutter; // 220
export const PEEL_MS = DURATION.peel; // 160
export const LIVE_MAX = 64;
export const N = 1, E = 2, S = 4, W = 8;

export type WallSource = {
	isWall(r: number, c: number): boolean;
	/** ms timestamp of the last change for Home cells (0 when unknown) */
	changedAt(r: number, c: number): number;
	/** ms timestamp when a wall here was erased (0 when it wasn't) */
	erasedAt?(r: number, c: number): number;
};

export function wallMask(isWall: (r: number, c: number) => boolean, r: number, c: number) {
	return (isWall(r - 1, c) ? N : 0) | (isWall(r, c + 1) ? E : 0) | (isWall(r + 1, c) ? S : 0) | (isWall(r, c - 1) ? W : 0);
}

/** Corner radii [tl, tr, br, bl] for a mask: round only where both sides are open. */
export function cornerRadii(mask: number, R: number): [number, number, number, number] {
	const o = (b: number) => (mask & b) === 0;
	return [o(N) && o(W) ? R : 0, o(N) && o(E) ? R : 0, o(S) && o(E) ? R : 0, o(S) && o(W) ? R : 0];
}

/** The §4.1 numbers for a cell size s (CSS px) in palette p. */
export function wallLook(s: number, p: Palette) {
	const e = elevation(s);
	const paper = !p.classic;
	const under = paper && s >= 14 && p.wallUnder ? { fill: p.wallUnder, dx: e.under.dx, dy: e.under.dy } : null;
	const cast: Shadow | null =
		s < 6 ? null // 25%: flat
		: s < 14 ? { color: p.contact, dx: 0, dy: 1, blur: 0 } // 50%: contact only
		: { color: p.shadow, dx: e.cast.dx + (under?.dx ?? 0), dy: e.cast.dy + (under?.dy ?? 0), blur: e.cast.blur };
	return {
		radius: s < 6 ? 0 : p.classic ? 0.1 * s : e.radius,
		jitter: paper ? e.jitter : 0,
		under,
		cast,
		ambient: paper && s >= 10 ? { color: p.contact, ...e.ambient } : null,
		edges: s >= 10,
		topFibre: paper && s >= 14 && p.fibre ? p.fibre.wallTop : 0,
	};
}

type Layer = HTMLCanvasElement | OffscreenCanvas;
type Entry = { sig: number; shadow: Layer | null; body: Layer; pad: number };
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const mkCanvas = (w: number, h: number): Layer | null => {
	if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
	if (typeof document !== 'undefined') {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		return c;
	}
	return null;
};

export class WallCache {
	private entries = new Map<string, Entry>();
	private key = '';
	baked = 0; // chunks (re)baked, for tests and perf checks

	/** Drop everything when zoom, dpr, palette or reduced motion change (§8 re-bake key). */
	private reset(key: string) {
		if (key !== this.key) {
			this.entries.clear();
			this.key = key;
		}
	}
	get(k: string) {
		return this.entries.get(k);
	}
	set(k: string, e: Entry) {
		this.entries.set(k, e);
		if (this.entries.size > 160) this.entries.delete(this.entries.keys().next().value!);
		this.baked++;
	}
	prepare(view: View, dpr: number, p: Palette, reduced: boolean) {
		this.reset(`${view.zoom}|${dpr}|${p.name}|${reduced}`);
	}
}

function withShadow(ctx: Ctx2D, sh: Shadow | null, dpr: number, k: number, draw: () => void) {
	ctx.save();
	if (sh) {
		ctx.shadowColor = sh.color;
		ctx.shadowOffsetX = sh.dx * k * dpr; // shadowBlur/offsets ignore the transform
		ctx.shadowOffsetY = sh.dy * k * dpr;
		ctx.shadowBlur = sh.blur * k * dpr;
	}
	draw();
	ctx.restore();
}
const boundsOf = (cells: CellRef[], s: number, extra: number) => {
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const q of cells) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + s); y1 = Math.max(y1, q.y + s); }
	return { x: x0 - extra, y: y0 - extra, w: x1 - x0 + 2 * extra, h: y1 - y0 + 2 * extra };
};

/**
 * Paint cells (x, y in ctx coordinates) as one union. 'shadow': cast + ambient +
 * under-ply (+ its cut edge). 'body': top ply + top fibre + cut edges.
 * `shadowK` scales the cast (flutter 2x -> 1x, peel 1x -> 1.8x).
 */
export function paintWalls(ctx: Ctx2D, cells: CellRef[], s: number, p: Palette, layer: 'shadow' | 'body', dpr: number, opts: { jitter?: number; shadowK?: number } = {}) {
	if (!cells.length) return;
	const L = wallLook(s, p);
	const jitter = opts.jitter ?? L.jitter;
	const top = unionPath(cells, s, L.radius, jitter, 1);
	const b = boundsOf(cells, s, 2 + (L.under ? Math.max(L.under.dx, L.under.dy) : 0));
	if (layer === 'shadow') {
		if (L.cast) withShadow(ctx, L.cast, dpr, opts.shadowK ?? 1, () => { ctx.fillStyle = p.wall; ctx.fill(top); });
		const up = L.under ? unionPath(cells, s, L.radius, jitter, 1, L.under.dx, L.under.dy) : null;
		if (L.ambient) withShadow(ctx, L.ambient, dpr, 1, () => { ctx.fillStyle = L.under?.fill ?? p.wall; ctx.fill(up ?? top); });
		if (up && L.under) {
			ctx.fillStyle = L.under.fill;
			ctx.fill(up);
			if (L.edges) edgeBand(ctx, up, p.cut, 0.3, 'all', 1, b, dpr);
		}
		return;
	}
	ctx.fillStyle = p.wall;
	ctx.fill(top);
	if (L.topFibre > 0 && p.fibre) {
		// pale ink on navy (Paper), dark ink on manila (Night Paper)
		const ink = p.name === 'Paper' ? 'rgba(255,246,220,1)' : 'rgba(60,40,15,1)';
		const tile = fibreTile({ seed: 9, ink, alpha: 0.5, grain: 120 });
		const pat = ctx.createPattern?.(tile as CanvasImageSource, 'repeat');
		if (pat) {
			ctx.save();
			ctx.clip(top);
			ctx.globalAlpha *= L.topFibre;
			ctx.fillStyle = pat;
			ctx.fill(top);
			ctx.restore();
		}
	}
	if (L.edges) {
		edgeBand(ctx, top, p.cut, 0.55, 'all', 1, b, dpr);
		edgeBand(ctx, top, p.cutTL, 0.9, 'tl', 1.5, b, dpr);
	}
}

type Cell = { r: number; c: number; mask: number };

/**
 * Draw every wall in `vb`. Returns true while a flutter or peel is running.
 */
export function drawWalls(ctx: CanvasRenderingContext2D, src: WallSource, view: View, vb: Bounds, p: Palette, dpr: number, now: number, reduced: boolean, cache: WallCache): boolean {
	const s = 20 * view.zoom;
	cache.prepare(view, dpr, p, reduced);
	// live cells: freshly painted (flutter) and freshly erased (peel), capped
	let live = 0;
	const fluttering = new Set<number>();
	const peels: { r: number; c: number; t: number }[] = [];
	if (!reduced) {
		for (let r = Math.max(0, vb.r0); r <= vb.r1 && live < LIVE_MAX; r++)
			for (let c = Math.max(0, vb.c0); c <= vb.c1 && live < LIVE_MAX; c++) {
				if (!inHome(r, c)) continue;
				if (src.isWall(r, c)) {
					const t = src.changedAt(r, c);
					if (t > 0 && now - t < FLUTTER_MS) { fluttering.add(r * 1e5 + c); live++; }
				} else if (src.erasedAt) {
					const t = src.erasedAt(r, c);
					if (t > 0 && now - t < PEEL_MS) { peels.push({ r, c, t: (now - t) / PEEL_MS }); live++; }
				}
			}
	}
	const popping = (r: number, c: number) => fluttering.has(r * 1e5 + c);
	const settled = (r: number, c: number) => src.isWall(r, c) && !popping(r, c);
	const K = WALL_CHUNK;
	const cr0 = Math.floor(vb.r0 / K), cr1 = Math.floor(vb.r1 / K);
	const cc0 = Math.floor(vb.c0 / K), cc1 = Math.floor(vb.c1 / K);
	const useCache = K * s * dpr <= 1100; // §8 cap; above it draw live with jitter 0
	const pad = Math.ceil(0.45 * s) + 16;
	type Job = { r0: number; c0: number; cells: Cell[]; sig: number; key: string };
	const jobs: Job[] = [];
	const pops: Cell[] = [];
	for (let cr = cr0; cr <= cr1; cr++)
		for (let cc = cc0; cc <= cc1; cc++) {
			const r0 = cr * K, c0 = cc * K;
			const cells: Cell[] = [];
			let sig = 2166136261;
			for (let r = r0; r < r0 + K; r++)
				for (let c = c0; c < c0 + K; c++) {
					if (!src.isWall(r, c)) continue;
					if (popping(r, c)) {
						pops.push({ r, c, mask: 0 });
						continue;
					}
					const mask = wallMask(settled, r, c);
					cells.push({ r, c, mask });
					sig = Math.imul(sig ^ ((r - r0) * K + (c - c0)), 16777619) ^ mask;
				}
			if (cells.length) jobs.push({ r0, c0, cells, sig: sig ^ cells.length, key: `${cr},${cc}` });
		}
	const refs = (j: Job, ox: number, oy: number): CellRef[] => j.cells.map((q) => ({ x: ox + (q.c - j.c0) * s, y: oy + (q.r - j.r0) * s, r: q.r, c: q.c, mask: q.mask }));
	const origin = (j: Job) => cellToScreen(view, j.r0, j.c0);
	const bake = (j: Job): Entry | null => {
		if (!useCache) return null;
		const hit = cache.get(j.key);
		if (hit && hit.sig === j.sig) return hit;
		const size = Math.ceil((K * s + 2 * pad) * dpr);
		const body = mkCanvas(size, size);
		const shadow = mkCanvas(size, size);
		if (!body || !shadow) return null;
		const bc = body.getContext('2d') as Ctx2D | null;
		const sc = shadow.getContext('2d') as Ctx2D | null;
		if (!bc || !sc) return null;
		for (const c of [bc, sc]) c.setTransform(dpr, 0, 0, dpr, 0, 0);
		const cells = refs(j, pad, pad);
		paintWalls(sc, cells, s, p, 'shadow', dpr);
		paintWalls(bc, cells, s, p, 'body', dpr);
		const e = { sig: j.sig, shadow, body, pad };
		cache.set(j.key, e);
		return e;
	};
	const entries = jobs.map((j) => [j, bake(j)] as const);
	const blit = (j: Job, img: Layer) => {
		const o = origin(j);
		const x = Math.round((o.x - pad) * dpr) / dpr;
		const y = Math.round((o.y - pad) * dpr) / dpr;
		ctx.drawImage(img as CanvasImageSource, x, y, img.width / dpr, img.height / dpr);
	};
	for (const [j, e] of entries) {
		if (e && e.shadow) blit(j, e.shadow);
		else { const o = origin(j); paintWalls(ctx, refs(j, o.x, o.y), s, p, 'shadow', dpr, { jitter: 0 }); }
	}
	for (const [j, e] of entries) {
		if (e) blit(j, e.body);
		else { const o = origin(j); paintWalls(ctx, refs(j, o.x, o.y), s, p, 'body', dpr, { jitter: 0 }); }
	}
	// live layer: a dropped scrap settling (flutter), or a scrap peeling away
	const one = (r: number, c: number): CellRef[] => [{ x: -s / 2, y: -s / 2, r, c, mask: 0 }];
	for (const cl of pops) {
		const f = flutter((now - src.changedAt(cl.r, cl.c)) / FLUTTER_MS, cl.r, cl.c);
		const { x, y } = cellToScreen(view, cl.r, cl.c);
		ctx.save();
		ctx.globalAlpha = f.alpha;
		ctx.translate(x + s / 2, y + s / 2 + f.dy * s);
		ctx.rotate(f.rotate);
		ctx.scale(f.scale, f.scale);
		paintWalls(ctx, one(cl.r, cl.c), s, p, 'shadow', dpr, { shadowK: f.shadow });
		paintWalls(ctx, one(cl.r, cl.c), s, p, 'body', dpr);
		ctx.restore();
	}
	for (const pl of peels) {
		const k = peelAway(pl.t, pl.r, pl.c);
		const { x, y } = cellToScreen(view, pl.r, pl.c);
		const px = k.pivot!.x * s, py = k.pivot!.y * s; // the opposite corner stays down
		ctx.save();
		ctx.globalAlpha = k.alpha;
		ctx.translate(x + s / 2 + px, y + s / 2 + py);
		ctx.rotate(k.rotate);
		ctx.scale(k.scale, k.scale);
		ctx.translate(-px, -py);
		paintWalls(ctx, one(pl.r, pl.c), s, p, 'shadow', dpr, { shadowK: k.shadow });
		paintWalls(ctx, one(pl.r, pl.c), s, p, 'body', dpr);
		ctx.restore();
	}
	return pops.length + peels.length > 0;
}
