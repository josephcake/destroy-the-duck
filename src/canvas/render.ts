// Canvas 2D renderer, Paper Cutout v2.1 (style.md §3, §4). Cost is
// proportional to content, not to viewport area: it walks Home (2,800 cells),
// board chunks in view and the trace overlay. Expensive bitmaps (walls, weight
// piles, pencil grid tiles, dot and frontier sprites) are baked once and blitted.
import { Board, Weight } from '../model/board';
import { Bounds, parseId } from '../model/cell';
import { TraceState } from '../learn/player';
import { K, LegacyMirror } from './mirror';
import { WallCache, drawWalls, paintWalls } from './walls';
import { padLabel } from '../model/nodes';
import { Palette, weightColor, weightTier, weightUnder } from './palette';
import { CELL, View, cellToScreen, visibleBounds } from './view';
import {
	CellRef, DURATION, EASE, Shadow, cached, elevation, hash, liftedCard, maskAt, paperSheet, paperStack, pencilGrid, punchDot, punchHole, sheetPile, shapeWithBox, sticker, threadPath,
} from '../vendor/paper-kit/paper-kit';

const FRONTIER_PULSE_MAX = 2000;
const PULSE_MS = DURATION.pulse; // 900
/** Frontier lift l in [0, 1]: 0.5 - 0.5 cos(2πt / 900 ms) (§4.8). */
export function frontierLift(now: number) {
	return 0.5 - 0.5 * Math.cos((2 * Math.PI * (now % PULSE_MS)) / PULSE_MS);
}
/** Kept for callers/tests of the Pond pulse: 0.55..1 over 900 ms. */
export function frontierAlpha(now: number) {
	return 0.55 + 0.45 * frontierLift(now);
}

export type Scene = {
	view: View;
	width: number;
	height: number;
	dpr: number;
	palette: Palette;
	board: Board;
	mirror: LegacyMirror;
	trace: TraceState | null;
	traceTimes: Map<string, number>; // node -> ms when it became visited
	learnCurrent: boolean; // ring the current trace node (Learn mode)
	hover: { r: number; c: number } | null;
	bestPath: { r: number; c: number }[] | null;
	/** the classic window to outline, or null (the default: nothing marks it) */
	classicWindow?: Bounds | null;
	/** an Arrow or Duck being dragged outside the classic window: drawn faint under the pointer */
	ghost?: { kind: 'start' | 'end'; r: number; c: number } | null;
	now: number;
	/** ms of the last change (edit, view, search step); the duck bob runs 3 cycles after it */
	activeAt: number;
	reducedMotion: boolean;
};

const ENTER_MS = DURATION.enter; // 480
const BOB_MS = DURATION.bob; // 2400
const CHUNK = 16;
const BAKE_CAP = 1100; // §8: K·s·dpr ≤ 1100, else draw live
const pathStarts = new Map<string, number>();
const wallCaches = new WeakMap<object, WallCache>();

type Layer = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** An offscreen bitmap, or null where there is no canvas (jsdom). */
function mkLayer(w: number, h: number): [Layer, Ctx2D] | null {
	w = Math.max(1, Math.ceil(w));
	h = Math.max(1, Math.ceil(h));
	let l: Layer | null = null;
	if (typeof OffscreenCanvas !== 'undefined') l = new OffscreenCanvas(w, h);
	else if (typeof document !== 'undefined') {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		l = c;
	}
	const c = l?.getContext('2d') as Ctx2D | null | undefined;
	return l && c ? [l, c] : null;
}
const contactOf = (p: Palette, s: number): Shadow => ({ color: p.contact, ...elevation(s).contact });

export function isWallAt(scene: Scene, r: number, c: number) {
	if (scene.mirror.inWindow(r, c)) return scene.mirror.at(r, c) === K.Wall;
	return scene.board.get(r, c)?.kind === 'wall';
}

/** True while something is still animating. */
export function render(ctx: CanvasRenderingContext2D, scene: Scene): boolean {
	const { view, width, height, dpr, palette: p } = scene;
	const motion = !scene.reducedMotion;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const vb = visibleBounds(view, width, height);
	const s = CELL * view.zoom;
	let animating = false;
	const pan = { x: view.panX, y: view.panY };

	// §3 one endless sheet: the same paper and grid everywhere (no Home sheet, no lit box)
	if (p.fibre) {
		paperSheet(ctx, 0, 0, width, height, { fill: p.home, fibre: { seed: 7, ink: p.fibre.ink, alpha: p.fibre.strength, grain: p.fibre.grain }, fibreAlpha: p.fibre.alpha, vignette: p.fibre.vignette * 0.8, vignetteRGB: p.fibre.vignetteRGB, patternOffset: pan, dpr });
	} else {
		ctx.fillStyle = p.home;
		ctx.fillRect(0, 0, width, height);
	}

	// Grid: fades in between 25% and 50% (ga = clamp((zoom − .25)/.25))
	const ga = Math.max(0, Math.min(1, (view.zoom - 0.25) / 0.25));
	if (ga > 0) {
		if (p.pencil) drawPencilGrid(ctx, view, vb, s, p, dpr, ga);
		else drawCrispGrid(ctx, view, vb, s, p, dpr, ga);
	}

	// §4.2 weights: piles of sheets (Paper), merged flat sheets (Classic)
	drawWeights(ctx, scene, vb, s, dpr);

	// §4.1 walls: 2-ply card from per-chunk cached bitmaps (walls.ts)
	let cache = wallCaches.get(ctx);
	if (!cache) wallCaches.set(ctx, (cache = new WallCache()));
	const m = scene.mirror;
	const wallSrc = {
		isWall: (r: number, c: number) => isWallAt(scene, r, c),
		live: m.window,
		changedAt: (r: number, c: number) => {
			const i = m.index(r, c);
			return i < 0 ? 0 : m.changedAt[i];
		},
		erasedAt: (r: number, c: number) => {
			const i = m.index(r, c);
			if (i < 0) return 0;
			return m.prevKind?.[i] === K.Wall && m.kind[i] !== K.Wall ? m.changedAt[i] : 0;
		},
	};
	if (drawWalls(ctx, wallSrc, view, vb, p, dpr, scene.now, scene.reducedMotion, cache)) animating = true;

	// §4.7 visited: hole-punch confetti, on top of weight piles
	const dots = new DotDrawer(ctx, s, p, dpr);
	const enter = (born: number) => {
		if (!motion || born === 0) return 1;
		const t = Math.min(1, (scene.now - born) / ENTER_MS);
		if (t < 1) animating = true;
		return Math.max(0, EASE.pop(t));
	};
	if (m.visitedCount > 0)
		for (let i = 0; i < m.kind.length; i++)
			if (m.kind[i] === K.Visited) {
				const { r, c } = m.cellAt(i);
				if (r >= vb.r0 && r <= vb.r1 && c >= vb.c0 && c <= vb.c1) dots.add(r, c, view, enter(m.changedAt[i]), 1);
			}
	const tr = scene.trace;
	if (tr) {
		const total = Math.max(1, tr.visited.size);
		for (const [id, order] of tr.visited) {
			const { r, c } = parseId(id);
			if (r < vb.r0 || r > vb.r1 || c < vb.c0 || c > vb.c1) continue;
			dots.add(r, c, view, enter(scene.traceTimes.get(id) ?? 0), 1 - 0.2 * (1 - order / total)); // floor 0.8
		}
	}
	dots.flush();

	// §4.8 frontier: lifted card squares, pulsing (static l = .5 under reduced motion)
	if (tr) {
		const cells: { r: number; c: number }[] = [];
		for (const id of tr.frontier.keys()) {
			const q = parseId(id);
			if (q.r >= vb.r0 && q.r <= vb.r1 && q.c >= vb.c0 && q.c <= vb.c1) cells.push(q);
		}
		const pulse = motion && cells.length > 0 && cells.length <= FRONTIER_PULSE_MAX && !tr.done;
		const l = pulse ? frontierLift(scene.now) : 0.5;
		if (pulse) animating = true;
		drawFrontier(ctx, cells, view, s, p, dpr, l);
	}

	// §4.3 one-way and §4.4 teleporters (z2), over visited dots
	const padEnds = new Map<number, number[]>(); // pair -> keys in reading order
	const padLabels: { x: number; y: number; label: string; color: string; s: number }[] = []; // drawn above paths
	for (const [r, c, t] of scene.board.entries()) if (t.kind === 'pad') (padEnds.get(t.pair) ?? padEnds.set(t.pair, []).get(t.pair)!).push(r * 1e6 + c);
	for (const ends of padEnds.values()) ends.sort((a, b) => a - b);
	for (const [r, c, t] of scene.board.entries(vb)) {
		if ((t.kind !== 'oneway' && t.kind !== 'pad') || isWallAt(scene, r, c)) continue;
		const { x, y } = cellToScreen(view, r, c);
		if (t.kind === 'oneway') drawOneWay(ctx, x, y, s, t.dir, p, dpr);
		else {
			const ends = padEnds.get(t.pair) ?? [];
			const color = p.pads[t.pair % p.pads.length];
			drawPad(ctx, x + s / 2, y + s / 2, s, color, ends.length < 2, p, dpr);
			padLabels.push({ x: x + s / 2, y: y + s / 2, label: padLabel(t.pair, ends.indexOf(r * 1e6 + c) === 1), color, s });
		}
	}

	// Opt-in: the classic window's outline, only while a classic algorithm is
	// picked and something lies outside the 35x80 cells it can see.
	if (scene.classicWindow) {
		const w = scene.classicWindow;
		const a = cellToScreen(view, w.r0, w.c0);
		ctx.save();
		ctx.strokeStyle = p.homeLine;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([6, 4]);
		ctx.strokeRect(a.x - 1, a.y - 1, (w.c1 - w.c0 + 1) * s + 2, (w.r1 - w.r0 + 1) * s + 2);
		ctx.restore();
	}

	// §4.10 paths: stitched thread (traced path, and the classic Show Best Path preview)
	const drawPath = (cells: { r: number; c: number }[], animate: boolean) => {
		if (cells.length < 1) return;
		let k = 1;
		let tug = 0;
		let el = Infinity;
		if (animate && motion && cells.length > 1) {
			const a = cells[0], b = cells[cells.length - 1];
			const key = `${a.r},${a.c}>${b.r},${b.c}|${cells.length}`;
			let t0 = pathStarts.get(key);
			if (t0 === undefined) {
				if (pathStarts.size > 32) pathStarts.clear();
				pathStarts.set(key, (t0 = scene.now));
			}
			const drawMs = Math.min(DURATION.drawMax, DURATION.drawPerUnit * cells.length); // 12 ms/cell, ≤ 1.2 s, linear
			el = scene.now - t0;
			k = Math.min(1, el / drawMs);
			if (k < 1) animating = true;
			else if (el - drawMs < DURATION.tug) {
				tug = EASE.out((el - drawMs) / DURATION.tug); // one 240 ms tug, then still
				animating = true;
			} else tug = 1;
			el -= drawMs;
		}
		const pts: ({ x: number; y: number } | null)[] = [];
		const jumps: [{ x: number; y: number }, { x: number; y: number }, string][] = [];
		cells.forEach(({ r, c }, i) => {
			const q = cellToScreen(view, r, c);
			const pt = { x: q.x + s / 2, y: q.y + s / 2 };
			const prev = cells[i - 1];
			if (prev && Math.abs(prev.r - r) + Math.abs(prev.c - c) > 1) {
				// a teleporter jump splits the thread
				const a = cellToScreen(view, prev.r, prev.c);
				const from = { x: a.x + s / 2, y: a.y + s / 2 };
				const pad = scene.board.get(prev.r, prev.c);
				jumps.push([from, pt, pad?.kind === 'pad' ? p.pads[pad.pair % p.pads.length] : p.pads[0]]);
				pts.push(null);
			}
			pts.push(pt);
		});
		if (cells.length === 1) pts.push({ x: pts[0]!.x + 0.01, y: pts[0]!.y });
		threadPath(ctx, pts, {
			color: p.path, halo: p.home, width: Math.max(1.6, 0.11 * s), dash: [Math.max(4, 0.34 * s), Math.max(2.5, 0.17 * s)], progress: k, tug,
			knot: s >= 20, holes: s >= 20 ? { color: p.hole } : null, shadow: { color: p.contact, dx: 0.4, dy: Math.max(1, 0.045 * s), blur: Math.max(1, 0.06 * s) }, dpr,
		});
		if (k >= 1)
			for (const [a, b, col] of jumps) {
				// §4.4: fold trail in the pair colour, and a paper plane that flies once (420 ms)
				const ft = motion && el < DURATION.flight ? EASE.flight(Math.max(0, el) / DURATION.flight) : 1;
				if (ft < 1) animating = true;
				drawJump(ctx, a, b, s, col, p, ft, motion);
			}
	};
	if (tr) for (const g of tr.paths) drawPath(g.nodes.map(parseId), true);
	if (scene.bestPath && scene.bestPath.length && !m.previewOrder.length) drawPath(scene.bestPath, true);
	if (m.previewOrder.length) {
		const cells = m.previewOrder.map((i) => m.cellAt(i));
		if (m.start >= 0) cells.unshift(m.cellAt(m.start));
		drawPath(cells, false); // the classic player already animates it
	}

	// Pair letters sit above paths (a jump starts and ends on a pad)
	for (const t of padLabels) drawPadLetter(ctx, t.x, t.y, t.s, t.label, t.color, p, dpr);

	// Learn: ring the node the current event is about
	if (tr && scene.learnCurrent && tr.current) {
		const { r, c } = parseId(tr.current);
		const { x, y } = cellToScreen(view, r, c);
		ctx.strokeStyle = p.ink;
		ctx.lineWidth = Math.max(2, 0.12 * s);
		roundRect(ctx, x - 0.08 * s, y - 0.08 * s, s * 1.16, s * 1.16, 0.3 * s);
		ctx.stroke();
	}

	// §4.5 / §4.6 characters (z3): start tab and duck stickers
	const duckCell = m.end >= 0 ? m.cellAt(m.end) : null;
	if (m.start >= 0) {
		const a = m.cellAt(m.start);
		const q = cellToScreen(view, a.r, a.c);
		const ang = duckCell ? Math.atan2(duckCell.r - a.r, duckCell.c - a.c) : 0;
		drawStart(ctx, q.x + s / 2, q.y + s / 2, s, ang, p, dpr);
	}
	// §4.5 v2.2: 3 cycles after the last change, then still (an endless bob kept the frame loop busy)
	const age = scene.now - scene.activeAt;
	const bob = motion && age < 3 * BOB_MS ? 0.03 * s * Math.sin((2 * Math.PI * age) / BOB_MS) : 0;
	const extra: { n: number; r: number; c: number }[] = [];
	for (const [r, c, t] of scene.board.entries(vb)) if (t.kind === 'duck' && !isWallAt(scene, r, c)) extra.push({ n: t.n, r, c });
	const multi = extra.length > 0 || [...scene.board.entries()].some(([, , t]) => t.kind === 'duck');
	const reached = (n: number) => !!(tr && tr.done && (tr.trace.result.paths ?? []).some((q) => q.duck === n));
	const order = [...scene.board.entries()].filter(([, , t]) => t.kind === 'duck').map(([, , t]) => (t as { n: number }).n).sort((a, b) => a - b);
	const ducks: { r: number; c: number; n: number | null; found: boolean }[] = [];
	if (duckCell) ducks.push({ ...duckCell, n: multi ? 1 : null, found: multi ? reached(1) : !!(tr && tr.trace.result.found && tr.done) });
	for (const d of extra) ducks.push({ r: d.r, c: d.c, n: order.indexOf(d.n) + 2, found: reached(order.indexOf(d.n) + 2) });
	for (const d of ducks) {
		const q = cellToScreen(view, d.r, d.c);
		drawDuck(ctx, q.x + s / 2, q.y + s / 2 + bob, s, p, dpr);
		if (d.n !== null) drawDuckBadge(ctx, q.x + s / 2, q.y + s / 2 + bob, s, d.n, d.found, p, dpr);
	}
	if (motion && age < 3 * BOB_MS && ducks.length) animating = true; // bob still running (off under reduced motion)

	// an Arrow or Duck dragged past the classic window: a faint sticker under the pointer until the drop
	if (scene.ghost) {
		const g = scene.ghost;
		const q = cellToScreen(view, g.r, g.c);
		ctx.save();
		ctx.globalAlpha = 0.55;
		if (g.kind === 'start') drawStart(ctx, q.x + s / 2, q.y + s / 2, s, 0, p, dpr);
		else drawDuck(ctx, q.x + s / 2, q.y + s / 2, s, p, dpr);
		ctx.restore();
	}

	// §4.9 hover: a rounded pencil guide
	if (scene.hover) {
		const { x, y } = cellToScreen(view, scene.hover.r, scene.hover.c);
		ctx.save();
		ctx.strokeStyle = p.ink;
		ctx.globalAlpha = 0.45;
		ctx.lineWidth = 1.5;
		ctx.setLineDash([3, 3]);
		roundRect(ctx, x + 0.06 * s, y + 0.06 * s, s - 0.12 * s, s - 0.12 * s, 0.14 * s);
		ctx.stroke();
		ctx.restore();
	}
	return animating;
}

// ------------------------------------------------------------------ grid
type Pt = { x: number; y: number };
function drawPencilGrid(ctx: CanvasRenderingContext2D, view: View, vb: ReturnType<typeof visibleBounds>, s: number, p: Palette, dpr: number, ga: number) {
	// §3 hand-ruled grid, baked per 16x16 tile (seeded by tile, so panning never re-rolls it);
	// above the bitmap cap, live ruled lines in the pencil colour. One grid everywhere.
	const tile = CHUNK * s;
	ctx.save();
	ctx.globalAlpha = ga;
	if (tile * dpr <= BAKE_CAP) {
		for (let cr = Math.floor(vb.r0 / CHUNK); cr <= Math.floor(vb.r1 / CHUNK); cr++)
			for (let cc = Math.floor(vb.c0 / CHUNK); cc <= Math.floor(vb.c1 / CHUNK); cc++) {
				const o = cellToScreen(view, cr * CHUNK, cc * CHUNK);
				pencilGrid(ctx, Math.round(o.x * dpr) / dpr - s, Math.round(o.y * dpr) / dpr - s, tile + s + 1, tile + s + 1, s, { color: p.pencil!, alpha: 1, pressed: p.pencilPressed, seed: 3 + ((cr * 7919 + cc * 104729) & 0xffff), dpr });
			}
	} else {
		ctx.lineWidth = 1;
		for (const [col, dy] of [[p.pencilPressed, 1], [p.pencil, 0]] as const) {
			if (!col) continue;
			ctx.strokeStyle = col;
			ctx.beginPath();
			for (let c = vb.c0; c <= vb.c1 + 1; c++) {
				const x = Math.round((view.panX + c * s) * dpr) / dpr + 0.5 + dy;
				ctx.moveTo(x, view.panY + vb.r0 * s);
				ctx.lineTo(x, view.panY + (vb.r1 + 1) * s);
			}
			for (let r = vb.r0; r <= vb.r1 + 1; r++) {
				const y = Math.round((view.panY + r * s) * dpr) / dpr + 0.5 + dy;
				ctx.moveTo(view.panX + vb.c0 * s, y);
				ctx.lineTo(view.panX + (vb.c1 + 1) * s, y);
			}
			ctx.stroke();
		}
	}
	ctx.restore();
}
function drawCrispGrid(ctx: CanvasRenderingContext2D, view: View, vb: ReturnType<typeof visibleBounds>, s: number, p: Palette, dpr: number, ga: number) {
	ctx.lineWidth = 1 / dpr;
	ctx.globalAlpha = ga;
	ctx.strokeStyle = p.grid;
	ctx.beginPath();
	for (let c = vb.c0; c <= vb.c1; c++) {
		const x = Math.round((view.panX + c * s) * dpr) / dpr;
		ctx.moveTo(x, view.panY + vb.r0 * s);
		ctx.lineTo(x, view.panY + vb.r1 * s);
	}
	for (let r = vb.r0; r <= vb.r1; r++) {
		const y = Math.round((view.panY + r * s) * dpr) / dpr;
		ctx.moveTo(view.panX + vb.c0 * s, y);
		ctx.lineTo(view.panX + vb.c1 * s, y);
	}
	ctx.stroke();
	ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ weights
const W_LAYERS = [1, 2, 3, 4];
function drawWeights(ctx: CanvasRenderingContext2D, scene: Scene, vb: ReturnType<typeof visibleBounds>, s: number, dpr: number) {
	const { view, palette: p } = scene;
	const byChunk = new Map<string, { cr: number; cc: number; cells: [number, number, Weight][] }>();
	for (const [r, c, t] of scene.board.entries(vb)) {
		if (t.kind !== 'weight' || isWallAt(scene, r, c)) continue;
		const cr = Math.floor(r / CHUNK), cc = Math.floor(c / CHUNK), k = `${cr},${cc}`;
		(byChunk.get(k) ?? byChunk.set(k, { cr, cc, cells: [] }).get(k)!).cells.push([r, c, t.cost]);
	}
	if (!byChunk.size) return;
	const same = (cost: number) => (r: number, c: number) => {
		const t = scene.board.get(r, c);
		return !!t && t.kind === 'weight' && t.cost === cost && !isWallAt(scene, r, c);
	};
	// paint one chunk's weights with (ox, oy) = screen position of cell (cr*16, cc*16)
	const paint = (c2: Ctx2D, cr: number, cc: number, cells: [number, number, Weight][], ox: number, oy: number) => {
		const at = (r: number, c: number) => ({ x: ox + (c - cc * CHUNK) * s, y: oy + (r - cr * CHUNK) * s });
		if (!p.classic) {
			// v2.1: separate piles (no merging in Paper); reading order so lower-right piles overlap
			for (const [r, c, cost] of cells) {
				const tier = weightTier(cost);
				sheetPile(c2, { ...at(r, c), r, c, mask: 0 }, s, {
					layers: W_LAYERS[tier], fills: [weightColor(p, cost), weightUnder(p, cost)], edge: p.wEdge, contact: contactOf(p, s), dpr, rotate: 0.06, tintVar: 0.06,
					label: { text: String(cost), color: p.stamp, font: `800 ${Math.round(0.4 * s)}px Fraunces, Georgia, serif` },
				});
			}
			return;
		}
		// Classic: flat merged sheets (66c97df's same-cost union), cost on each cell from 200%
		for (const cost of [2, 5, 10] as Weight[]) {
			const refs: CellRef[] = cells.filter(([, , w]) => w === cost).map(([r, c]) => ({ ...at(r, c), r, c, mask: maskAt(same(cost), r, c) }));
			if (!refs.length) continue;
			paperStack(c2 as CanvasRenderingContext2D, refs, s, { layers: 1, top: weightColor(p, cost), under: weightUnder(p, cost), edge: p.wEdge, radius: s < 6 ? 0 : 0.1 * s, inset: 0.06 * s, dpr, label: { text: String(cost), color: p.stamp, font: `700 ${Math.round(0.34 * s)}px "DM Mono", monospace` } });
		}
	};
	const tile = CHUNK * s, pad = Math.ceil(0.3 * s) + 8;
	for (const { cr, cc, cells } of byChunk.values()) {
		const o = cellToScreen(view, cr * CHUNK, cc * CHUNK);
		if ((tile + 2 * pad) * dpr > BAKE_CAP + 200) {
			paint(ctx, cr, cc, cells, o.x, o.y);
			continue;
		}
		let sig = 2166136261;
		for (const [r, c, w] of cells) sig = Math.imul(sig ^ (r * 4099 + c * 7 + w), 16777619);
		// Classic merges across chunk edges, so its signature includes the neighbour masks
		if (p.classic) for (const [r, c, w] of cells) sig = Math.imul(sig ^ maskAt(same(w), r, c), 16777619);
		const img = cached(`w|${p.name}|${s}|${dpr}|${cr},${cc}|${sig}|${cells.length}`, () => {
			const L = mkLayer((tile + 2 * pad) * dpr, (tile + 2 * pad) * dpr);
			if (!L) return null;
			L[1].setTransform(dpr, 0, 0, dpr, 0, 0);
			paint(L[1], cr, cc, cells, pad, pad);
			return L[0];
		});
		if (img) ctx.drawImage(img as CanvasImageSource, Math.round((o.x - pad) * dpr) / dpr, Math.round((o.y - pad) * dpr) / dpr, tile + 2 * pad, tile + 2 * pad);
		else paint(ctx, cr, cc, cells, o.x, o.y);
	}
}

// ------------------------------------------------------------------ visited
/** Confetti dots from 3 cached sprites (§8: drawImage, never shadowBlur per dot). Below 8 px: batched squares. */
class DotDrawer {
	private squares: [Path2D | null, Path2D | null, Path2D | null] = [null, null, null];
	private sprites: (Layer | null)[];
	private pad: number;
	private R: number;
	constructor(private ctx: CanvasRenderingContext2D, private s: number, private p: Palette, private dpr: number) {
		this.R = Math.round(0.3 * s * 2) / 2; // quantised so zoom animations reuse sprites
		this.pad = Math.ceil(this.R * 1.2 + 6);
		this.sprites = s < 8 ? [] : p.vis.map((fill) => cached(`vdot|${fill}|${this.R}|${s >= 14}|${s >= 20}|${dpr}`, () => {
			const L = mkLayer(2 * this.pad * dpr, 2 * this.pad * dpr);
			if (!L) return null;
			L[1].setTransform(dpr, 0, 0, dpr, 0, 0);
			punchDot(L[1], this.pad, this.pad, this.R, { fill, rim: s >= 20 ? 'rgba(255,255,255,0.32)' : null, contact: s >= 14 ? { color: p.contact, dx: 0.3, dy: Math.max(0.7, 0.025 * s), blur: Math.min(0.045 * s, 3) } : null, dpr });
			return L[0];
		}));
	}
	add(r: number, c: number, view: View, k: number, fade: number) {
		const { x, y } = cellToScreen(view, r, c);
		const s = this.s, tint = Math.floor(hash(r, c, 3) * 3);
		if (s < 8) {
			const sq = (this.squares[tint] ??= new Path2D());
			sq.rect(x, y, s, s);
			return;
		}
		if (k <= 0.01) return;
		const img = this.sprites[tint];
		const jx = (hash(r, c, 1) - 0.5) * 0.1 * s, jy = (hash(r, c, 2) - 0.5) * 0.1 * s; // ±0.05 s
		const size = (1 + (hash(r, c, 4) - 0.5) * 0.24) * k; // ±12%, enter 0 -> 1
		const squash = 1 - 0.12 * hash(r, c, 5);
		const ctx = this.ctx;
		ctx.save();
		ctx.globalAlpha = fade;
		ctx.translate(x + s / 2 + jx, y + s / 2 + jy);
		ctx.rotate(hash(r, c, 6) * Math.PI);
		ctx.scale(size, size * squash);
		if (img) ctx.drawImage(img as CanvasImageSource, -this.pad, -this.pad, 2 * this.pad, 2 * this.pad);
		else {
			ctx.fillStyle = this.p.vis[tint];
			ctx.beginPath();
			ctx.arc(0, 0, this.R, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}
	flush() {
		this.squares.forEach((sq, i) => {
			if (!sq) return;
			this.ctx.fillStyle = this.p.vis[i];
			this.ctx.fill(sq);
		});
	}
}

// ------------------------------------------------------------------ frontier
function drawFrontier(ctx: CanvasRenderingContext2D, cells: { r: number; c: number }[], view: View, s: number, p: Palette, dpr: number, l: number) {
	if (!cells.length) return;
	const size = 0.74 * s;
	if (p.classic || s < 8) {
		// Classic: flat squares, no lift
		ctx.fillStyle = p.front;
		ctx.beginPath();
		for (const { r, c } of cells) {
			const { x, y } = cellToScreen(view, r, c);
			roundRectPath(ctx, x + s / 2 - size / 2, y + s / 2 - size / 2, size, size, [0.12 * size, 0.12 * size, 0.12 * size, 0.12 * size]);
		}
		ctx.fill();
		if (p.frontEdge !== p.front && s >= 8) {
			ctx.strokeStyle = p.frontEdge;
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		return;
	}
	// baked sprites at 9 lift levels; the nearest is blitted (§8: no per-card shadowBlur).
	// (A 2-sprite crossfade left the card ~25% see-through mid-pulse, which read brown on navy.)
	const S = Math.round(s * 2) / 2, pad = Math.ceil(size / 2 + 12);
	const sprite = (lift: number) => cached(`front|${p.name}|${S}|${lift}|${dpr}`, () => {
		const L = mkLayer(2 * pad * dpr, 2 * pad * dpr);
		if (!L) return null;
		L[1].setTransform(dpr, 0, 0, dpr, 0, 0);
		liftedCard(L[1], pad, pad, 0.74 * S, { fill: p.front, edge: p.frontEdge, lift, shadow: p.shadow, dpr });
		return L[0];
	});
	const LEVELS = 8;
	const img = sprite(Math.round(l * LEVELS) / LEVELS);
	for (const { r, c } of cells) {
		const { x, y } = cellToScreen(view, r, c);
		const rot = (hash(r, c, 21) - 0.5) * 0.14; // ±0.07 rad
		if (!img) {
			liftedCard(ctx, x + s / 2, y + s / 2, size, { fill: p.front, edge: p.frontEdge, lift: l, rotate: rot, shadow: p.shadow, dpr });
			continue;
		}
		ctx.save();
		ctx.translate(x + s / 2, y + s / 2);
		ctx.rotate(rot);
		ctx.drawImage(img as CanvasImageSource, -pad, -pad, 2 * pad, 2 * pad);
		ctx.restore();
	}
}

// ------------------------------------------------------------------ one-way, teleporters, jump
/** Chevron pointing +x, centred (Prism's paper.js shape); arms ±0.22 s, bar 0.13 s. */
function chevron(ctx: Ctx2D, s: number) {
	const a = 0.22 * s, b = 0.13 * s;
	ctx.beginPath();
	ctx.moveTo(-a * 0.7, -a);
	ctx.lineTo(-a * 0.7 + b, -a);
	ctx.lineTo(a * 0.75, 0);
	ctx.lineTo(-a * 0.7 + b, a);
	ctx.lineTo(-a * 0.7, a);
	ctx.lineTo(a * 0.75 - b, 0);
	ctx.closePath();
}
function drawOneWay(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, p: Palette, dpr: number) {
	const ang = ((dir - 1) * Math.PI) / 2; // model: 0 N, 1 E, 2 S, 3 W; the chevron points E at 0
	const cx = x + s / 2, cy = y + s / 2;
	if (s < 10) {
		// below 10 px: no tile, a solid chevron at 1.2x
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(ang);
		chevron(ctx, s * 1.2);
		ctx.fillStyle = p.onewayFg;
		ctx.fill();
		ctx.restore();
		return;
	}
	const ins = 0.08 * s;
	ctx.save();
	ctx.beginPath();
	roundRectPath(ctx, x + ins, y + ins, s - 2 * ins, s - 2 * ins, [0.14 * s, 0.14 * s, 0.14 * s, 0.14 * s]);
	ctx.save();
	ctx.shadowColor = p.contact;
	ctx.shadowOffsetY = Math.max(1, 0.03 * s) * dpr;
	ctx.shadowBlur = Math.min(0.06 * s, 4) * dpr;
	ctx.fillStyle = p.oneway;
	ctx.fill();
	ctx.restore();
	ctx.save();
	ctx.clip();
	ctx.strokeStyle = p.onewayFg;
	ctx.lineWidth = 2; // 1dp inside the clip
	ctx.stroke();
	ctx.restore();
	// punched chevron: the hole colour with an inner shadow along the up-facing edge
	ctx.translate(cx, cy);
	ctx.rotate(ang);
	chevron(ctx, s);
	ctx.fillStyle = p.hole;
	ctx.fill();
	ctx.clip();
	ctx.rotate(-ang);
	ctx.shadowColor = p.holeShadow;
	ctx.shadowBlur = Math.max(1, 0.05 * s) * dpr;
	ctx.shadowOffsetY = Math.max(1, 0.04 * s) * dpr;
	ctx.beginPath();
	ctx.rect(-s, -s, 2 * s, 2 * s);
	ctx.rotate(ang);
	const a = 0.22 * s, b = 0.13 * s;
	ctx.moveTo(-a * 0.7, -a);
	ctx.lineTo(a * 0.75 - b, 0);
	ctx.lineTo(-a * 0.7, a);
	ctx.lineTo(-a * 0.7 + b, a);
	ctx.lineTo(a * 0.75, 0);
	ctx.lineTo(-a * 0.7 + b, -a);
	ctx.closePath();
	ctx.fillStyle = p.holeShadow;
	ctx.fill('evenodd');
	ctx.restore();
}

/** §4.4 + gate: ring radius; at least 5 px so pairs still read at 35 % on phones. */
export const padRing = (s: number) => ({ ri: Math.max(1.5, 0.24 * s), ro: Math.max(5, 0.44 * s) });
function drawPad(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, lone: boolean, p: Palette, dpr: number) {
	const { ri, ro } = padRing(s);
	const TAU = Math.PI * 2;
	ctx.save();
	if (lone) ctx.globalAlpha = 0.6; // with a dashed outline below: "no partner yet"
	punchHole(ctx, cx, cy, ri, { hole: p.hole, innerShadow: p.holeShadow, dpr });
	const rin = ri + 0.05 * s;
	const ring = new Path2D();
	ring.arc(0, 0, ro, 0, TAU);
	ring.moveTo(rin, 0);
	ring.arc(0, 0, rin, 0, TAU, true);
	if (s >= 10) sticker(ctx, cx, cy, ring, { fill: color, border: p.sticker, borderWidth: Math.max(1, 0.045 * s), edge: p.stickerEdge, contact: contactOf(p, s), peel: 0.3, curl: false, dpr });
	else {
		ctx.translate(cx, cy);
		ctx.fillStyle = color;
		ctx.fill(ring);
		ctx.translate(-cx, -cy);
	}
	ctx.restore();
	if (lone) {
		ctx.save();
		ctx.strokeStyle = color;
		ctx.lineWidth = Math.max(1.5, 0.06 * s);
		ctx.setLineDash([Math.max(2, 0.12 * s), Math.max(2, 0.1 * s)]);
		ctx.beginPath();
		ctx.arc(cx, cy, ro + Math.max(2, 0.08 * s), 0, TAU);
		ctx.stroke();
		ctx.restore();
	}
}
/**
 * Pair letter. From 200 %: in the hole, white at .9, Figtree 800 at 0.22 s (§4.4).
 * Below that (gate: letters vanished at 35 % on phones), a small letter tag on the ring's
 * top-right, like the duck badge, so pairs are still told apart by letter as well as colour.
 */
export function padLetterGeometry(cx: number, cy: number, s: number) {
	if (s >= 40) return { inHole: true, x: cx, y: cy, r: 0 };
	const { ro } = padRing(s);
	const r = 6.5;
	return { inHole: false, x: cx + ro * 0.75, y: cy - ro * 0.75, r };
}
function drawPadLetter(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, label: string, color: string, p: Palette, dpr: number) {
	const g = padLetterGeometry(cx, cy, s);
	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	if (g.inHole) {
		ctx.globalAlpha = 0.9;
		ctx.fillStyle = '#ffffff';
		ctx.font = `800 ${Math.round((label.length > 1 ? 0.2 : 0.22) * s)}px Figtree, system-ui, sans-serif`;
		ctx.fillText(label, cx, cy + 1);
		ctx.restore();
		return;
	}
	const w = label.length > 1 ? g.r * 1.5 : g.r;
	const tag = shapeWithBox((q) => q.roundRect(-w, -g.r, 2 * w, 2 * g.r, g.r), { x: -w, y: -g.r, w: 2 * w, h: 2 * g.r });
	sticker(ctx, g.x, g.y, tag, { fill: color, border: p.sticker, borderWidth: 1, edge: p.stickerEdge, contact: { color: p.contact, dx: 0, dy: 1, blur: 2 }, dpr }, (c) => {
		c.fillStyle = '#ffffff';
		c.font = `800 9px Figtree, system-ui, sans-serif`;
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.fillText(label, 0, 0.5);
	});
	ctx.restore();
}

function drawJump(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, s: number, color: string, p: Palette, t: number, motion: boolean) {
	// quadratic arc, apex 25% of the distance above the midpoint
	const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - Math.max(2 * s, 0.25 * Math.hypot(b.x - a.x, b.y - a.y));
	const pt = (u: number) => ({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y });
	ctx.save();
	ctx.setLineDash([Math.max(3, 0.18 * s), Math.max(3, 0.14 * s)]);
	ctx.strokeStyle = color;
	ctx.globalAlpha = 0.75;
	ctx.lineWidth = Math.max(1.5, 0.06 * s);
	ctx.beginPath();
	ctx.moveTo(a.x, a.y);
	for (let u = 0.02; u <= t + 1e-6; u += 0.02) {
		const q = pt(u);
		ctx.lineTo(q.x, q.y);
	}
	ctx.stroke();
	ctx.restore();
	if (!motion || t >= 1) return; // the plane only shows in flight; reduced motion: the trail only
	const u = Math.min(0.98, t), q0 = pt(u), q1 = pt(u + 0.02);
	drawPlane(ctx, q0.x, q0.y, Math.max(16, 0.95 * s), Math.atan2(q1.y - q0.y, q1.x - q0.x), p);
}
function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, u: number, ang: number, p: Palette) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(ang);
	ctx.shadowColor = p.contact;
	ctx.shadowOffsetY = u * 0.12;
	ctx.shadowBlur = u * 0.2;
	ctx.beginPath();
	ctx.moveTo(u * 0.55, 0);
	ctx.lineTo(-u * 0.45, -u * 0.38);
	ctx.lineTo(-u * 0.2, 0);
	ctx.closePath();
	ctx.fillStyle = p.sticker;
	ctx.fill();
	ctx.shadowColor = 'transparent';
	ctx.beginPath();
	ctx.moveTo(u * 0.55, 0);
	ctx.lineTo(-u * 0.45, u * 0.38);
	ctx.lineTo(-u * 0.2, 0);
	ctx.closePath();
	ctx.fillStyle = p.stickerEdge;
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(u * 0.55, 0);
	ctx.lineTo(-u * 0.2, 0);
	ctx.strokeStyle = p.ink;
	ctx.globalAlpha = 0.35;
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------------ start tab, duck, badge
function drawStart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, ang: number, p: Palette, dpr: number) {
	const u = Math.max(1.2 * s, 16);
	const build = (q: Path2D | Ctx2D) => {
		q.moveTo(-0.42 * u, -0.04 * u);
		q.lineTo(-0.22 * u, -0.24 * u);
		q.lineTo(0.12 * u, -0.24 * u);
		q.lineTo(0.44 * u, 0);
		q.lineTo(0.12 * u, 0.24 * u);
		q.lineTo(-0.42 * u, 0.24 * u);
		q.closePath();
	};
	const tab = shapeWithBox((q) => build(q), { x: -0.42 * u, y: -0.24 * u, w: 0.86 * u, h: 0.48 * u });
	sticker(ctx, cx, cy, tab, { fill: p.start, border: p.sticker, borderWidth: Math.max(1.5, 0.06 * u), edge: p.stickerEdge, peel: p.classic ? 0 : 0.5, rotate: ang, contact: { color: p.contact, dx: 0.5, dy: Math.max(1, 0.05 * u), blur: Math.min(0.09 * u, 5) }, dpr }, (c) => {
		c.beginPath();
		c.moveTo(-0.42 * u, -0.04 * u);
		c.lineTo(-0.22 * u, -0.24 * u);
		c.lineTo(-0.22 * u, -0.04 * u);
		c.closePath();
		c.shadowColor = 'rgba(0,0,0,0.28)';
		c.shadowOffsetX = 0.02 * u * dpr;
		c.shadowOffsetY = 0.02 * u * dpr;
		c.shadowBlur = 0.03 * u * dpr;
		c.fillStyle = p.arrowBack;
		c.fill();
	});
	if (p.startOutline) {
		// Classic Light: the fill is 2.55:1, so a 1dp outline carries the 3:1
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(ang);
		ctx.beginPath();
		build(ctx);
		ctx.strokeStyle = p.startOutline;
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.restore();
	}
}

function duckSilhouette(u: number) {
	return shapeWithBox((q) => {
		q.ellipse(-0.04 * u, 0.12 * u, 0.36 * u, 0.25 * u, 0, 0, Math.PI * 2);
		q.moveTo(0.34 * u, -0.14 * u);
		q.arc(0.16 * u, -0.14 * u, 0.18 * u, 0, Math.PI * 2);
		q.moveTo(0.29 * u, -0.2 * u);
		q.lineTo(0.52 * u, -0.13 * u);
		q.lineTo(0.5 * u, -0.1 * u);
		q.lineTo(0.3 * u, -0.06 * u);
		q.closePath();
		q.moveTo(-0.38 * u, 0.02 * u);
		q.lineTo(-0.48 * u, -0.1 * u);
		q.lineTo(-0.3 * u, -0.02 * u);
		q.closePath();
	}, { x: -0.48 * u, y: -0.32 * u, w: 1.0 * u, h: 0.69 * u });
}
/** The cut-paper duck sticker (§4.5): body, wing, two-ply beak, eye. Overflows its cell. */
export function drawDuck(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, p: Palette, dpr: number) {
	const u = Math.max(1.3 * s, 16);
	sticker(ctx, cx, cy, duckSilhouette(u), { fill: p.duck, border: p.sticker, borderWidth: Math.max(1.5, 0.07 * u), edge: p.stickerEdge, peel: p.classic ? 0 : 0.7, curl: false, contact: { color: p.contact, dx: 0.5, dy: Math.max(1.2, 0.05 * u), blur: Math.min(0.1 * u, 6) }, dpr }, (c) => {
		const layer = (build: (q: Path2D) => void, fill: string) => {
			const q = new Path2D();
			build(q);
			c.save();
			c.shadowColor = p.contact;
			c.shadowOffsetY = Math.max(1, 0.03 * u) * dpr;
			c.shadowBlur = Math.min(0.05 * u, 4) * dpr;
			c.fillStyle = fill;
			c.fill(q);
			c.restore();
		};
		layer((q) => { q.moveTo(-0.26 * u, 0.06 * u); q.quadraticCurveTo(-0.02 * u, -0.02 * u, 0.12 * u, 0.12 * u); q.quadraticCurveTo(-0.06 * u, 0.3 * u, -0.26 * u, 0.06 * u); }, p.duckWing);
		layer((q) => { q.moveTo(0.3 * u, -0.15 * u); q.lineTo(0.5 * u, -0.1 * u); q.lineTo(0.3 * u, -0.06 * u); q.closePath(); }, p.beak2);
		layer((q) => { q.moveTo(0.29 * u, -0.2 * u); q.lineTo(0.52 * u, -0.13 * u); q.lineTo(0.3 * u, -0.1 * u); q.closePath(); }, p.beak);
		c.beginPath();
		c.arc(0.2 * u, -0.19 * u, Math.max(1.2, 0.045 * u), 0, Math.PI * 2);
		c.fillStyle = p.eye;
		c.fill();
		if (u >= 20) {
			c.beginPath();
			c.arc(0.212 * u, -0.202 * u, Math.max(0.6, 0.014 * u), 0, Math.PI * 2);
			c.fillStyle = '#fff';
			c.fill();
		}
	});
	// 1dp duckEdge on the body silhouette at .85 (§4.5)
	ctx.save();
	ctx.translate(cx, cy);
	ctx.globalAlpha = 0.85;
	ctx.strokeStyle = p.duckEdge;
	ctx.lineWidth = 1;
	ctx.stroke(duckSilhouette(u));
	ctx.restore();
}

/**
 * Duck number badge (§4.5 sticker badge): r = max(7, .17u) at (+.36u, −.38u) from the
 * duck's centre, u = max(1.3 s, 16). The 7 px floor keeps digits >= 9 px at every zoom
 * (Mochi check 3), so it shows from s >= 6, not only s >= 14.
 */
export function badgeGeometry(cx: number, cy: number, s: number) {
	const u = Math.max(1.3 * s, 16);
	const rad = Math.max(7, 0.17 * u);
	return { cx: cx + 0.36 * u, cy: cy - 0.38 * u, rad };
}
function drawDuckBadge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, n: number, found: boolean, p: Palette, dpr: number) {
	if (s < 6) return; // below 30 % the whole board is a thumbnail
	const { cx, cy, rad } = badgeGeometry(x, y, s);
	const u = Math.max(1.3 * s, 16);
	const circ = shapeWithBox((q) => q.arc(0, 0, rad, 0, Math.PI * 2), { x: -rad, y: -rad, w: 2 * rad, h: 2 * rad });
	sticker(ctx, cx, cy, circ, { fill: found ? p.vis[1] : p.sticker, border: p.sticker, borderWidth: Math.max(1, 0.03 * u), edge: p.stickerEdge, peel: 0.55, rotate: -0.12, contact: { color: p.contact, dx: 0, dy: 1, blur: 2 }, dpr }, (c) => {
		if (found) {
			// a drawn tick, not a glyph
			c.beginPath();
			c.moveTo(-0.45 * rad, 0.02 * rad);
			c.lineTo(-0.12 * rad, 0.36 * rad);
			c.lineTo(0.48 * rad, -0.34 * rad);
			c.strokeStyle = '#fff';
			c.lineWidth = Math.max(1.5, 0.22 * rad);
			c.lineCap = 'round';
			c.lineJoin = 'round';
			c.stroke();
			return;
		}
		c.fillStyle = '#2b2620';
		c.font = `800 ${Math.max(9, Math.round(rad * 1.15))}px Figtree, system-ui, sans-serif`;
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.fillText(String(n), 0, rad * 0.06);
	});
}

// ------------------------------------------------------------------ helpers
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	roundRectPath(ctx, x, y, w, h, [r, r, r, r]);
}
function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, rad: number[]) {
	const [tl, tr, br, bl] = rad.map((v) => Math.min(v, w / 2, h / 2));
	ctx.moveTo(x + tl, y);
	ctx.lineTo(x + w - tr, y);
	if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
	else ctx.lineTo(x + w, y);
	ctx.lineTo(x + w, y + h - br);
	if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
	else ctx.lineTo(x + w, y + h);
	ctx.lineTo(x + bl, y + h);
	if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
	else ctx.lineTo(x, y + h);
	ctx.lineTo(x, y + tl);
	if (tl) ctx.arcTo(x, y, x + tl, y, tl);
	else ctx.lineTo(x, y);
	ctx.closePath();
}

// ------------------------------------------------------------------ legend swatches
export type SwatchKind = 'start' | 'duck' | 'path' | 'wall' | 'visited' | 'unvisited' | 'frontier' | 'weight2' | 'weight5' | 'weight10' | 'oneway' | 'pad';
/** §6: legend swatches are the real canvas sprites, drawn into a 22 px square (CSS px). */
export function drawSwatch(ctx: CanvasRenderingContext2D, kind: SwatchKind, p: Palette, dpr: number, size = 22) {
	const Z = 22;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.setTransform((dpr * size) / Z, 0, 0, (dpr * size) / Z, 0, 0);
	const s = 16, x = (Z - s) / 2, y = (Z - s) / 2;
	const cell = (): CellRef => ({ x, y, r: 0, c: 0, mask: 0 });
	switch (kind) {
		case 'unvisited':
			ctx.fillStyle = p.home;
			ctx.fillRect(x, y, s, s);
			ctx.strokeStyle = p.homeLine;
			ctx.lineWidth = 1;
			ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
			return;
		case 'wall':
			paintWalls(ctx, [cell()], s, p, 'shadow', dpr);
			paintWalls(ctx, [cell()], s, p, 'body', dpr);
			return;
		case 'weight2':
		case 'weight5':
		case 'weight10': {
			const cost = kind === 'weight2' ? 2 : kind === 'weight5' ? 5 : 10;
			const tier = weightTier(cost);
			sheetPile(ctx, { x: 1, y: 2, r: 0, c: cost, mask: 0 }, 19, { layers: p.classic ? 1 : W_LAYERS[tier], fills: [weightColor(p, cost), weightUnder(p, cost)], edge: p.wEdge, contact: contactOf(p, 19), dpr, rotate: 0.06, tintVar: 0.06 });
			return;
		}
		case 'visited':
			if (p.classic) {
				ctx.fillStyle = p.visited;
				ctx.fillRect(x, y, s, s);
			} else punchDot(ctx, Z / 2, Z / 2, 6.5, { fill: p.vis[1], contact: { color: p.contact, dx: 0.3, dy: 0.8, blur: 1 }, dpr });
			return;
		case 'frontier':
			if (p.classic) {
				ctx.fillStyle = p.front;
				ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
			} else liftedCard(ctx, Z / 2, Z / 2, 14, { fill: p.front, edge: p.frontEdge, lift: 0.5, rotate: -0.06, shadow: p.shadow, dpr });
			return;
		case 'oneway':
			drawOneWay(ctx, 0, 0, Z, 1, p, dpr);
			return;
		case 'pad':
			drawPad(ctx, Z / 2, Z / 2, 20, p.pads[0], false, p, dpr);
			return;
		case 'path':
			threadPath(ctx, [{ x: 3, y: 16 }, { x: 11, y: 16 }, { x: 11, y: 6 }, { x: 19, y: 6 }], { color: p.path, halo: p.home, width: 2, dash: [4, 2.5], progress: 1, dpr });
			return;
		case 'start':
			drawStart(ctx, Z / 2, Z / 2, 13.3, 0, p, dpr);
			return;
		case 'duck':
			drawDuck(ctx, Z / 2 + 0.5, Z / 2 + 1, 12.3, p, dpr);
			return;
	}
}
