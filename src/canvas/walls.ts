// Walls (Prism review #1): raised slabs, cached per 16x16 chunk.
// - 4-neighbour mask (N=1, E=2, S=4, W=8); outer corners round only where both
//   orthogonal neighbours are open (unchanged rule), one union path per chunk.
// - Two cached layers per chunk: the drop shadow, then the body (fill, 1dp top
//   highlight, 1dp inner down edge, optional outline). All shadows are drawn
//   before any body so a neighbour chunk's blur never lands on a wall top.
// - The shadow is not motion, so it stays under reduced motion.
// - Newly painted Home walls pop in (scale .85 -> 1, alpha .6 -> 1, 120 ms) on
//   the live layer; they join the cached union once settled.
import { Bounds, inHome } from '../model/cell';
import { Palette } from './palette';
import { View, cellToScreen } from './view';

export const WALL_CHUNK = 16;
export const POP_MS = 120;
export const N = 1, E = 2, S = 4, W = 8;

export type WallSource = {
	isWall(r: number, c: number): boolean;
	/** ms timestamp of the last change for Home cells (0 when unknown) */
	changedAt(r: number, c: number): number;
};

export function wallMask(isWall: (r: number, c: number) => boolean, r: number, c: number) {
	return (isWall(r - 1, c) ? N : 0) | (isWall(r, c + 1) ? E : 0) | (isWall(r + 1, c) ? S : 0) | (isWall(r, c - 1) ? W : 0);
}

/** Corner radii [tl, tr, br, bl] for a mask: round only where both sides are open. */
export function cornerRadii(mask: number, R: number): [number, number, number, number] {
	const o = (b: number) => (mask & b) === 0;
	return [o(N) && o(W) ? R : 0, o(N) && o(E) ? R : 0, o(S) && o(E) ? R : 0, o(S) && o(W) ? R : 0];
}

/** cubic-bezier(.2,.8,.2,1), close enough for 120 ms. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3.2);

type Layer = HTMLCanvasElement | OffscreenCanvas;
type Entry = { sig: number; shadow: Layer | null; body: Layer; pad: number };

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

	/** Drop everything when zoom, dpr or palette change. */
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

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Path helpers in chunk-local coordinates (origin = top-left of cell r0,c0). */
function addCell(ctx: Ctx2D, x: number, y: number, s: number, rad: number[]) {
	const [tl, tr, br, bl] = rad;
	const x0 = x - 0.25, y0 = y - 0.25, x1 = x + s + 0.25, y1 = y + s + 0.25;
	ctx.moveTo(x0 + tl, y0);
	ctx.lineTo(x1 - tr, y0);
	if (tr) ctx.arcTo(x1, y0, x1, y0 + tr, tr);
	else ctx.lineTo(x1, y0);
	ctx.lineTo(x1, y1 - br);
	if (br) ctx.arcTo(x1, y1, x1 - br, y1, br);
	else ctx.lineTo(x1, y1);
	ctx.lineTo(x0 + bl, y1);
	if (bl) ctx.arcTo(x0, y1, x0, y1 - bl, bl);
	else ctx.lineTo(x0, y1);
	ctx.lineTo(x0, y0 + tl);
	if (tl) ctx.arcTo(x0, y0, x0 + tl, y0, tl);
	else ctx.lineTo(x0, y0);
	ctx.closePath();
}
/** Up-facing outline (top side + its corner arcs) for open N sides. */
function addTop(ctx: Ctx2D, x: number, y: number, s: number, mask: number, rad: number[]) {
	if (mask & N) return;
	const [tl, tr] = rad;
	ctx.moveTo(x, y + tl);
	if (tl) ctx.arcTo(x, y, x + tl, y, tl);
	ctx.lineTo(x + s - tr, y);
	if (tr) ctx.arcTo(x + s, y, x + s, y + tr, tr);
}
function addBottom(ctx: Ctx2D, x: number, y: number, s: number, mask: number, rad: number[]) {
	if (mask & S) return;
	const [, , br, bl] = rad;
	ctx.moveTo(x, y + s - bl);
	if (bl) ctx.arcTo(x, y + s, x + bl, y + s, bl);
	ctx.lineTo(x + s - br, y + s);
	if (br) ctx.arcTo(x + s, y + s, x + s, y + s - br, br);
}
function addSides(ctx: Ctx2D, x: number, y: number, s: number, mask: number, rad: number[]) {
	const [tl, tr, br, bl] = rad;
	addTop(ctx, x, y, s, mask, rad);
	addBottom(ctx, x, y, s, mask, rad);
	if (!(mask & E)) { ctx.moveTo(x + s, y + tr); ctx.lineTo(x + s, y + s - br); }
	if (!(mask & W)) { ctx.moveTo(x, y + tl); ctx.lineTo(x, y + s - bl); }
}

type Cell = { r: number; c: number; mask: number };

/** Paint one chunk's walls. `layer`: 'shadow' (fill with shadow only) or 'body'. */
function paintChunk(ctx: Ctx2D, cells: Cell[], r0: number, c0: number, ox: number, oy: number, s: number, p: Palette, layer: 'shadow' | 'body', dpr: number) {
	const fancy = s >= 10;
	const R = fancy ? 0.28 * s : 0;
	const at = (cl: Cell) => [ox + (cl.c - c0) * s, oy + (cl.r - r0) * s] as const;
	ctx.beginPath();
	for (const cl of cells) {
		const [x, y] = at(cl);
		addCell(ctx, x, y, s, cornerRadii(cl.mask, R));
	}
	if (layer === 'shadow') {
		ctx.save();
		ctx.shadowColor = p.shadow;
		ctx.shadowBlur = 0.22 * s * dpr; // shadowBlur ignores the transform
		ctx.shadowOffsetY = 0.1 * s * dpr;
		ctx.fillStyle = p.wall;
		ctx.fill();
		ctx.restore();
		return;
	}
	ctx.fillStyle = p.wall;
	ctx.fill();
	if (!fancy) return;
	const dp = 1;
	ctx.save();
	ctx.clip();
	const strokeWith = (color: string, add: typeof addTop) => {
		ctx.beginPath();
		for (const cl of cells) {
			const [x, y] = at(cl);
			add(ctx, x, y, s, cl.mask, cornerRadii(cl.mask, R));
		}
		ctx.strokeStyle = color;
		ctx.lineWidth = 2 * dp; // half of it falls inside the clip: a 1dp edge
		ctx.stroke();
	};
	if (p.wallOutline) strokeWith(p.wallOutline, addSides);
	strokeWith(p.highlight, addTop);
	strokeWith(p.wallDown, addBottom);
	ctx.restore();
}

/**
 * Draw every wall in `vb`. Returns true while a pop-in is running.
 * `liveOnly` skips the cache (tests, or when a chunk bitmap would be huge).
 */
export function drawWalls(ctx: CanvasRenderingContext2D, src: WallSource, view: View, vb: Bounds, p: Palette, dpr: number, now: number, reduced: boolean, cache: WallCache): boolean {
	const s = 20 * view.zoom;
	cache.prepare(view, dpr, p, reduced);
	const popping = (r: number, c: number) => {
		if (reduced || !inHome(r, c)) return false;
		const t = src.changedAt(r, c);
		return t > 0 && now - t < POP_MS;
	};
	const settled = (r: number, c: number) => src.isWall(r, c) && !popping(r, c);
	const K = WALL_CHUNK;
	const cr0 = Math.floor(vb.r0 / K), cr1 = Math.floor(vb.r1 / K);
	const cc0 = Math.floor(vb.c0 / K), cc1 = Math.floor(vb.c1 / K);
	const useCache = K * s * dpr <= 1100;
	const pad = Math.ceil(0.6 * s) + 2;
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
						pops.push({ r, c, mask: wallMask(src.isWall, r, c) });
						continue;
					}
					const mask = wallMask(settled, r, c);
					cells.push({ r, c, mask });
					sig = Math.imul(sig ^ ((r - r0) * K + (c - c0)), 16777619) ^ mask;
				}
			if (cells.length) jobs.push({ r0, c0, cells, sig: sig ^ cells.length, key: `${cr},${cc}` });
		}
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
		paintChunk(sc, j.cells, j.r0, j.c0, pad, pad, s, p, 'shadow', dpr);
		paintChunk(bc, j.cells, j.r0, j.c0, pad, pad, s, p, 'body', dpr);
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
	if (s >= 10) for (const [j, e] of entries) {
		if (e && e.shadow) blit(j, e.shadow);
		else { const o = origin(j); paintChunk(ctx, j.cells, j.r0, j.c0, o.x, o.y, s, p, 'shadow', dpr); }
	}
	for (const [j, e] of entries) {
		if (e) blit(j, e.body);
		else { const o = origin(j); paintChunk(ctx, j.cells, j.r0, j.c0, o.x, o.y, s, p, 'body', dpr); }
	}
	// pop-ins on the live layer
	for (const cl of pops) {
		const t = easeOut(Math.min(1, (now - src.changedAt(cl.r, cl.c)) / POP_MS));
		const k = 0.85 + 0.15 * t;
		const { x, y } = cellToScreen(view, cl.r, cl.c);
		ctx.save();
		ctx.globalAlpha = 0.6 + 0.4 * t;
		ctx.translate(x + s / 2, y + s / 2);
		ctx.scale(k, k);
		ctx.beginPath();
		addCell(ctx, -s / 2, -s / 2, s, cornerRadii(cl.mask, s >= 10 ? 0.28 * s : 0));
		ctx.fillStyle = p.wall;
		ctx.fill();
		ctx.restore();
	}
	return pops.length > 0;
}

