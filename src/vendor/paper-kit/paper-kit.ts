/**
 * paper-kit: framework-agnostic Canvas 2D primitives for a layered paper-cutout look.
 * No app imports. Works with HTMLCanvasElement or OffscreenCanvas contexts.
 * All randomness is seeded (hash of integers). Expensive bitmaps are cached by key.
 * Erasable TypeScript only (no enums / parameter properties), so `node --strip-types` can emit JS.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Layer = HTMLCanvasElement | OffscreenCanvas;
export type Pt = { x: number; y: number };
export type Shadow = { color: string; dx: number; dy: number; blur: number };

// ---------------------------------------------------------------- themes
export type PaperTheme = {
	name: string;
	table: string; sheet: string; grid: string;
	fibreInk: string; fibreAlpha: number; sheetShadow: string; vignette: number;
	card: string; cardUnder: string; cut: string; cutTL: string;
	shadow: string; contact: string;
	ink: string; inkSoft: string; accent: string; accentDeep: string;
	thread: string; hole: string; holeShadow: string;
	sticker: string; stickerEdge: string;
	stack: [string, string, string, string]; stackUnder: [string, string, string, string]; stackEdge: string;
	dots: [string, string, string];
	flat?: boolean; // Classic-style presets: no fibre, no jitter, single ply
	/** v1.1 */ fibreStrength: number; grain: number; vignetteRGB: string; pencil: string; pencilPressed: string; holeDeep: string; cardFibre: number;
};

export const PAPER: PaperTheme = {
	name: 'Paper', table: '#e6dbc4', sheet: '#f8f3e6', grid: '#eee6d5',
	fibreInk: 'rgba(90,62,24,1)', fibreAlpha: 1, sheetShadow: 'rgba(92,66,28,0.22)', vignette: 0.10,
	fibreStrength: 0.16, grain: 160, vignetteRGB: '70,45,15', pencil: 'rgba(78,64,44,0.10)', pencilPressed: 'rgba(255,252,242,0.45)', holeDeep: '#8f7c58', cardFibre: 0.22,
	card: '#2f3b5e', cardUnder: '#4f5d88', cut: '#8c9bc4', cutTL: '#b3c0e2',
	shadow: 'rgba(84,58,22,0.30)', contact: 'rgba(84,58,22,0.38)',
	ink: '#2b2620', inkSoft: '#6e6457', accent: '#f5c02c', accentDeep: '#b38712',
	thread: '#b02e22', hole: '#bfae8c', holeShadow: 'rgba(84,58,22,0.45)',
	sticker: '#fffaf0', stickerEdge: '#d6c8aa',
	stack: ['#f2d9a6', '#e9b673', '#e3a066', '#dc9258'], stackUnder: ['#d9b97f', '#c8964f', '#b67836', '#b8743c'], stackEdge: '#9a6a33',
	dots: ['#4fa092', '#3f9384', '#62ad9f'],
};

export const NIGHT_PAPER: PaperTheme = {
	name: 'Night Paper', table: '#10172d', sheet: '#1c2648', grid: '#24305a',
	fibreInk: 'rgba(255,246,220,1)', fibreAlpha: 0.9, sheetShadow: 'rgba(0,0,0,0.45)', vignette: 0.16,
	fibreStrength: 0.14, grain: 200, vignetteRGB: '0,4,18', pencil: 'rgba(170,190,240,0.075)', pencilPressed: 'rgba(0,0,0,0.22)', holeDeep: '#070b1c', cardFibre: 0.18,
	card: '#dccaa2', cardUnder: '#a8956d', cut: '#fff4d8', cutTL: '#fffaf0',
	shadow: 'rgba(2,5,16,0.55)', contact: 'rgba(2,5,16,0.60)',
	ink: '#f3ecdc', inkSoft: '#a59d8c', accent: '#f5c02c', accentDeep: '#a77c0c',
	thread: '#ff8a66', hole: '#0b1124', holeShadow: 'rgba(0,0,0,0.6)',
	sticker: '#fff6e6', stickerEdge: '#c9b993',
	stack: ['#4a4766', '#7a5a52', '#93583a', '#8a4f33'], stackUnder: ['#36344f', '#5c433d', '#6f412a', '#6a3a24'], stackEdge: '#c99a6a',
	dots: ['#4aa89c', '#3f9a8f', '#56b5a8'],
};

/** Map a project's own preset onto the kit: start from a base theme, override roles, optionally flatten. */
export function definePreset(base: PaperTheme, overrides: Partial<PaperTheme>): PaperTheme {
	return { ...base, ...overrides };
}

// ---------------------------------------------------------------- contrast (WCAG 2.x)
function lum(hex: string): number {
	const h = hex.replace('#', '');
	const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
	const [r = 0, g = 0, b = 0] = v;
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
	const x = lum(a), y = lum(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Returns failing role pairs (non-text marks need >= 3:1, ink needs >= 4.5:1 on the sheet). */
export function checkTheme(t: PaperTheme): string[] {
	const fails: string[] = [];
	const need = (role: string, fg: string, bg: string, min: number) => { const c = contrast(fg, bg); if (c < min) fails.push(`${role} ${c.toFixed(2)} < ${min}`); };
	need('card/sheet', t.card, t.sheet, 3);
	need('stackEdge/sheet', t.stackEdge, t.sheet, 3);
	need('thread/sheet', t.thread, t.sheet, 3);
	need('ink/sheet', t.ink, t.sheet, 4.5);
	need('inkSoft/sheet', t.inkSoft, t.sheet, 4.5);
	return fails;
}

// ---------------------------------------------------------------- seeded randomness + cache
/** Deterministic 0..1 from up to four integers (stable across frames, rebakes and machines). */
export function hash(a: number, b = 0, c = 0, d = 0): number {
	let h = 2166136261 ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, -2048144777) ^ Math.imul(d | 0, -1028477379);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}
/** Seeded PRNG stream (mulberry32) for procedural textures. */
export function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const CACHE = new Map<string, unknown>();
const CACHE_MAX = 256;
/** LRU cache by string key. `make` runs only on a miss. */
export function cached<T>(key: string, make: () => T): T {
	if (CACHE.has(key)) { const v = CACHE.get(key) as T; CACHE.delete(key); CACHE.set(key, v); return v; }
	const v = make();
	CACHE.set(key, v);
	if (CACHE.size > CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
	return v;
}
export function clearCache(prefix = ''): void { for (const k of [...CACHE.keys()]) if (k.startsWith(prefix)) CACHE.delete(k); }

let layerFactory: (w: number, h: number) => Layer = (w, h) => {
	if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
	const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
/** Override how offscreen layers are made (tests, node-canvas, workers). */
export function setLayerFactory(f: (w: number, h: number) => Layer): void { layerFactory = f; }
function layer(w: number, h: number): [Layer, Ctx] {
	const l = layerFactory(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
	return [l, l.getContext('2d') as Ctx];
}

// ---------------------------------------------------------------- elevation scale
/** Shadow and ply offsets for a cell/unit size `s` px (caps in CSS px). Multiply blur by dpr when you draw. */
export function elevation(s: number) {
	return {
		radius: s < 6 ? 0 : 0.14 * s,
		plies: s >= 14 ? 2 : 1,
		jitter: s >= 14 ? Math.min(0.03 * s, 2.4) : 0, // v1.1: visible from 100% (was >= 200%, .022s)
		under: { dx: Math.min(0.06 * s, 3.6), dy: Math.min(0.12 * s, 7.2) }, // v1.1: visible ply (was .04s/.09s)
		cast: s < 14 ? { dx: 0, dy: 1, blur: 0 } : { dx: Math.min(0.03 * s, 2.4), dy: Math.min(0.1 * s, 8), blur: Math.min(0.16 * s, 12.8) },
		contact: { dx: 0, dy: Math.max(1, 0.03 * s), blur: Math.min(0.06 * s, 4) },
		/** v1.1: tight dark ambient-occlusion shadow drawn in addition to the cast shadow (z2). */
		ambient: { dx: 0, dy: Math.min(0.02 * s, 1.6) + 0.5, blur: Math.min(0.05 * s, 3) },
	};
}
function withShadow(ctx: Ctx, sh: Shadow | null, dpr: number, draw: () => void) {
	ctx.save();
	if (sh) { ctx.shadowColor = sh.color; ctx.shadowOffsetX = sh.dx * dpr; ctx.shadowOffsetY = sh.dy * dpr; ctx.shadowBlur = sh.blur * dpr; }
	draw();
	ctx.restore();
}

// ---------------------------------------------------------------- paperSheet
export type FibreOpts = { seed?: number; ink?: string; size?: number; specks?: number; fibres?: number; alpha?: number; grain?: number };
/** Procedural fibre tile (specks + short curved fibres), cached by its options. Tile once, never per cell. */
export function fibreTile(o: FibreOpts = {}): Layer {
	const { seed = 1, ink = 'rgba(90,62,24,1)', size = 256, specks = 5200, fibres = 140, alpha = 0.11, grain = 0 } = o;
	return cached(`fibre|${seed}|${ink}|${size}|${specks}|${fibres}|${alpha}|${grain}`, () => {
		const [l, c] = layer(size, size);
		const r = rng(seed);
		c.fillStyle = ink;
		// v1.1 grain: soft low-alpha blotches (pulp density), drawn wrapped so the tile stays seamless
		for (let i = 0; i < grain; i++) {
			const x = r() * size, y = r() * size, rad = 2 + r() * 7;
			c.globalAlpha = alpha * 0.22 * (0.4 + 0.6 * r());
			for (const ox of [0, -size, size]) for (const oy of [0, -size, size]) { c.beginPath(); c.arc(x + ox, y + oy, rad, 0, Math.PI * 2); c.fill(); }
		}
		for (let i = 0; i < specks; i++) { c.globalAlpha = alpha * (0.3 + 0.7 * r()); c.fillRect(Math.floor(r() * size), Math.floor(r() * size), 1, 1); }
		c.strokeStyle = ink; c.lineWidth = 1;
		for (let i = 0; i < fibres; i++) {
			const x = r() * size, y = r() * size, a = r() * Math.PI, L = 5 + r() * 11;
			c.globalAlpha = alpha * (0.5 + 0.5 * r());
			c.beginPath();
			for (let k = 0; k <= 5; k++) { const t = k / 5; const px = x + Math.cos(a) * L * t + Math.sin(t * 3) * 1.2, py = y + Math.sin(a) * L * t; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
			c.stroke();
			// wrap so the tile is seamless
			if (x > size - 20 || y > size - 20) { c.save(); c.translate(x > size - 20 ? -size : 0, y > size - 20 ? -size : 0); c.stroke(); c.restore(); }
		}
		return l;
	});
}
export type SheetOpts = { fill: string; fibre?: FibreOpts | null; fibreAlpha?: number; vignette?: number; vignetteRGB?: string; shadow?: Shadow | null; patternOffset?: Pt; dpr?: number };
/** A sheet of paper: shadow, fill, fibre pattern (pans with patternOffset, does not scale), soft edge vignette. */
export function paperSheet(ctx: Ctx, x: number, y: number, w: number, h: number, o: SheetOpts): void {
	const dpr = o.dpr ?? 1;
	withShadow(ctx, o.shadow ?? null, dpr, () => { ctx.fillStyle = o.fill; ctx.fillRect(x, y, w, h); });
	if (o.fibre !== null) {
		const tile = fibreTile(o.fibre ?? {});
		const pat = ctx.createPattern(tile as CanvasImageSource, 'repeat');
		if (pat) {
			const off = o.patternOffset ?? { x: 0, y: 0 };
			pat.setTransform(new DOMMatrix().translate(off.x, off.y));
			ctx.save(); ctx.globalAlpha *= o.fibreAlpha ?? 1; ctx.fillStyle = pat; ctx.fillRect(x, y, w, h); ctx.restore();
		}
	}
	if (o.vignette) {
		const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.hypot(w, h) * 0.6);
		const rgb = o.vignetteRGB ?? '70,45,15'; // warm by default
		g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.55, `rgba(${rgb},${o.vignette * 0.35})`); g.addColorStop(1, `rgba(${rgb},${o.vignette})`);
		ctx.save(); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore();
	}
}

// ---------------------------------------------------------------- pencilGrid (v1.1)
export type GridOpts = { color: string; alpha: number; pressed?: string | null; seed?: number; wobble?: number; dpr?: number };
/**
 * Faint hand-ruled grid: each line wobbles (seeded), varies in pressure along its length and skips now and then;
 * optional `pressed` colour adds a 1px light groove under each line (a pressed rule instead of ink).
 * Baked to a bitmap cached by (w, h, s, colours, seed, dpr): blit it, never redraw per frame.
 */
export function pencilGrid(ctx: Ctx, x: number, y: number, w: number, h: number, s: number, o: GridOpts): void {
	const dpr = o.dpr ?? 1, seed = o.seed ?? 1, wob = o.wobble ?? Math.min(0.6, 0.02 * s);
	const img = cached(`grid|${w}|${h}|${s}|${o.color}|${o.alpha}|${o.pressed}|${seed}|${dpr}`, () => {
		const [l, c] = layer(w * dpr, h * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.lineCap = 'round';
		const line = (vertical: boolean, at: number, idx: number) => {
			const len = vertical ? h : w, seg = 24;
			for (let t = 0; t < len; t += seg) {
				const k = hash(idx, Math.floor(t / seg), seed, vertical ? 1 : 2);
				if (k < 0.06) continue; // skipped bit of the rule
				const a0 = (hash(idx, Math.floor(t / seg), seed, 3) - 0.5) * 2 * wob, a1 = (hash(idx, Math.floor(t / seg) + 1, seed, 3) - 0.5) * 2 * wob;
				const draw = (dx: number, dy: number, col: string, al: number) => {
					c.globalAlpha = al; c.strokeStyle = col; c.lineWidth = 1; c.beginPath();
					if (vertical) { c.moveTo(at + a0 + dx, t + dy); c.lineTo(at + a1 + dx, Math.min(len, t + seg) + dy); }
					else { c.moveTo(t + dx, at + a0 + dy); c.lineTo(Math.min(len, t + seg) + dx, at + a1 + dy); }
					c.stroke();
				};
				const p = 0.55 + 0.45 * k; // pressure
				if (o.pressed) draw(vertical ? 1 : 0, vertical ? 0 : 1, o.pressed, o.alpha * p);
				draw(0, 0, o.color, o.alpha * p);
			}
		};
		let i = 0; for (let gx = s; gx < w - 0.5; gx += s) line(true, Math.round(gx) + 0.5, i++);
		i = 0; for (let gy = s; gy < h - 0.5; gy += s) line(false, Math.round(gy) + 0.5, 1000 + i++);
		return l;
	});
	ctx.drawImage(img as CanvasImageSource, x, y, w, h);
}

// ---------------------------------------------------------------- bitmask union (cutCard)
export const N = 1, E = 2, S = 4, W = 8;
/** 4-neighbour mask for grid cell (r, c). */
export function maskAt(isSet: (r: number, c: number) => boolean, r: number, c: number): number {
	return (isSet(r - 1, c) ? N : 0) | (isSet(r, c + 1) ? E : 0) | (isSet(r + 1, c) ? S : 0) | (isSet(r, c - 1) ? W : 0);
}
export type CellRef = { x: number; y: number; r: number; c: number; mask: number };
/**
 * Adds one cell to a union path. Shared sides overlap `ov` px (no seams under nonzero fill); corners round only where both
 * sides are open (concave corners stay sharp); open sides get inward-only seeded jitter with pinned endpoints.
 */
export function addCutCell(p: Path2D | Ctx, q: CellRef, s: number, radius: number, jitter: number, seed = 0, inset = 0, ov = 0.6): void {
	const m = q.mask, oN = !(m & N), oE = !(m & E), oS = !(m & S), oW = !(m & W);
	const L = q.x + (oW ? inset : -ov), R = q.x + s - (oE ? inset : -ov), T = q.y + (oN ? inset : -ov), B = q.y + s - (oS ? inset : -ov);
	const tl = oN && oW ? radius : 0, tr = oN && oE ? radius : 0, br = oS && oE ? radius : 0, bl = oS && oW ? radius : 0;
	const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, open: boolean, side: number) => {
		if (open && jitter > 0) {
			const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / (0.17 * s)));
			for (let i = 1; i < n; i++) { const t = i / n, j = jitter * (0.25 + 0.75 * hash(q.r, q.c, side + seed * 4, i)); p.lineTo(x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j); }
		}
		p.lineTo(x1, y1);
	};
	p.moveTo(L + tl, T);
	edge(L + tl, T, R - tr, T, 0, 1, oN, 0); if (tr) p.arcTo(R, T, R, T + tr, tr);
	edge(R, T + tr, R, B - br, -1, 0, oE, 1); if (br) p.arcTo(R, B, R - br, B, br);
	edge(R - br, B, L + bl, B, 0, -1, oS, 2); if (bl) p.arcTo(L, B, L, B - bl, bl);
	edge(L, B - bl, L, T + tl, 1, 0, oW, 3); if (tl) p.arcTo(L, T, L + tl, T, tl);
	p.closePath();
}
export function unionPath(cells: CellRef[], s: number, radius: number, jitter: number, seed = 0, dx = 0, dy = 0, inset = 0): Path2D {
	const p = new Path2D();
	for (const q of cells) addCutCell(p, { ...q, x: q.x + dx, y: q.y + dy }, s, radius, jitter, seed, inset);
	return p;
}
/** Union-aware inner edge band: 'all' = path minus its 1-step erosion, 'tl' = path minus itself shifted (w, w). */
export function edgeBand(ctx: Ctx, path: Path2D, color: string, alpha: number, kind: 'all' | 'tl', w: number, bounds: { x: number; y: number; w: number; h: number }, dpr = 1): void {
	const pad = 4, W2 = (bounds.w + 2 * pad) * dpr, H2 = (bounds.h + 2 * pad) * dpr;
	const [a, ac] = layer(W2, H2);
	const tf = (c: Ctx, dx = 0, dy = 0) => c.setTransform(dpr, 0, 0, dpr, (pad - bounds.x + dx) * dpr, (pad - bounds.y + dy) * dpr);
	tf(ac); ac.fillStyle = color; ac.fill(path); ac.globalCompositeOperation = 'destination-out';
	if (kind === 'tl') { tf(ac, w, w); ac.fill(path); }
	else {
		const [e, ec] = layer(W2, H2);
		tf(ec); ec.fill(path); ec.globalCompositeOperation = 'destination-in';
		for (const [dx, dy] of [[w, 0], [-w, 0], [0, w], [0, -w]]) { tf(ec, dx, dy); ec.fill(path); }
		ac.setTransform(1, 0, 0, 1, 0, 0); ac.drawImage(e as CanvasImageSource, 0, 0);
	}
	ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(a as CanvasImageSource, bounds.x - pad, bounds.y - pad, W2 / dpr, H2 / dpr); ctx.restore();
}
export type CutCardOpts = {
	fill: string; under?: { fill: string; dx: number; dy: number; edge?: string } | null;
	cast?: Shadow | null; cut?: string | null; cutTL?: string | null; radius: number; jitter?: number; seed?: number; dpr?: number;
	/** v1.1 */ ambient?: Shadow | null; topTexture?: { tile: Layer; alpha: number } | null;
};
function boundsOf(cells: CellRef[], s: number, extra: number) {
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const q of cells) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + s); y1 = Math.max(y1, q.y + s); }
	return { x: x0 - extra, y: y0 - extra, w: x1 - x0 + 2 * extra, h: y1 - y0 + 2 * extra };
}
/** Cut-paper card: cast shadow (whole stack) -> under-ply -> top ply -> 1dp cut edge all round + 2dp top-left. */
export function cutCard(ctx: Ctx, cells: CellRef[], s: number, o: CutCardOpts): void {
	if (!cells.length) return;
	const dpr = o.dpr ?? 1, j = o.jitter ?? 0, seed = o.seed ?? 0;
	const top = unionPath(cells, s, o.radius, j, seed);
	const u = o.under;
	if (o.cast) {
		const sh = { ...o.cast, dx: o.cast.dx + (u ? u.dx : 0), dy: o.cast.dy + (u ? u.dy : 0) };
		withShadow(ctx, sh, dpr, () => { ctx.fillStyle = o.fill; ctx.fill(top); });
	}
	if (o.ambient) withShadow(ctx, o.ambient, dpr, () => { ctx.fillStyle = u ? u.fill : o.fill; ctx.fill(u ? unionPath(cells, s, o.radius, j, seed, u.dx, u.dy) : top); });
	const b = boundsOf(cells, s, 2 + (u ? Math.max(u.dx, u.dy) : 0));
	if (u) {
		const up = unionPath(cells, s, o.radius, j, seed, u.dx, u.dy);
		ctx.fillStyle = u.fill; ctx.fill(up);
		if (u.edge && s >= 10) edgeBand(ctx, up, u.edge, 0.3, 'all', 1, b, dpr);
	}
	ctx.fillStyle = o.fill; ctx.fill(top);
	if (o.topTexture && s >= 14) {
		const pat = ctx.createPattern(o.topTexture.tile as CanvasImageSource, 'repeat');
		if (pat) { ctx.save(); ctx.clip(top); ctx.globalAlpha *= o.topTexture.alpha; ctx.fillStyle = pat; ctx.fill(top); ctx.restore(); }
	}
	if (s >= 10 && o.cut) edgeBand(ctx, top, o.cut, 0.55, 'all', 1, b, dpr);
	if (s >= 10 && o.cutTL) edgeBand(ctx, top, o.cutTL, 0.9, 'tl', 1.5, b, dpr);
}
/** Bake a cutCard into a cached bitmap (one per chunk key + signature) and blit it. Use for big static sets. */
export function cutCardCached(ctx: Ctx, key: string, cells: CellRef[], s: number, o: CutCardOpts): void {
	if (!cells.length) return;
	const dpr = o.dpr ?? 1, pad = Math.ceil(0.3 * s) + 16, b = boundsOf(cells, s, pad);
	let sig = 2166136261; for (const q of cells) sig = Math.imul(sig ^ (q.r * 4099 + q.c), 16777619) ^ q.mask;
	const img = cached(`cut|${key}|${sig}|${s}|${dpr}|${o.fill}|${o.jitter ?? 0}`, () => {
		const [l, c] = layer(b.w * dpr, b.h * dpr);
		c.setTransform(dpr, 0, 0, dpr, -b.x * dpr, -b.y * dpr);
		cutCard(c, cells, s, o);
		return l;
	});
	ctx.drawImage(img as CanvasImageSource, b.x, b.y, b.w, b.h);
}

// ---------------------------------------------------------------- paperStack
export type StackOpts = { layers: 1 | 2 | 3 | 4; top: string; under: string; edge?: string | null; step?: Pt; radius?: number; inset?: number; contact?: Shadow | null; dpr?: number; label?: { text: string; color: string; font: string; seed?: number } };
/** A pile of 1-4 tinted sheets (lower sheets offset down-right). Pass merged cells (same value) for blobs. */
export function paperStack(ctx: Ctx, cells: CellRef[], s: number, o: StackOpts): void {
	if (!cells.length) return;
	const dpr = o.dpr ?? 1, st = o.step ?? { x: Math.min(0.05 * s, 4), y: Math.min(0.08 * s, 6.4) };
	const rad = o.radius ?? 0.14 * s, ins = o.inset ?? 0.08 * s, n = s >= 14 ? o.layers : 1;
	for (let i = n - 1; i >= 0; i--) {
		const p = unionPath(cells, s, rad, 0, 0, i * st.x, i * st.y, ins);
		const sh = i === n - 1 ? (o.contact ?? null) : null;
		withShadow(ctx, sh, dpr, () => { ctx.globalAlpha *= i === 0 ? 1 : 1 - 0.18 * (i - 1); ctx.fillStyle = i === 0 ? o.top : o.under; ctx.fill(p); });
	}
	if (o.edge) edgeBand(ctx, unionPath(cells, s, rad, 0, 0, 0, 0, ins), o.edge, s >= 10 ? 0.9 : 0.6, 'all', 1, boundsOf(cells, s, 2), dpr);
	if (o.label && s >= 40) {
		ctx.save(); ctx.fillStyle = o.label.color; ctx.font = o.label.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		for (const q of cells) { ctx.save(); ctx.translate(q.x + s / 2, q.y + s / 2); ctx.rotate((hash(q.r, q.c, o.label.seed ?? 7) - 0.5) * 0.14); ctx.globalAlpha *= 0.88; ctx.fillText(o.label.text, 0, 1); ctx.restore(); }
		ctx.restore();
	}
}

// ---------------------------------------------------------------- punchDot / punchHole
export type DotOpts = { fill: string; contact?: Shadow | null; seed?: [number, number]; jitter?: number; alpha?: number; dpr?: number;
	/** v1.1 confetti: radius variance (0..1), ellipse squash (0..1), rim highlight colour */ sizeVar?: number; squash?: number; rim?: string | null };
/** Hole-punch confetti dot. Seeded jitter keeps dots from looking machine-gridded. */
export function punchDot(ctx: Ctx, cx: number, cy: number, r: number, o: DotOpts): void {
	const [a, b] = o.seed ?? [0, 0], j = o.jitter ?? 0;
	const x = cx + (hash(a, b, 1) - 0.5) * 2 * j, y = cy + (hash(a, b, 2) - 0.5) * 2 * j;
	const rr = r * (1 + (hash(a, b, 4) - 0.5) * 2 * (o.sizeVar ?? 0)), sq = 1 - (o.squash ?? 0) * hash(a, b, 5), rot = hash(a, b, 6) * Math.PI;
	ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
	withShadow(ctx, o.contact ?? null, o.dpr ?? 1, () => { ctx.beginPath(); ctx.ellipse(x, y, rr, rr * sq, rot, 0, Math.PI * 2); ctx.fillStyle = o.fill; ctx.fill(); });
	if (o.rim && rr >= 4) { ctx.beginPath(); ctx.ellipse(x, y, rr - 0.6, rr * sq - 0.6, rot, Math.PI * 1.05, Math.PI * 1.75); ctx.strokeStyle = o.rim; ctx.lineWidth = 1; ctx.stroke(); }
	ctx.restore();
}
/** Pre-rendered dot sprite (cache by fill+radius) for thousands of dots per frame. */
export function punchDotSprite(r: number, fill: string, contact: Shadow | null, dpr = 1): Layer {
	return cached(`dot|${r}|${fill}|${contact?.color}|${dpr}`, () => {
		const pad = Math.ceil(r + 6), [l, c] = layer(2 * pad * dpr, 2 * pad * dpr);
		c.setTransform(dpr, 0, 0, dpr, 0, 0); punchDot(c, pad, pad, r, { fill, contact, dpr }); return l;
	});
}
export type HoleOpts = { hole: string; innerShadow: string; ring?: { color: string; width: number; contact?: Shadow | null; highlight?: string } | null; dpr?: number };
/** A punched hole (shows the layer below) with a top inner shadow; optional reinforcement ring. */
export function punchHole(ctx: Ctx, cx: number, cy: number, r: number, o: HoleOpts): void {
	const dpr = o.dpr ?? 1, TAU = Math.PI * 2;
	ctx.save();
	ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = o.hole; ctx.fill();
	ctx.save(); ctx.clip();
	ctx.beginPath(); ctx.rect(cx - 3 * r, cy - 3 * r, 6 * r, 6 * r); ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU, true);
	ctx.shadowColor = o.innerShadow; ctx.shadowBlur = Math.max(1, 0.25 * r) * dpr; ctx.shadowOffsetY = Math.max(1, 0.2 * r) * dpr; ctx.fillStyle = o.innerShadow; ctx.fill();
	ctx.restore();
	if (o.ring) {
		const ro = r + o.ring.width, ri = r + Math.max(0.5, 0.15 * r);
		const ring = new Path2D(); ring.arc(cx, cy, ro, 0, TAU); ring.moveTo(cx + ri, cy); ring.arc(cx, cy, ri, 0, TAU, true);
		withShadow(ctx, o.ring.contact ?? null, dpr, () => { ctx.fillStyle = o.ring!.color; ctx.fill(ring, 'evenodd'); });
		if (o.ring.highlight) { ctx.save(); ctx.clip(ring, 'evenodd'); const hl = new Path2D(); hl.arc(cx + 1, cy + 1, ro, 0, TAU); ctx.strokeStyle = o.ring.highlight; ctx.lineWidth = 2; ctx.stroke(hl); ctx.restore(); }
	}
	ctx.restore();
}

// ---------------------------------------------------------------- sticker
export type StickerOpts = { fill: string; border: string; borderWidth?: number; edge?: string; peel?: number; rotate?: number; contact?: Shadow | null; dpr?: number; /** v1.1: false = longer peel shadow without the corner curl (organic shapes) */ curl?: boolean };
/**
 * Die-cut sticker: a white border follows the shape (stroke at 2x width under the fill), lifted shadow,
 * optional peel (0..1) that curls the bottom-right corner and lengthens the shadow there.
 * `shape` is drawn centred at (0,0); `art` paints the sticker face after the fill.
 */
export function sticker(ctx: Ctx, cx: number, cy: number, shape: Path2D, o: StickerOpts, art?: (c: Ctx) => void): void {
	const dpr = o.dpr ?? 1, bw = o.borderWidth ?? 3, peel = o.peel ?? 0;
	ctx.save(); ctx.translate(cx, cy); if (o.rotate) ctx.rotate(o.rotate);
	const sh = o.contact ?? null;
	withShadow(ctx, sh ? { ...sh, dy: sh.dy * (1 + peel), blur: sh.blur * (1 + peel) } : null, dpr, () => {
		ctx.lineJoin = 'round'; ctx.strokeStyle = o.border; ctx.lineWidth = 2 * bw; ctx.stroke(shape); ctx.fillStyle = o.border; ctx.fill(shape);
	});
	if (o.edge) { ctx.save(); ctx.lineJoin = 'round'; ctx.globalAlpha *= 0.9; ctx.strokeStyle = o.edge; ctx.lineWidth = 2 * bw + 1; ctx.globalCompositeOperation = 'destination-over'; ctx.stroke(shape); ctx.restore(); }
	ctx.fillStyle = o.fill; ctx.fill(shape);
	if (art) { ctx.save(); ctx.clip(shape); art(ctx); ctx.restore(); }
	if (peel > 0 && o.curl !== false) {
		// corner curl: a folded triangle (sticker back = border colour) with its own shadow, anchored at the shape's bottom-right
		const bb = pathBox(shape), k = Math.min(bb.w, bb.h) * 0.32 * peel, x = bb.x + bb.w + bw, y = bb.y + bb.h + bw;
		ctx.save();
		ctx.beginPath(); ctx.moveTo(x - k, y); ctx.lineTo(x, y - k); ctx.lineTo(x - k * 1.05, y - k * 1.05); ctx.closePath();
		ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 3 * dpr; ctx.shadowOffsetX = -1 * dpr; ctx.shadowOffsetY = -1 * dpr;
		ctx.fillStyle = o.border; ctx.fill(); ctx.restore();
	}
	ctx.restore();
}
/** Approximate box of a shape path made with arc/rect/lines centred at origin (pass explicit box when unsure). */
const BOXES = new WeakMap<Path2D, { x: number; y: number; w: number; h: number }>();
export function shapeWithBox(build: (p: Path2D) => void, box: { x: number; y: number; w: number; h: number }): Path2D { const p = new Path2D(); build(p); BOXES.set(p, box); return p; }
function pathBox(p: Path2D) { return BOXES.get(p) ?? { x: -10, y: -10, w: 20, h: 20 }; }

// ---------------------------------------------------------------- threadPath
export type ThreadOpts = { color: string; halo?: string | null; width: number; dash?: [number, number]; progress?: number; under?: string | null; knot?: boolean; tug?: number;
	/** v1.1: stitch holes at each dash end, and a soft thread shadow */ holes?: { color: string; r?: number } | null; shadow?: Shadow | null; dpr?: number };
/** Stitched thread: halo (= surface colour, guarantees contrast), under-stitch shadow, dashed stitches, knots. `null` in pts breaks the thread. */
export function threadPath(ctx: Ctx, pts: (Pt | null)[], o: ThreadOpts): void {
	const segs: Pt[][] = []; let cur: Pt[] = [];
	for (const p of pts) { if (!p) { if (cur.length > 1) segs.push(cur); cur = []; } else cur.push(p); }
	if (cur.length > 1) segs.push(cur);
	const lw = o.width, dash = o.dash ?? [lw * 3.1, lw * 1.55];
	let total = 0; for (const sg of segs) for (let i = 1; i < sg.length; i++) { const a = sg[i - 1], b = sg[i]; if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y); }
	let budget = total * Math.max(0, Math.min(1, o.progress ?? 1));
	ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	for (const sg of segs) {
		if (budget <= 0) break;
		const s0 = sg[0]; if (!s0) continue;
		const p = new Path2D(); p.moveTo(s0.x, s0.y); let used = 0;
		for (let i = 1; i < sg.length; i++) {
			const a = sg[i - 1], b = sg[i]; if (!a || !b) continue;
			const d = Math.hypot(b.x - a.x, b.y - a.y);
			if (used + d > budget) { const t = (budget - used) / d; p.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); used = budget; break; }
			p.lineTo(b.x, b.y); used += d;
		}
		budget -= used;
		if (o.halo) { ctx.setLineDash([]); ctx.globalAlpha = 0.85; ctx.strokeStyle = o.halo; ctx.lineWidth = lw + Math.max(2, lw * 0.75); ctx.stroke(p); ctx.globalAlpha = 1; }
		if (o.holes) {
			// a hole where every stitch enters and leaves the paper
			const [dOn = 0, dOff = 0] = dash, period = dOn + dOff, off = (o.tug ?? 0) * period, hr = o.holes.r ?? Math.max(0.9, lw * 0.36), push = hr * 0.9;
			ctx.fillStyle = o.holes.color;
			let acc = 0;
			for (let i = 1; i < sg.length; i++) {
				const a = sg[i - 1], b = sg[i]; if (!a || !b) continue;
				const ax = a.x, ay = a.y, bx = b.x, by = b.y, d = Math.hypot(bx - ax, by - ay);
				for (const phase of [-push, dOn + push]) { // just outside each stitch end, in the gap
					let t = Math.ceil((acc - off - phase) / period) * period + phase + off;
					for (; t < acc + d && t <= used; t += period) { const k = (t - acc) / d; if (k < 0) continue; ctx.beginPath(); ctx.arc(ax + (bx - ax) * k, ay + (by - ay) * k, hr, 0, Math.PI * 2); ctx.fill(); }
				}
				acc += d; if (acc > used) break;
			}
		}
		ctx.setLineDash(dash); ctx.lineDashOffset = -(o.tug ?? 0) * ((dash[0] ?? 0) + (dash[1] ?? 0));
		if (o.holes) ctx.lineCap = 'butt'; // stitches end at their holes
		if (o.shadow) { const dp = o.dpr ?? 1; ctx.save(); ctx.shadowColor = o.shadow.color; ctx.shadowOffsetX = o.shadow.dx * dp; ctx.shadowOffsetY = o.shadow.dy * dp; ctx.shadowBlur = o.shadow.blur * dp; ctx.strokeStyle = o.color; ctx.lineWidth = lw; ctx.stroke(p); ctx.restore(); }
		if (o.under) { ctx.save(); ctx.translate(0, Math.max(1, lw * 0.3)); ctx.strokeStyle = o.under; ctx.lineWidth = lw; ctx.stroke(p); ctx.restore(); }
		ctx.strokeStyle = o.color; ctx.lineWidth = lw; ctx.stroke(p);
		if (o.knot) { ctx.setLineDash([]); ctx.beginPath(); ctx.arc(s0.x, s0.y, lw * 0.9, 0, Math.PI * 2); ctx.fillStyle = o.color; ctx.fill(); }
	}
	ctx.restore();
}

// ---------------------------------------------------------------- motion
/** CSS-equivalent cubic-bezier easing (Newton solve), for canvas animations. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
	const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
	const X = (t: number) => ((ax * t + bx) * t + cx) * t, Y = (t: number) => ((ay * t + by) * t + cy) * t, dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
	return (x: number) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 6; i++) { const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= (X(t) - x) / d; } return Y(Math.max(0, Math.min(1, t))); };
}
export const EASE = {
	pop: bezier(0.34, 1.56, 0.64, 1), // paint pop, enter (overshoot ~8%)
	peel: bezier(0.4, 0, 1, 1), // erase
	out: bezier(0.2, 0.8, 0.2, 1), // panels, tug
	press: bezier(0.3, 0.7, 0.4, 1), // button depth
	flight: bezier(0.45, 0, 0.2, 1), // paper-plane jumps
};
export const DURATION = { press: 90, peel: 160, flutter: 220, pop: 140, tug: 240, panel: 240, flight: 420, enter: 480, pulse: 900, bob: 2400, drawPerUnit: 12, drawMax: 1200 };

// ---------------------------------------------------------------- v1.1: sheetPile, liftedCard, paint motion
export type PileOpts = {
	layers: number; fills: string[]; edge?: string | null; seed?: number; rotate?: number; offset?: number; jitter?: number;
	tintVar?: number; inset?: number; step?: Pt; contact?: Shadow | null; dpr?: number; label?: { text: string; color: string; font: string } | null;
};
function shade(hex: string, k: number): string { // k in -1..1: darken / lighten in sRGB
	const h = hex.replace('#', ''), v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
	return '#' + v.map((c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)).map((c) => c.toString(16).padStart(2, '0')).join('');
}
/** Deckled quad for one sheet centred at 0,0 (seeded), as a Path2D. */
function deckledSheet(w: number, h: number, jitter: number, a: number, b: number, layerI: number): Path2D {
	const p = new Path2D(), pts: Pt[] = [];
	const side = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, sideI: number) => {
		const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 5));
		for (let i = 0; i < n; i++) { const t = i / n, j = jitter * hash(a, b, layerI * 4 + sideI, i); pts.push({ x: x0 + (x1 - x0) * t + nx * j, y: y0 + (y1 - y0) * t + ny * j }); }
	};
	side(-w / 2, -h / 2, w / 2, -h / 2, 0, 1, 0); side(w / 2, -h / 2, w / 2, h / 2, -1, 0, 1); side(w / 2, h / 2, -w / 2, h / 2, 0, -1, 2); side(-w / 2, h / 2, -w / 2, -h / 2, 1, 0, 3);
	pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y))); p.closePath();
	return p;
}
/**
 * A pile of separate paper sheets on one cell: each sheet gets seeded rotation, offset, deckle and tint variance,
 * lower sheets step down-right. Use for quantities (weights). Cheap enough live; cache per chunk for big boards.
 */
export function sheetPile(ctx: Ctx, q: CellRef, s: number, o: PileOpts): void {
	const dpr = o.dpr ?? 1, n = s >= 14 ? o.layers : 1, ins = o.inset ?? 0.07 * s, w = s - 2 * ins;
	const st = o.step ?? { x: Math.min(0.045 * s, 3.6), y: Math.min(0.07 * s, 5.6) };
	const rot = o.rotate ?? 0.05, off = o.offset ?? 0.035 * s, jit = s >= 14 ? (o.jitter ?? Math.min(0.035 * s, 2.8)) : 0, tv = o.tintVar ?? 0.05;
	for (let i = n - 1; i >= 0; i--) {
		const a = q.r, b = q.c, k = i + 1 + (o.seed ?? 0) * 8;
		const path = deckledSheet(w, w, jit, a, b, k);
		const fill = shade(o.fills[Math.min(i, o.fills.length - 1)] ?? '#000000', (hash(a, b, k, 9) - 0.5) * 2 * tv);
		ctx.save();
		ctx.translate(q.x + s / 2 + i * st.x + (hash(a, b, k, 1) - 0.5) * 2 * off, q.y + s / 2 + i * st.y + (hash(a, b, k, 2) - 0.5) * 2 * off);
		ctx.rotate((hash(a, b, k, 3) - 0.5) * 2 * rot);
		withShadow(ctx, o.contact ?? null, dpr, () => { ctx.fillStyle = fill; ctx.fill(path); });
		if (o.edge && s >= 10) { ctx.save(); ctx.clip(path); ctx.strokeStyle = o.edge; ctx.globalAlpha *= 0.75; ctx.lineWidth = 2; ctx.stroke(path); ctx.restore(); }
		if (i === 0 && o.label && s >= 40) { ctx.fillStyle = o.label.color; ctx.font = o.label.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha *= 0.88; ctx.rotate((hash(a, b, 7) - 0.5) * 0.1); ctx.fillText(o.label.text, 0, 1); }
		ctx.restore();
	}
}
export type LiftedOpts = { fill: string; edge?: string | null; lift: number; rotate?: number; radius?: number; shadow: string; dpr?: number };
/** A small square card lifted off the sheet by `lift` (0..1): rises, its shadow grows. Rotation is seeded by the caller. */
export function liftedCard(ctx: Ctx, cx: number, cy: number, size: number, o: LiftedOpts): void {
	const dpr = o.dpr ?? 1, l = o.lift, r = o.radius ?? size * 0.12;
	ctx.save(); ctx.translate(cx, cy - size * 0.05 * l); ctx.rotate(o.rotate ?? 0);
	const p = new Path2D(); p.roundRect(-size / 2, -size / 2, size, size, r);
	withShadow(ctx, { color: o.shadow, dx: size * 0.02, dy: Math.min((0.05 + 0.12 * l) * size, 7), blur: Math.min((0.08 + 0.16 * l) * size, 9) }, dpr, () => { ctx.fillStyle = o.fill; ctx.fill(p); });
	if (o.edge && size >= 8) { ctx.save(); ctx.clip(p); ctx.strokeStyle = o.edge; ctx.lineWidth = 2; ctx.stroke(p); ctx.restore(); }
	ctx.restore();
}
/**
 * Paint "flutter and settle": a dropped scrap of paper. t in 0..1 over DURATION.flutter.
 * Returns transforms to apply around the cell centre; rotation is a damped swing with seeded direction.
 */
export function flutter(t: number, seedA: number, seedB: number) {
	const k = EASE.pop(Math.max(0, Math.min(1, t))), dir = hash(seedA, seedB, 11) < 0.5 ? -1 : 1, u = Math.max(0, Math.min(1, t));
	return { dy: -0.18 * (1 - k), scale: 1.06 - 0.06 * k, rotate: dir * 0.12 * (1 - u) * (1 - u) * Math.cos(3 * Math.PI * u), shadow: 2 - k, alpha: Math.min(1, 0.4 + 1.2 * u) };
}
/**
 * Erase "peel away": the scrap lifts from a seeded corner, rotates about the opposite corner and fades.
 * t in 0..1 over DURATION.peel. `corner` = 0 TL, 1 TR, 2 BR, 3 BL is the corner that lifts.
 */
export function peelAway(t: number, seedA: number, seedB: number) {
	const u = EASE.peel(Math.max(0, Math.min(1, t))), corner = Math.floor(hash(seedA, seedB, 12) * 4);
	const pivot = [{ x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }, { x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }][corner]; // opposite corner, in cell units from centre
	return { corner, pivot, rotate: (corner % 2 ? 1 : -1) * 0.5 * u, lift: u, scale: 1 + 0.06 * u, shadow: 1 + 0.8 * u, alpha: 1 - u };
}
