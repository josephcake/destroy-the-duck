// Canvas 2D renderer, Paper Cutout v2.1 (style.md §3, §4). Cost is
// proportional to content, not to viewport area: it walks Home (2,800 cells),
// board chunks in view and the trace overlay. Expensive bitmaps (wall
// chunks, weight piles) are baked once and blitted.
import { BOARD, BOARD_COLS, inBoard } from '../model/bounds';
import { Board, Dir, Weight } from '../model/board';
import { Bounds, parseId } from '../model/cell';
import { CellAnim, MOTION, Speed, St, Timing } from './cellAnim';
import { TraceState } from '../learn/player';
import { K, LegacyMirror } from './mirror';
import { WallCache, drawWalls, paintWalls } from './walls';
import { padLabel } from '../model/nodes';
import { Palette, mix, weightColor, weightUnder } from './palette';
import { CELL, View, cellToScreen, visibleBounds } from './view';
import {
	CellRef, DURATION, EASE, Shadow, bezier, cached, elevation,  maskAt, paperStack, punchHole, sheetPile, shapeWithBox, sticker,
} from '../vendor/paper-kit/paper-kit';


export type Scene = {
	view: View;
	width: number;
	height: number;
	dpr: number;
	palette: Palette;
	board: Board;
	mirror: LegacyMirror;
	trace: TraceState | null;
	/** the traced run's cells (search motion, cellAnim.ts); classic runs use mirror.anim */
	anim: CellAnim;
	/** playback speed: picks the motion timings (motion spec §1) */
	speed: Speed;
	/** cost bands (motion spec §2), off by default */
	bands?: boolean;
	/** the active tool, the tap direction and the lane drag head (one-way spec §1.3) */
	tool?: string;
	tapDir?: Dir;
	drag?: { r: number; c: number; dir: Dir } | null;
	learnCurrent: boolean; // ring the current trace node (Learn mode)
	hover: { r: number; c: number } | null;
	bestPath: { r: number; c: number }[] | null;
	/** an Arrow or Duck being dragged outside the classic window: drawn faint under the pointer */
	ghost?: { kind: 'start' | 'end'; r: number; c: number } | null;
	now: number;
	/** ms of the last change (edit, view, search step); the duck bob runs 3 cycles after it */
	activeAt: number;
	reducedMotion: boolean;
	/** the tab is hidden: the path flow stops asking for frames (it resumes on visibility) */
	hidden?: boolean;
	/**
	 * When set, marching path legs are not drawn here but pushed to this list, for a
	 * small overlay canvas that redraws only them (drawMarch) between full renders.
	 */
	march?: MarchItem[];
};

/** A flowing path leg, in screen px of the view it was built for: its fixed dots and the pulse clock. */
export type MarchItem = { dots: { x: number; y: number; u: number }[]; pts: ({ x: number; y: number } | null)[]; L: number; r: number; hw: number; flowFrom: number; v: number; span: number; color: string; halo: string; hi: string; core: number; grow: number; glowA: number; glowR: number; skip: { x: number; y: number }[]; skipR: number };

/** Where the pulse head is (arc px from the Arrow) at `now`; it runs Arrow -> Duck, rests, repeats. */
export function pulseHead(m: { L: number; v: number; span: number; flowFrom: number }, now: number) {
	const run = ((m.L + 2 * m.span) / m.v) * 1000;
	const t = (((now - m.flowFrom) % (run + PATH_DOT.pulseRest)) + run + PATH_DOT.pulseRest) % (run + PATH_DOT.pulseRest);
	return -m.span + (t / 1000) * m.v;
}
/** Pulse weight 0..1 of a dot at arc position u (a raised-cosine bump around the head). */
export const pulseW = (u: number, head: number, span: number) => (Math.abs(u - head) < span ? 0.5 * (1 + Math.cos((Math.PI * (u - head)) / span)) : 0);

/** Draw the pulse over the solid dots: the dots under it swell a little and light up from the centre. */
function drawPulse(ctx: CanvasRenderingContext2D, m: MarchItem, now: number, w: number, h: number, skip: boolean) {
	const head = pulseHead(m, now);
	const lit: { x: number; y: number; u: number }[] = [];
	for (const d of m.dots) {
		if (Math.abs(d.u - head) >= m.span) continue;
		if (skip && m.skip.some((q) => Math.abs(q.x - d.x) < m.skipR && Math.abs(q.y - d.y) < m.skipR)) continue;
		lit.push(d);
	}
	if (!lit.length) return;
	const wOf = (u: number) => pulseW(u, head, m.span);
	if (m.glowA > 0) {
		// dark themes (Prism PD1): one soft glow fill first, then the dots without the home ring that would cut it
		ctx.save();
		ctx.globalAlpha = m.glowA;
		ctx.fillStyle = m.color;
		ctx.beginPath();
		for (const d of lit) {
			const k = wOf(d.u), R = m.r * (1 + m.grow * k) + m.glowR * k;
			ctx.moveTo(d.x + R, d.y);
			ctx.arc(d.x, d.y, R, 0, Math.PI * 2);
		}
		ctx.fill();
		ctx.restore();
	}
	drawDots(ctx, lit, (u) => m.r * (1 + m.grow * wOf(u)), m.color, m.glowA > 0 ? 'rgba(0,0,0,0)' : m.halo, m.hw, w, h, { rOf: (u) => m.r * m.core * wOf(u), color: m.hi });
}

/** The overlay box (screen px) that holds every flowing leg, or null. */
export function marchBox(items: MarchItem[], w: number, h: number) {
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const m of items) {
		const pad = m.r * (1 + m.grow) + Math.max(m.hw, m.glowR) + 2;
		for (const q of m.pts) if (q) {
			x0 = Math.min(x0, q.x - pad);
			y0 = Math.min(y0, q.y - pad);
			x1 = Math.max(x1, q.x + pad);
			y1 = Math.max(y1, q.y + pad);
		}
	}
	x0 = Math.max(0, Math.floor(x0));
	y0 = Math.max(0, Math.floor(y0));
	x1 = Math.min(w, Math.ceil(x1));
	y1 = Math.min(h, Math.ceil(y1));
	return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/**
 * Draw only the pulse on the overlay (its origin at box.x, box.y); the solid dots stay on the
 * main canvas. The overlay sits above the stickers, so dots on the Arrow, the Duck and pads are left out.
 */
export function drawMarch(ctx: CanvasRenderingContext2D, items: MarchItem[], now: number, box: { x: number; y: number; w: number; h: number }, dpr: number) {
	ctx.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
	ctx.clearRect(box.x, box.y, box.w, box.h);
	for (const m of items) drawPulse(ctx, m, now, box.x + box.w, box.y + box.h, true);
}

/**
 * Path dots (Joseph 2026-11-22): the found path is a row of dots. They are laid in
 * Arrow -> Duck with the trace (traceMs, same easing) as light rings, fill in solid
 * when the trace lands, then a soft pulse keeps travelling Arrow -> Duck over them so
 * the direction reads. Visited cells are a soft flat fill. The pulse is cheap: at most ~30 fps
 * (frameHint.minGap), only the path box redrawn (overlay), none while hidden.
 */
export const PATH_DOT = {
	/** dot radius, in cells (floored in px), and the halo ring around it */
	r: 0.17, rMin: 1.8, halo: 0.07, haloMin: 1,
	/** spacing between dots, in cells (two per cell), floored at 2.6 radii so they never merge */
	gap: 0.5,
	/** while tracing in, each dot is a ring: a hole of this share of the radius (fills over DURATION.tug) */
	hole: 0.55,
	/** the pulse: speed (cells/s), half-width (cells), rest between passes (ms), swell, lit core share, core colour (path toward white) */
	pulseSpeed: 7, pulseSpan: 2.5, pulseRest: 700, pulseGrow: 0.3, pulseCore: 0.6, pulseHi: 0.55,
	/** ~30 fps while only the pulse is moving */
	frameMs: 33,
	/** reduced motion: static dots grow from Arrow to Duck */
	rmFrom: 0.55, rmTo: 1.35,
};
/** Set by render(): when > 0, the only thing moving is the path march; the frame loop may wait this long. */
export const frameHint = { minGap: 0 };

/**
 * Dots along a path, ordered from its first point (the Arrow) to its last (the Duck).
 * `pts` may hold nulls (teleporter jumps: the arc continues on the far side).
 * Dots sit at arc length phase + k * spacing, up to `upTo` (the trace-in progress).
 */
export function pathDots(pts: (Pt | null)[], spacing: number, phase: number, upTo = Infinity): { x: number; y: number; u: number; len: number }[] {
	const segs: [Pt, Pt, number, number][] = []; // a, b, u at a, length
	let L = 0;
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1], b = pts[i];
		if (!a || !b) continue;
		const d = Math.hypot(b.x - a.x, b.y - a.y);
		if (d <= 0) continue;
		segs.push([a, b, L, d]);
		L += d;
	}
	const out: { x: number; y: number; u: number; len: number }[] = [];
	if (!segs.length || spacing <= 0) return out;
	const end = Math.min(L, upTo);
	let j = 0;
	for (let u = ((phase % spacing) + spacing) % spacing; u <= end + 1e-6; u += spacing) {
		while (j < segs.length - 1 && u > segs[j][2] + segs[j][3]) j++;
		const [a, b, u0, d] = segs[j];
		const k = Math.max(0, Math.min(1, (u - u0) / d));
		out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, u, len: L });
	}
	return out;
}
/** Reduced motion: dot radius scale at arc position u of L (small at the Arrow, large at the Duck). */
export const rmDotScale = (u: number, L: number) => PATH_DOT.rmFrom + (PATH_DOT.rmTo - PATH_DOT.rmFrom) * (L > 0 ? Math.min(1, Math.max(0, u / L)) : 1);

const BOB_MS = DURATION.bob; // 2400
const CHUNK = 16;
const BAKE_CAP = 1100; // §8: K·s·dpr ≤ 1100, else draw live
const pathStarts = new Map<string, number>();
const traceStarts = new WeakMap<TraceState, number>();
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
/** The classic path's identity in the trace scheduler (Arrow > Duck | length). */
export const bestPathKey = (bp: { r: number; c: number }[]) => `${bp[0].r},${bp[0].c}>${bp.at(-1)!.r},${bp.at(-1)!.c}|${bp.length}`;
/** Hold a classic path's trace for `ms` while the camera eases to it (Prism re-gate G5); only if not yet scheduled. */
export function delayBestPath(bp: { r: number; c: number }[], now: number, ms: number) {
	const k = bestPathKey(bp);
	if (!pathStarts.has(k)) {
		if (pathStarts.size > 32) pathStarts.clear();
		pathStarts.set(k, now + ms);
	}
}
export const bestPathScheduled = (bp: { r: number; c: number }[]) => pathStarts.has(bestPathKey(bp));
/** The lone Duck is found: a finished traced run found her, or (classic runs) the best path ends on her cell. */
function soloFound(scene: Pick<Scene, 'trace' | 'bestPath'>, d: { r: number; c: number }) {
	const tr = scene.trace;
	if (tr) return !!(tr.trace.result.found && tr.done);
	const end = scene.bestPath && scene.bestPath.length > 1 ? scene.bestPath[scene.bestPath.length - 1] : null;
	return !!end && end.r === d.r && end.c === d.c;
}

/** Every Duck on the board, numbered as the badges are, and whether this run found her (edge chips, Prism gate). */
export function duckMarkers(scene: Pick<Scene, 'board' | 'mirror' | 'trace' | 'bestPath'>): { r: number; c: number; n: number | null; found: boolean }[] {
	const tr = scene.trace;
	const all = [...scene.board.entries()].filter(([, , t]) => t.kind === 'duck') as [number, number, { kind: 'duck'; n: number }][];
	const multi = all.length > 0;
	const reached = (n: number) => !!(tr && tr.done && (tr.trace.result.paths ?? []).some((q) => q.duck === n));
	const order = all.map(([, , t]) => t.n).sort((a, b) => a - b);
	const out: { r: number; c: number; n: number | null; found: boolean }[] = [];
	const d = scene.mirror.endCell();
	if (d) out.push({ ...d, n: multi ? 1 : null, found: multi ? reached(1) : soloFound(scene, d) });
	for (const [r, c, t] of all) out.push({ r, c, n: order.indexOf(t.n) + 2, found: reached(order.indexOf(t.n) + 2) });
	return out;
}

/**
 * Hold a finished run's path trace for `ms` (the camera eases to the path first,
 * Prism gate must-fix 2 §7): the legs start that much later and keep their full T.
 * Call before the first frame that would start the trace.
 */
export function delayTrace(tr: TraceState, now: number, ms: number) {
	if (!traceStarts.has(tr)) traceStarts.set(tr, now + ms);
}
/** Whether a finished run's trace has started (or been scheduled). */
export const traceScheduled = (tr: TraceState) => traceStarts.has(tr);

/** Lane chevrons step back to this alpha while a wave runs (Prism gate must-fix 3: .8 keeps Paper at 3.11:1 on the tile). */
export const FLOW_WAVE_ALPHA = 0.8;

export function render(ctx: CanvasRenderingContext2D, scene: Scene): boolean {
	const { view, width, height, dpr, palette: p } = scene;
	const motion = !scene.reducedMotion;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const v0 = visibleBounds(view, width, height);
	// the board is bounded (model/bounds.ts): draw only what's on it
	const vb = { r0: Math.max(v0.r0, BOARD.r0), c0: Math.max(v0.c0, BOARD.c0), r1: Math.min(v0.r1, BOARD.r1), c1: Math.min(v0.c1, BOARD.c1) };
	const s = CELL * view.zoom;
	let animating = false;

	// flat table around a flat board, and one hairline for the board's edge
	ctx.fillStyle = p.paper;
	ctx.fillRect(0, 0, width, height);
	const bx = view.panX + BOARD.c0 * s, by = view.panY + BOARD.r0 * s;
	const bw = (BOARD.c1 - BOARD.c0 + 1) * s, bh = (BOARD.r1 - BOARD.r0 + 1) * s;
	ctx.fillStyle = p.home;
	ctx.fillRect(bx, by, bw, bh);

	// Grid: fades in between 25% and 50% (ga = clamp((zoom − .25)/.25))
	const ga = Math.max(0, Math.min(1, (view.zoom - 0.25) / 0.25));
	if (ga > 0 && vb.r1 >= vb.r0 && vb.c1 >= vb.c0) drawGrid(ctx, view, vb, s, p, dpr, ga);
	ctx.save();
	ctx.strokeStyle = p.homeLine; // >= 3:1 on the board (palette.test)
	ctx.lineWidth = Math.max(1, 1.5 / dpr);
	ctx.strokeRect(Math.round(bx * dpr) / dpr - 0.5, Math.round(by * dpr) / dpr - 0.5, Math.round(bw * dpr) / dpr + 1, Math.round(bh * dpr) / dpr + 1);
	ctx.restore();

	// §4.2 weights, now checkpoints (engine/checkpoints.ts): one sheet colour for all, numbered once a run plans the order
	drawWeights(ctx, scene, vb, s, dpr);

	// §4.1 walls: 2-ply card from per-chunk cached bitmaps (walls.ts)
	let cache = wallCaches.get(ctx);
	if (!cache) wallCaches.set(ctx, (cache = new WallCache()));
	const m = scene.mirror;
	drawWalls(ctx, { isWall: (r: number, c: number) => isWallAt(scene, r, c) }, view, vb, p, dpr, cache);

	// §4.10 path legs and their timing first: the visited layer recedes while a thread traces (motion spec §3)
	const tr = scene.trace;
	const T = MOTION[scene.speed] ?? MOTION.fast;
	const legsIn: { r: number; c: number }[][] = [];
	let t0 = Infinity;
	if (tr && tr.done && tr.paths.length) {
		// the thread pulls once the path is complete (path events can arrive over several ticks)
		for (const g of tr.paths) legsIn.push(g.nodes.map(parseId));
		t0 = traceStarts.get(tr) ?? (traceStarts.set(tr, scene.now), scene.now);
	} else if (scene.bestPath && scene.bestPath.length > 1 && !m.previewOrder.length) {
		const key = bestPathKey(scene.bestPath);
		if (!pathStarts.has(key)) {
			if (pathStarts.size > 32) pathStarts.clear();
			pathStarts.set(key, scene.now);
		}
		t0 = pathStarts.get(key)!;
		legsIn.push(scene.bestPath);
	}
	const legs = motion ? scheduleLegs(legsIn, t0) : [];
	const traceEnd = legs.length ? Math.max(...legs.map((l) => l.start + l.dur)) + NEEDLE_RETRACT + DURATION.tug : -Infinity;
	const VA = VISITED_FILL_ALPHA, RA = RECEDE_FILL_ALPHA;
	let visA = VA;
	if (legs.length) {
		const el = scene.now - t0;
		if (scene.now < traceEnd) visA = VA - (VA - RA) * EASE.out(Math.min(1, Math.max(0, el) / 160));
		else {
			const u = Math.min(1, (scene.now - traceEnd) / 300);
			visA = RA + (VA - RA) * EASE.out(u);
			if (u < 1) animating = true;
		}
	}

	// search motion (motion spec §1, §6): settled cells (a soft flat fill) from a cached layer,
	// then only the live cells (tick enters, then fades as the cell's fill comes in), then the still frontier
	const anims: CellAnim[] = [];
	if (m.visitedCount > 0 && !m.free) anims.push(m.anim);
	if (tr) anims.push(scene.anim);
	const tOf = (a: CellAnim) => scene.now - a.runStart;
	for (const a of anims) {
		if (!motion) a.settleAll();
		else {
			if (legs.length && a.boostAt === Infinity) a.boostAt = t0 - a.runStart; // in-flight settles finish at 2x
			a.step(tOf(a), T);
		}
		drawVisitedLayer(ctx, a, scene, s, visA, !!scene.bands);
	}
	for (const a of anims) if (motion && drawLiveCells(ctx, a, scene, vb, s, tOf(a), T)) animating = true;
	if (tr) drawFrontierHold(ctx, scene.anim, scene, vb, s);
	const waving = anims.some((a) => a.liveCount > 0) || !!(tr && !tr.done);

	// §4.3 one-way lanes (one-way spec §2): batched drifting chevrons
	const lanesRun = scene.tool === 'oneway' || scene.now - scene.activeAt < FLOW_ACTIVE_MS || waving || legs.some((l) => scene.now < l.start + l.dur);
	if (drawLanes(ctx, scene, vb, s, { motion, running: lanesRun, wave: waving && !!tr && !tr.done, anims, t: tOf, T, key: ctx })) animating = true;

	// §4.4 teleporters (z2), over visited dots
	const padEnds = new Map<number, number[]>(); // pair -> keys in reading order
	const padLabels: { x: number; y: number; label: string; color: string; s: number }[] = []; // drawn above paths
	for (const [r, c, t] of scene.board.entries()) if (t.kind === 'pad') (padEnds.get(t.pair) ?? padEnds.set(t.pair, []).get(t.pair)!).push(r * 1e6 + c);
	for (const ends of padEnds.values()) ends.sort((a, b) => a - b);
	for (const [r, c, t] of scene.board.entries(vb)) {
		if (t.kind !== 'pad' || isWallAt(scene, r, c)) continue;
		const { x, y } = cellToScreen(view, r, c);
		const ends = padEnds.get(t.pair) ?? [];
		const color = p.pads[t.pair % p.pads.length];
		drawPad(ctx, x + s / 2, y + s / 2, s, color, ends.length < 2, p, dpr);
		padLabels.push({ x: x + s / 2, y: y + s / 2, label: padLabel(t.pair, ends.indexOf(r * 1e6 + c) === 1), color, s });
	}

	// §4.10 paths: the thread pulls from the Arrow to the Duck (motion spec §3)
	const arrivals = new Map<string, number>();
	let pathFlow = false;
	const drawLeg = (cells: { r: number; c: number }[], leg: Leg | null, flow = true) => {
		if (cells.length < 1) return;
		let k = 1, tug = 0, needle = 0;
		let jumpsT: number[] | null = null;
		const w = Math.max(1.6, 0.11 * s);
		let lw = w;
		if (leg && cells.length > 1) {
			const at = legAt(leg, scene.now);
			if (!at.started) {
				animating = true;
				return;
			}
			k = at.k;
			jumpsT = at.jumps;
			lw = w * (0.6 + 0.4 * EASE.out(Math.min(1, k / 0.25)));
			const b = cells[cells.length - 1];
			arrivals.set(`${b.r},${b.c}`, leg.start + leg.dur);
			if (at.after < 0) {
				needle = 0.5 * s;
				animating = true;
			} else if (at.after < NEEDLE_RETRACT) {
				needle = 0.5 * s * (1 - at.after / NEEDLE_RETRACT);
				animating = true;
			} else if (at.after - NEEDLE_RETRACT < DURATION.tug) {
				tug = EASE.out((at.after - NEEDLE_RETRACT) / DURATION.tug);
				animating = true;
			} else tug = 1;
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
		// path dots: laid in order during the trace-in, then marching Arrow -> Duck
		const r = Math.max(PATH_DOT.rMin, PATH_DOT.r * s);
		const gap = Math.max(PATH_DOT.gap * s, 2.6 * r);
		let L = 0;
		for (let i = 1; i < pts.length; i++) if (pts[i] && pts[i - 1]) L += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
		const flowFrom = leg ? leg.start + leg.dur + NEEDLE_RETRACT + DURATION.tug : -Infinity;
		const flowing = motion && flow && !!leg && tug >= 1 && scene.now >= flowFrom;
		if (flowing) pathFlow = true;
		const hw = Math.max(PATH_DOT.haloMin, PATH_DOT.halo * s);
		const dots = pathDots(pts, gap, 0, k * L + 1e-6);
		const ramp = !motion && flow;
		const rOf = (u: number) => (ramp ? r * rmDotScale(u, L) : r);
		// laid in as rings with the trace; the holes close (fill solid) over the tug once it lands
		const fill = !leg ? 1 : tug;
		drawDots(ctx, dots, rOf, p.path, p.pathEdge ?? p.home, hw, width, height, fill < 1 ? { rOf: () => r * PATH_DOT.hole * (1 - fill), color: p.home } : undefined);
		if (flowing) {
			const skip: { x: number; y: number }[] = [pts[0]!, pts[pts.length - 1]!];
			jumps.forEach(([a, b]) => skip.push(a, b));
			const item: MarchItem = { dots, pts, L, r, hw, flowFrom, v: PATH_DOT.pulseSpeed * s, span: PATH_DOT.pulseSpan * s, color: p.path, halo: p.pathEdge ?? p.home, hi: p.pulse?.hi ?? mix(p.path, '#ffffff', PATH_DOT.pulseHi), core: p.pulse?.core ?? PATH_DOT.pulseCore, grow: p.pulse?.grow ?? PATH_DOT.pulseGrow, glowA: p.pulse?.glowA ?? 0, glowR: p.pulse ? Math.max(2.5, p.pulse.glowR * s) : 0, skip, skipR: 0.5 * s };
			// the overlay draws the pulse (and keeps it moving without a full render); else draw it here
			if (scene.march) scene.march.push(item);
			else drawPulse(ctx, item, scene.now, width, height, false);
		}
		if (needle > 0) drawNeedle(ctx, pts, k, needle, 1.4 * lw, p.pathEdge ?? p.path);
		jumps.forEach(([a, b, col], j) => {
			// §4.4: fold trail in the pair colour; the paper plane flies once (420 ms) when the head reaches the pad
			const ft = jumpsT ? jumpsT[j] : 1;
			if (ft < 0) return;
			drawJump(ctx, a, b, s, col, p, ft, motion);
		});
	};
	if (legs.length) for (const leg of legs) drawLeg(leg.cells, leg);
	else for (const cells of legsIn) drawLeg(cells, null);
	if (m.previewOrder.length) {
		const cells = m.previewOrder.map((i) => m.cellAt(i));
		const a = m.startCell();
		if (a) cells.unshift(a);
		drawLeg(cells, null, false); // the classic player already animates it
	}

	// Pair letters sit above paths (a jump starts and ends on a pad)
	for (const t of padLabels) drawPadLetter(ctx, t.x, t.y, t.s, t.label, t.color, p, dpr);
	// checkpoint visit numbers too
	drawCheckpointBadges(ctx, scene, vb, s);

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
	const duckCell = m.endCell();
	const a = m.startCell();
	if (a) {
		const q = cellToScreen(view, a.r, a.c);
		const ang = duckCell ? Math.atan2(duckCell.r - a.r, duckCell.c - a.c) : 0;
		drawStart(ctx, q.x + s / 2, q.y + s / 2, s, ang, p, dpr);
	}
	// §4.5 v2.2: 3 cycles after the last change, then still; a found duck's reaction comes first (motion spec §4)
	let lastArrive = -Infinity;
	for (const v of arrivals.values()) if (scene.now >= v) lastArrive = Math.max(lastArrive, v);
	const bobFrom = Math.max(scene.activeAt, lastArrive + REACTION_MS);
	const age = scene.now - bobFrom;
	const bob = motion && age >= 0 && age < 3 * BOB_MS ? 0.03 * s * Math.sin((2 * Math.PI * age) / BOB_MS) : 0;
	const extra: { n: number; r: number; c: number }[] = [];
	for (const [r, c, t] of scene.board.entries(vb)) if (t.kind === 'duck' && !isWallAt(scene, r, c)) extra.push({ n: t.n, r, c });
	const multi = extra.length > 0 || [...scene.board.entries()].some(([, , t]) => t.kind === 'duck');
	const reached = (n: number) => !!(tr && tr.done && (tr.trace.result.paths ?? []).some((q) => q.duck === n));
	const order = [...scene.board.entries()].filter(([, , t]) => t.kind === 'duck').map(([, , t]) => (t as { n: number }).n).sort((a, b) => a - b);
	const ducks: { r: number; c: number; n: number | null; found: boolean }[] = [];
	if (duckCell) ducks.push({ ...duckCell, n: multi ? 1 : null, found: multi ? reached(1) : soloFound(scene, duckCell) });
	for (const d of extra) ducks.push({ r: d.r, c: d.c, n: order.indexOf(d.n) + 2, found: reached(order.indexOf(d.n) + 2) });
	for (const d of ducks) {
		const q = cellToScreen(view, d.r, d.c);
		const cx = q.x + s / 2, cy = q.y + s / 2 + bob;
		const at = motion ? arrivals.get(`${d.r},${d.c}`) : undefined;
		const rt = at === undefined ? Infinity : scene.now - at; // ms since her leg arrived
		if (at !== undefined && rt < REACTION_MS) animating = true;
		const rx = rt >= 0 ? duckReaction(rt) : duckReaction(0);
		const fy = cy + 0.3 * s; // transform origin at her feet
		ctx.save();
		ctx.translate(cx, fy + rx.ty * s);
		ctx.rotate((rx.rot * Math.PI) / 180);
		ctx.scale(rx.sx, rx.sy);
		ctx.translate(-cx, -fy);
		drawDuck(ctx, cx, cy, s, p, dpr);
		ctx.restore();
		if (d.n !== null) {
			// the found tick waits for the thread, then pops in (0.6 -> 1, 230-400 ms)
			const found = d.found && rt >= 230;
			const tick = rt === Infinity ? 1 : 0.6 + 0.4 * EASE.pop(Math.max(0, Math.min(1, (rt - 230) / 170)));
			drawDuckBadge(ctx, cx, cy + rx.ty * s, s, d.n, found || (d.found && at === undefined), p, dpr, tick);
		}
	}
	if (motion && age < 3 * BOB_MS && ducks.length) animating = true; // bob still to run (off under reduced motion)

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

	// one-way spec §1.3: the hover ghost (what a click does) and the lead arrow one cell ahead of a drag
	if (scene.tool === 'oneway') {
		if (scene.drag) {
			const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][scene.drag.dir];
			drawLaneGhost(ctx, view, p, s, scene.drag.r + dy, scene.drag.c + dx, scene.drag.dir, 1.6, 0.7);
		} else if (scene.hover) {
			const cur = scene.board.get(scene.hover.r, scene.hover.c);
			const d = cur?.kind === 'oneway' ? (cur.dir + 1) % 4 : (scene.tapDir ?? 1);
			drawLaneGhost(ctx, view, p, s, scene.hover.r, scene.hover.c, d, 1, 0.5);
		}
	}
	// §4.9 hover: a rounded pencil guide
	if (scene.hover) {
		const { x, y } = cellToScreen(view, scene.hover.r, scene.hover.c);
		ctx.save();
		ctx.strokeStyle = p.ink;
		ctx.globalAlpha = 0.3;
		ctx.lineWidth = 1;
		roundRect(ctx, x + 0.06 * s, y + 0.06 * s, s - 0.12 * s, s - 0.12 * s, 0.14 * s);
		ctx.stroke();
		ctx.restore();
	}
	// the path march wants frames only while it shows and the tab is visible; alone, ~30 fps
	const march = pathFlow && !scene.hidden;
	frameHint.minGap = march && !animating ? PATH_DOT.frameMs : 0;
	return animating || march;
}

/** One halo fill, one dot fill, and optionally one core fill (a hole or a highlight), culled to the viewport. */
function drawDots(ctx: CanvasRenderingContext2D, dots: { x: number; y: number; u: number }[], rOf: (u: number) => number, color: string, halo: string, hw: number, w: number, h: number, core?: { rOf: (u: number) => number; color: string }) {
	if (!dots.length) return;
	for (const pass of core ? [0, 1, 2] : [0, 1]) {
		ctx.beginPath();
		for (const d of dots) {
			const rr = rOf(d.u);
			if (rr <= 0.2) continue;
			const R = pass === 2 ? core!.rOf(d.u) : pass ? rr : rr + hw;
			if (R <= 0.2) continue;
			if (d.x < -R || d.y < -R || d.x > w + R || d.y > h + R) continue;
			ctx.moveTo(d.x + R, d.y);
			ctx.arc(d.x, d.y, R, 0, Math.PI * 2);
		}
		ctx.fillStyle = pass === 2 ? core!.color : pass ? color : halo;
		ctx.fill();
	}
}

// ------------------------------------------------------------------ grid
type Pt = { x: number; y: number };
/** One quiet grid everywhere: solid hairlines (1 device px) in the grid colour. */
function drawGrid(ctx: CanvasRenderingContext2D, view: View, vb: ReturnType<typeof visibleBounds>, s: number, p: Palette, dpr: number, ga: number) {
	ctx.save();
	ctx.lineWidth = 1 / dpr;
	ctx.globalAlpha = ga;
	ctx.strokeStyle = p.grid;
	ctx.beginPath();
	for (let c = vb.c0; c <= vb.c1 + 1; c++) {
		const x = Math.round((view.panX + c * s) * dpr) / dpr + 0.5 / dpr;
		ctx.moveTo(x, view.panY + vb.r0 * s);
		ctx.lineTo(x, view.panY + (vb.r1 + 1) * s);
	}
	for (let r = vb.r0; r <= vb.r1 + 1; r++) {
		const y = Math.round((view.panY + r * s) * dpr) / dpr + 0.5 / dpr;
		ctx.moveTo(view.panX + vb.c0 * s, y);
		ctx.lineTo(view.panX + (vb.c1 + 1) * s, y);
	}
	ctx.stroke();
	ctx.restore();
}

// ------------------------------------------------------------------ weights (checkpoints)
/** The cost tier whose sheet colours every checkpoint uses. */
const CHECKPOINT_LOOK = 5;

/** Visit numbers on the checkpoints, from the run's planned order: a round ink badge, centred, above the path. */
function drawCheckpointBadges(ctx: CanvasRenderingContext2D, scene: Scene, vb: ReturnType<typeof visibleBounds>, s: number) {
	const order = scene.trace?.trace.result.checkpoints?.order;
	if (!order?.length) return;
	const { view, palette: p } = scene;
	const r = Math.max(6.5, Math.min(14, 0.36 * s));
	ctx.save();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	order.forEach((id, i) => {
		const q = parseId(id);
		if (q.r < vb.r0 || q.r > vb.r1 || q.c < vb.c0 || q.c > vb.c1) return;
		if (scene.board.get(q.r, q.c)?.kind !== 'weight') return; // erased since the run
		const { x, y } = cellToScreen(view, q.r, q.c);
		const label = String(i + 1);
		const w = label.length > 1 ? r * 1.35 : r;
		ctx.beginPath();
		ctx.roundRect(x + s / 2 - w, y + s / 2 - r, 2 * w, 2 * r, r);
		ctx.fillStyle = p.ink;
		ctx.fill();
		ctx.lineWidth = 1.25;
		ctx.strokeStyle = p.home;
		ctx.stroke();
		ctx.fillStyle = p.home;
		ctx.font = `800 ${Math.round(r * 1.2)}px Figtree, system-ui, sans-serif`;
		ctx.fillText(label, x + s / 2, y + s / 2 + 0.5);
	});
	ctx.restore();
}

function drawWeights(ctx: CanvasRenderingContext2D, scene: Scene, vb: ReturnType<typeof visibleBounds>, s: number, dpr: number) {
	const { view, palette: p } = scene;
	const byChunk = new Map<string, { cr: number; cc: number; cells: [number, number, Weight][] }>();
	for (const [r, c, t] of scene.board.entries(vb)) {
		if (t.kind !== 'weight' || isWallAt(scene, r, c)) continue;
		const cr = Math.floor(r / CHUNK), cc = Math.floor(c / CHUNK), k = `${cr},${cc}`;
		(byChunk.get(k) ?? byChunk.set(k, { cr, cc, cells: [] }).get(k)!).cells.push([r, c, t.cost]);
	}
	if (!byChunk.size) return;
	// every weight tile is a checkpoint, whatever cost an old board gave it: one look (the cost-5 sheet)
	const same = () => (r: number, c: number) => {
		const t = scene.board.get(r, c);
		return !!t && t.kind === 'weight' && !isWallAt(scene, r, c);
	};
	// paint one chunk's weights with (ox, oy) = screen position of cell (cr*16, cc*16)
	const paint = (c2: Ctx2D, cr: number, cc: number, cells: [number, number, Weight][], ox: number, oy: number) => {
		const at = (r: number, c: number) => ({ x: ox + (c - cc * CHUNK) * s, y: oy + (r - cr * CHUNK) * s });
		// flat merged sheets (66c97df's union); no cost label: the visit number is a badge (drawCheckpointBadges)
		const refs: CellRef[] = cells.map(([r, c]) => ({ ...at(r, c), r, c, mask: maskAt(same(), r, c) }));
		paperStack(c2 as CanvasRenderingContext2D, refs, s, { layers: 1, top: weightColor(p, CHECKPOINT_LOOK), under: weightUnder(p, CHECKPOINT_LOOK), edge: p.wEdge, radius: s < 6 ? 0 : 0.1 * s, inset: 0.06 * s, dpr });
	};
	const tile = CHUNK * s, pad = Math.ceil(0.3 * s) + 8;
	for (const { cr, cc, cells } of byChunk.values()) {
		const o = cellToScreen(view, cr * CHUNK, cc * CHUNK);
		if ((tile + 2 * pad) * dpr > BAKE_CAP + 200) {
			paint(ctx, cr, cc, cells, o.x, o.y);
			continue;
		}
		let sig = 2166136261;
		for (const [r, c] of cells) sig = Math.imul(sig ^ (r * 4099 + c * 7), 16777619);
		// sheets merge across chunk edges, so the signature includes the neighbour masks
		for (const [r, c] of cells) sig = Math.imul(sig ^ maskAt(same(), r, c), 16777619);
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

// ------------------------------------------------------------------ search motion (Prism motion spec §1, §2, §6)
/**
 * Visited cells are a soft flat fill in the palette's visited colour, no stroke (Joseph 2026-11-22:
 * "get rid of all dashes"). Soft on purpose: about 1.4:1 on the board, so the gold path and the blue
 * frontier ticks stay the subjects. Classic Light keeps its visited/frontier lightness gap well over
 * Prism's .156 (palette.test).
 */
export const VISITED_FILL_ALPHA = 0.26;
/** While a path traces, the visited fill recedes to this alpha so the path is the subject (§3). */
export const RECEDE_FILL_ALPHA = 0.2;
const ENTER_BUCKETS = 4;
const FILL_BUCKETS = 4;
/** Cost bands: fixed 8-unit iso-cost contours (§2). */
export const bandOf = (g: number) => (Number.isFinite(g) && Math.floor(g / 8) % 2 === 1 ? 1 : 0);
const lineW = (s: number) => Math.max(1.5, 0.1 * s);

/** Settled cells as two appendable paths of unit squares in cell units (band 0, band 1); one per CellAnim. */
const settledCache = new WeakMap<CellAnim, { epoch: number; n: number; p: [Path2D, Path2D] }>();
function settledPaths(anim: CellAnim, board: Board) {
	let c = settledCache.get(anim);
	if (!c || c.epoch !== anim.epoch) settledCache.set(anim, (c = { epoch: anim.epoch, n: 0, p: [new Path2D(), new Path2D()] }));
	for (; c.n < anim.settledCount; c.n++) {
		const i = anim.settled[c.n];
		if (board.laneDir[i] >= 0) continue; // a lane shows "explored" with its tile tint (one-way spec §4)
		const r = (i / anim.cols) | 0, col = i - r * anim.cols;
		c.p[bandOf(anim.g[i])].rect(col, r, 1, 1);
	}
	return c.p;
}

/**
 * Phase D: every settled cell, two fills, no per-frame walk. The squares are appended to a
 * cached path in cell units as cells settle and filled through the view transform (the board
 * is bounded at 35 x 80, 2,800 cells).
 */
function drawVisitedLayer(ctx: CanvasRenderingContext2D, anim: CellAnim, scene: Scene, s: number, alpha: number, bands: boolean) {
	if (!anim.settledCount) return;
	const { view, dpr, palette: p } = scene;
	const [b0, b1] = settledPaths(anim, scene.board);
	ctx.save();
	ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.panX, dpr * view.panY);
	ctx.globalAlpha = alpha;
	ctx.fillStyle = p.visited;
	ctx.fill(b0);
	ctx.fillStyle = bands ? p.visitedBand : p.visited;
	ctx.fill(b1);
	ctx.restore();
}

/**
 * Phases A and C: walk only the live cells, into at most 4 enter buckets (+4 glow) and
 * 4 settle buckets (the tick fading out, the fill fading in), so at most 16 draws. Lane
 * cells are skipped (the lane renderer draws them). Returns true while any cell is live.
 */
export function drawLiveCells(ctx: CanvasRenderingContext2D, anim: CellAnim, scene: Scene, vb: Bounds, s: number, t: number, T: Timing) {
	if (!anim.liveCount) return false;
	const { view, palette: p, board } = scene;
	const enter: (Path2D | null)[] = Array(ENTER_BUCKETS).fill(null);
	const glow: (Path2D | null)[] = Array(ENTER_BUCKETS).fill(null);
	const fade: (Path2D | null)[] = Array(FILL_BUCKETS).fill(null);
	const fill: (Path2D | null)[] = Array(FILL_BUCKETS).fill(null);
	const L = 0.4 * s;
	for (let k = 0; k < anim.liveCount; k++) {
		const i = anim.live[k];
		const r = (i / anim.cols) | 0, c = i - r * anim.cols;
		if (r < vb.r0 || r > vb.r1 || c < vb.c0 || c > vb.c1 || board.laneDir[i] >= 0) continue;
		const cx = view.panX + (c + 0.5) * s, cy = view.panY + (r + 0.5) * s;
		const u = Math.max(0, Math.min(0.999, anim.progress(i, t, T)));
		if (anim.state[i] === St.Enter) {
			const b = Math.min(ENTER_BUCKETS - 1, Math.floor(EASE.out(u) * ENTER_BUCKETS));
			const h = (L / 2) * (0.5 + 0.5 * ((b + 1) / ENTER_BUCKETS));
			const m = (enter[b] ??= new Path2D());
			m.moveTo(cx, cy - h);
			m.lineTo(cx, cy + h);
			const g = (glow[b] ??= new Path2D());
			g.moveTo(cx, cy - h);
			g.lineTo(cx, cy + h);
		} else {
			const b = Math.min(FILL_BUCKETS - 1, Math.floor(EASE.out(u) * FILL_BUCKETS));
			const m = (fade[b] ??= new Path2D());
			m.moveTo(cx, cy - L / 2);
			m.lineTo(cx, cy + L / 2);
			(fill[b] ??= new Path2D()).rect(view.panX + c * s, view.panY + r * s, s, s);
		}
	}
	ctx.save();
	ctx.lineCap = 'round';
	const w = lineW(s);
	for (let b = 0; b < ENTER_BUCKETS; b++) {
		const k = (b + 1) / ENTER_BUCKETS;
		if (glow[b]) {
			ctx.lineWidth = 2.4 * w;
			ctx.globalAlpha = 0.25 * (1 - k);
			ctx.strokeStyle = p.front;
			ctx.stroke(glow[b]!);
		}
		if (enter[b]) {
			ctx.lineWidth = w;
			ctx.globalAlpha = 0.25 + 0.75 * k;
			ctx.strokeStyle = p.frontEdge;
			ctx.stroke(enter[b]!);
		}
	}
	ctx.lineWidth = w;
	ctx.strokeStyle = p.frontEdge;
	ctx.fillStyle = p.visited;
	for (let b = 0; b < FILL_BUCKETS; b++) {
		const k = (b + 0.5) / FILL_BUCKETS;
		if (fill[b]) {
			ctx.globalAlpha = VISITED_FILL_ALPHA * k;
			ctx.fill(fill[b]!);
		}
		if (fade[b]) {
			ctx.globalAlpha = 1 - k;
			ctx.stroke(fade[b]!);
		}
	}
	ctx.restore();
	return true;
}

/** Phase B: the still frontier ticks, one path, one stroke (lane cells: frontier chevrons instead). */
function drawFrontierHold(ctx: CanvasRenderingContext2D, anim: CellAnim, scene: Scene, vb: Bounds, s: number) {
	if (!anim.frontierCount) return;
	const { view, palette: p, board } = scene;
	const h = 0.2 * s;
	const tick = new Path2D();
	let any = false;
	for (let k = 0; k < anim.frontierCount; k++) {
		const i = anim.frontier[k];
		if (anim.state[i] !== St.Hold || board.laneDir[i] >= 0) continue;
		const r = (i / anim.cols) | 0, c = i - r * anim.cols;
		if (r < vb.r0 || r > vb.r1 || c < vb.c0 || c > vb.c1) continue;
		const cx = view.panX + (c + 0.5) * s, cy = view.panY + (r + 0.5) * s;
		tick.moveTo(cx, cy - h);
		tick.lineTo(cx, cy + h);
		any = true;
	}
	if (!any) return;
	ctx.save();
	ctx.strokeStyle = p.frontEdge;
	ctx.lineWidth = lineW(s);
	ctx.lineCap = 'round';
	ctx.stroke(tick);
	ctx.restore();
}

// ------------------------------------------------------------------ path trace (motion spec §3)
/** Trace duration for a leg of L cells. */
export const traceMs = (L: number) => Math.min(1400, 360 + 10 * L);
export const LEG_GAP = 120;
export const NEEDLE_RETRACT = 120;
const FLIGHT = DURATION.flight; // 420
const flightInv = (f: number) => {
	let lo = 0, hi = 1;
	for (let k = 0; k < 24; k++) {
		const mid = (lo + hi) / 2;
		if (EASE.flight(mid) < f) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
};
export type Leg = { cells: { r: number; c: number }[]; start: number; T: number; jumpsA: number[]; dur: number };
/** Legs one after another with a 120 ms gap; beyond 3 legs the rest trace alongside the third. */
export function scheduleLegs(legs: { r: number; c: number }[][], t0: number): Leg[] {
	let cursor = t0, third = t0;
	return legs.map((cells, i) => {
		const T = traceMs(cells.length);
		let steps = 0;
		const fr: number[] = [];
		for (let k = 1; k < cells.length; k++) {
			if (Math.abs(cells[k].r - cells[k - 1].r) + Math.abs(cells[k].c - cells[k - 1].c) > 1) fr.push(steps);
			else steps++;
		}
		const jumpsA = fr.map((n) => T * flightInv(steps ? n / steps : 1));
		const dur = T + FLIGHT * jumpsA.length;
		let start: number;
		if (i <= 2) {
			start = cursor;
			if (i === 2) third = start;
			cursor = start + dur + LEG_GAP;
		} else start = third;
		return { cells, start, T, jumpsA, dur };
	});
}
/** Where a leg is at `now`: k (eased distance 0..1), ms since k reached 1, and each jump's flight (-1 not yet). */
export function legAt(leg: Leg, now: number) {
	const el = now - leg.start;
	let acc = 0, a = el;
	const jumps = leg.jumpsA.map(() => -1);
	for (let j = 0; j < leg.jumpsA.length; j++) {
		const aj = leg.jumpsA[j];
		if (el - acc < aj) break;
		if (el - acc < aj + FLIGHT) {
			jumps[j] = (el - acc - aj) / FLIGHT; // the trace pauses for the plane
			a = aj;
			acc = NaN;
			break;
		}
		jumps[j] = 1;
		acc += FLIGHT;
	}
	if (!Number.isNaN(acc)) a = el - acc;
	const k = el < 0 ? 0 : EASE.flight(Math.max(0, Math.min(1, a / leg.T)));
	return { k, after: Number.isNaN(acc) ? -1 : a - leg.T, jumps, started: el >= 0 };
}

// ------------------------------------------------------------------ duck reaction (motion spec §4)
const KEYS: [number, number, number, number, number, ((t: number) => number) | null][] = [
	[0, 0, 1, 1, 0, null],
	[90, 0, 1.08, 0.88, 0, bezier(0.3, 0, 0.7, 1)],
	[230, -0.28, 0.95, 1.06, -8, EASE.out],
	[370, 0, 1.06, 0.92, 0, bezier(0.5, 0, 0.75, 0)],
	[520, 0, 1, 1, 0, EASE.out],
];
export const REACTION_MS = 520;
/** The duck's squash, hop and land at t ms after her leg's trace arrives: ty in duck units, scales, degrees. */
export function duckReaction(t: number) {
	if (t <= 0 || t >= REACTION_MS) return { ty: 0, sx: 1, sy: 1, rot: 0 };
	let k = 1;
	while (KEYS[k][0] < t) k++;
	const [t0, y0, sx0, sy0, r0] = KEYS[k - 1];
	const [t1, y1, sx1, sy1, r1, ease] = KEYS[k];
	const u = ease!((t - t0) / (t1 - t0));
	const L = (a: number, b: number) => a + (b - a) * u;
	return { ty: L(y0, y1), sx: L(sx0, sx1), sy: L(sy0, sy1), rot: L(r0, r1) };
}

// ------------------------------------------------------------------ one-way lanes (Prism one-way spec §2-§4)
/** Drift speed in cells per second; chevrons are 0.5 cell apart. */
export const FLOW_CPS = 1.5;
const FLOW_STOP_MS = 400;
const FLOW_ACTIVE_MS = 3 * DURATION.bob; // the bob's window after the last change
const DIRV = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
] as const; // N E S W as (dx, dy)
/** The flow clock: advances while lanes should move, eases to a stop over 400 ms otherwise. */
type Flow = { t: number; last: number; stopAt: number; v: number };
const flows = new WeakMap<object, Flow>();
/** Phase of the shared drift, 0..1 per half cell (spec §3). */
export const flowPhase = (flowMs: number) => (((flowMs * FLOW_CPS) / 1000 / 0.5) % 1 + 1) % 1;

/** "›" pointing along (dx, dy), apex at (x, y): an open stroke of three points. */
function chev(path: Path2D, x: number, y: number, dx: number, dy: number, h: number, depth: number) {
	path.moveTo(x - dx * depth - dy * h, y - dy * depth + dx * h);
	path.lineTo(x, y);
	path.lineTo(x - dx * depth + dy * h, y - dy * depth - dx * h);
}

type LaneOpts = { motion: boolean; running: boolean; wave: boolean; anims: CellAnim[]; t: (a: CellAnim) => number; T: Timing; key: object };
/**
 * Every lane in view, batched: tiles in a few fills, chevrons in at most 8
 * strokes (4 directions x 2 alpha buckets), no save/restore, clip, shadow or
 * rotate per cell. Returns true while the drift is moving.
 */
function drawLanes(ctx: CanvasRenderingContext2D, scene: Scene, vb: Bounds, s: number, o: LaneOpts) {
	const { board, view, palette: p } = scene;
	let any = false;
	for (let d = 0; d < 4 && !any; d++)
		for (let k = 0; k < board.laneCount[d]; k++) {
			const i = board.laneIdx[d][k], r = (i / BOARD_COLS) | 0, c = i - r * BOARD_COLS;
			if (r >= vb.r0 && r <= vb.r1 && c >= vb.c0 && c <= vb.c1) {
				any = true;
				break;
			}
		}
	if (!any) return false; // no lanes in view: zero cost
	// flow clock
	let f = flows.get(o.key);
	if (!f) flows.set(o.key, (f = { t: 0, last: scene.now, stopAt: -Infinity, v: 0 }));
	const dt = Math.max(0, Math.min(100, scene.now - f.last));
	f.last = scene.now;
	if (!o.motion) f.v = 0;
	else if (o.running) {
		f.v = 1;
		f.stopAt = Infinity;
	} else {
		if (f.stopAt === Infinity) f.stopAt = scene.now;
		f.v = f.stopAt === -Infinity ? 0 : 1 - EASE.out(Math.min(1, (scene.now - f.stopAt) / FLOW_STOP_MS));
	}
	f.t += dt * f.v;
	const phase = flowPhase(f.t);
	// what the search did to each lane cell: 0 untouched, 1 frontier, 2 settling (u), 3 settled
	const stateAt = (i: number): [number, number] => {
		for (const a of o.anims) {
			const st = a.state[i];
			if (st === St.Enter || st === St.Hold) return [1, 0];
			if (st === St.Settle) return [2, Math.max(0, Math.min(1, a.progress(i, o.t(a), o.T)))];
			if (st === St.Done) return [3, 1];
		}
		return [0, 0];
	};
	const small = s < 10;
	const tile = new Path2D(), tint: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
	const ch: Path2D[][] = [0, 1, 2, 3].map(() => [new Path2D(), new Path2D()]); // [dir][0 full, 1 faded]
	const frontLane = new Path2D(); // frontier lane cells
	let hasTint = 0, hasFrontLane = false;
	const inset = 0.08 * s, rad = 0.14 * s;
	const h = 0.16 * s;
	for (let d = 0; d < 4; d++) {
		const [dx, dy] = DIRV[d];
		for (let k = 0; k < board.laneCount[d]; k++) {
			const i = board.laneIdx[d][k], r = (i / BOARD_COLS) | 0, c = i - r * BOARD_COLS;
			if (r < vb.r0 || r > vb.r1 || c < vb.c0 || c > vb.c1 || isWallAt(scene, r, c)) continue;
			const x = view.panX + c * s, y = view.panY + r * s;
			const [st, u] = stateAt(i);
			if (!small) {
				if (st === 3 || (st === 2 && !o.motion)) {
					tint[3].roundRect(x + inset, y + inset, s - 2 * inset, s - 2 * inset, rad);
					hasTint |= 8;
				} else if (st === 2) {
					const b = Math.min(3, Math.floor(u * 4));
					tint[b].roundRect(x + inset, y + inset, s - 2 * inset, s - 2 * inset, rad);
					hasTint |= 1 << b;
				} else tile.roundRect(x + inset, y + inset, s - 2 * inset, s - 2 * inset, rad);
			}
			const cx = x + s / 2, cy = y + s / 2;
			const target = st === 1 ? frontLane : null;
			if (small || !o.motion) {
				// one static chevron, centred (1.2x below 10 px, 1.3x under reduced motion)
				const z = small ? 1.2 : 1.3;
				chev(target ?? ch[d][0], cx + dx * 0.5 * h * z, cy + dy * 0.5 * h * z, dx, dy, h * z, h * z);
				if (target) hasFrontLane = true;
				continue;
			}
			// lane ends: the next cell along isn't this lane's direction (end), or the previous one isn't (start)
			const nr = r + dy, nc = c + dx, pr = r - dy, pc = c - dx;
			const endF = !inBoard(nr, nc) || board.laneDir[nr * BOARD_COLS + nc] !== d;
			const startF = !inBoard(pr, pc) || board.laneDir[pr * BOARD_COLS + pc] !== d;
			for (let q = 0; q < 2; q++) {
				const pos = (0.5 * phase + 0.5 * q) % 1; // 0 at the entry edge, 1 at the exit edge
				const faded = (endF && pos > 0.88) || (startF && pos < 0.12);
				const off = (pos - 0.5) * s;
				chev(target ?? ch[d][faded ? 1 : 0], cx + dx * off, cy + dy * off, dx, dy, h, h * 0.8);
				if (target) hasFrontLane = true;
			}
		}
	}
	const waveA = o.wave ? FLOW_WAVE_ALPHA : 1;
	ctx.save();
	if (!small) {
		ctx.globalAlpha = 0.45;
		ctx.fillStyle = p.oneway;
		ctx.fill(tile);
		for (let b = 0; b < 4; b++) {
			if (!(hasTint & (1 << b))) continue;
			const u = b === 3 ? 1 : (b + 0.5) / 4;
			if (u < 1) {
				ctx.globalAlpha = 0.45 * (1 - u);
				ctx.fillStyle = p.oneway;
				ctx.fill(tint[b]);
			}
			ctx.globalAlpha = 0.18 * u;
			ctx.fillStyle = p.visited;
			ctx.fill(tint[b]);
		}
	}
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = Math.max(1.25, 0.07 * s) * (small || !o.motion ? (small ? 1.2 : 1.3) : 1);
	ctx.strokeStyle = p.flow;
	for (let d = 0; d < 4; d++)
		for (let q = 0; q < 2; q++) {
			ctx.globalAlpha = (q ? 0.45 : 1) * waveA;
			ctx.stroke(ch[d][q]);
		}
	if (hasFrontLane) {
		ctx.globalAlpha = 1;
		ctx.strokeStyle = p.frontEdge;
		ctx.stroke(frontLane);
	}
	ctx.restore();
	return o.motion && f.v > 0;
}

/** One chevron at (r, c) pointing d: the hover ghost (scale 1, alpha .5) or the lead arrow (1.6x, .7). */
function drawLaneGhost(ctx: CanvasRenderingContext2D, view: View, p: Palette, s: number, r: number, c: number, d: number, scale: number, alpha: number) {
	if (!inBoard(r, c)) return;
	const [dx, dy] = DIRV[d & 3];
	const h = 0.16 * s * scale, cx = view.panX + (c + 0.5) * s, cy = view.panY + (r + 0.5) * s;
	const path = new Path2D();
	chev(path, cx + dx * 0.5 * h, cy + dy * 0.5 * h, dx, dy, h, h);
	ctx.save();
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = p.flow;
	ctx.lineWidth = Math.max(1.25, 0.07 * s) * scale;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.stroke(path);
	ctx.restore();
}

// ------------------------------------------------------------------ one-way, teleporters, jump
/** §4.4 + gate: ring radius; at least 5 px so pairs still read at 35 % on phones. */
export const padRing = (s: number) => ({ ri: Math.max(1.5, 0.24 * s), ro: Math.max(5, 0.44 * s) });
function drawPad(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, lone: boolean, p: Palette, dpr: number) {
	const { ri, ro } = padRing(s);
	const TAU = Math.PI * 2;
	ctx.save();
	if (lone) ctx.globalAlpha = 0.6; // with a faint outer ring below: "no partner yet"
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
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = Math.max(1, 0.04 * s);
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
	ctx.strokeStyle = color;
	ctx.globalAlpha = 0.55;
	ctx.lineWidth = Math.max(1.25, 0.05 * s);
	ctx.lineCap = 'round';
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
	sticker(ctx, cx, cy, tab, { fill: p.start, border: p.sticker, borderWidth: Math.max(1.5, 0.06 * u), edge: p.stickerEdge, peel: 0, rotate: ang, contact: { color: p.contact, dx: 0.5, dy: Math.max(1, 0.05 * u), blur: Math.min(0.09 * u, 5) }, dpr }, (c) => {
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
	sticker(ctx, cx, cy, duckSilhouette(u), { fill: p.duck, border: p.sticker, borderWidth: Math.max(1.5, 0.07 * u), edge: p.stickerEdge, peel: 0, curl: false, contact: { color: p.contact, dx: 0.5, dy: Math.max(1.2, 0.05 * u), blur: Math.min(0.1 * u, 6) }, dpr }, (c) => {
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
function drawDuckBadge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, n: number, found: boolean, p: Palette, dpr: number, tick = 1) {
	if (s < 6) return; // below 30 % the whole board is a thumbnail
	const { cx, cy, rad } = badgeGeometry(x, y, s);
	const u = Math.max(1.3 * s, 16);
	const circ = shapeWithBox((q) => q.arc(0, 0, rad, 0, Math.PI * 2), { x: -rad, y: -rad, w: 2 * rad, h: 2 * rad });
	sticker(ctx, cx, cy, circ, { fill: found ? p.vis[1] : p.sticker, border: p.sticker, borderWidth: Math.max(1, 0.03 * u), edge: p.stickerEdge, peel: 0.55, rotate: -0.12, contact: { color: p.contact, dx: 0, dy: 1, blur: 2 }, dpr }, (c) => {
		if (found) {
			// a drawn tick, not a glyph
			c.scale(tick, tick);
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
/** The trace head: a solid needle `len` px long ending where the thread has reached (progress k). */
function drawNeedle(ctx: CanvasRenderingContext2D, pts: (Pt | null)[], k: number, len: number, width: number, color: string) {
	const segs: Pt[][] = [];
	let cur: Pt[] = [];
	for (const q of pts) {
		if (!q) {
			if (cur.length > 1) segs.push(cur);
			cur = [];
		} else cur.push(q);
	}
	if (cur.length > 1) segs.push(cur);
	let total = 0;
	for (const sg of segs) for (let i = 1; i < sg.length; i++) total += Math.hypot(sg[i].x - sg[i - 1].x, sg[i].y - sg[i - 1].y);
	if (!total) return;
	// walk to the head, remembering this segment's points so the needle can bend round a corner
	let budget = total * k;
	for (const sg of segs) {
		let segLen = 0;
		for (let i = 1; i < sg.length; i++) segLen += Math.hypot(sg[i].x - sg[i - 1].x, sg[i].y - sg[i - 1].y);
		if (budget > segLen + 1e-6) {
			budget -= segLen;
			continue;
		}
		const at = (d: number): Pt => {
			d = Math.max(0, d);
			for (let i = 1; i < sg.length; i++) {
				const l = Math.hypot(sg[i].x - sg[i - 1].x, sg[i].y - sg[i - 1].y);
				if (d <= l) return { x: sg[i - 1].x + ((sg[i].x - sg[i - 1].x) * d) / (l || 1), y: sg[i - 1].y + ((sg[i].y - sg[i - 1].y) * d) / (l || 1) };
				d -= l;
			}
			return sg[sg.length - 1];
		};
		const path = new Path2D();
		const n = 6;
		for (let q = 0; q <= n; q++) {
			const pt = at(budget - len + (len * q) / n);
			if (q) path.lineTo(pt.x, pt.y);
			else path.moveTo(pt.x, pt.y);
		}
		ctx.save();
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke(path);
		ctx.restore();
		return;
	}
}
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
			sheetPile(ctx, { x: 1, y: 2, r: 0, c: cost, mask: 0 }, 19, { layers: 1, fills: [weightColor(p, cost), weightUnder(p, cost)], edge: p.wEdge, contact: contactOf(p, 19), dpr, rotate: 0, tintVar: 0 });
			return;
		}
		case 'visited':
			// a soft flat square, as on the board (no dash)
			ctx.fillStyle = p.visited;
			ctx.globalAlpha = VISITED_FILL_ALPHA;
			ctx.fillRect(Z / 2 - 6, Z / 2 - 6, 12, 12);
			ctx.globalAlpha = 1;
			return;
		case 'frontier':
			ctx.strokeStyle = p.frontEdge;
			ctx.lineWidth = 2;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(Z / 2, Z / 2 - 4);
			ctx.lineTo(Z / 2, Z / 2 + 4);
			ctx.stroke();
			return;
		case 'oneway': {
			// the lane look (one-way spec §2): flat tile at .45 and two chevrons in `flow`
			ctx.globalAlpha = 0.45;
			ctx.fillStyle = p.oneway;
			roundRect(ctx, 0.08 * Z, 0.08 * Z, 0.84 * Z, 0.84 * Z, 0.14 * Z);
			ctx.fill();
			ctx.globalAlpha = 1;
			const path = new Path2D();
			chev(path, Z * 0.42, Z / 2, 1, 0, 0.16 * Z, 0.13 * Z);
			chev(path, Z * 0.72, Z / 2, 1, 0, 0.16 * Z, 0.13 * Z);
			ctx.strokeStyle = p.flow;
			ctx.lineWidth = Math.max(1.25, 0.07 * Z);
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.stroke(path);
			return;
		}
		case 'pad':
			drawPad(ctx, Z / 2, Z / 2, 20, p.pads[0], false, p, dpr);
			return;
		case 'path':
			drawDots(ctx, pathDots([{ x: 3, y: 16 }, { x: 11, y: 16 }, { x: 11, y: 6 }, { x: 19, y: 6 }], 4.4, 0), () => (p.pathEdge ? 1.3 : 1.6), p.path, p.pathEdge ?? p.path, p.pathEdge ? 0.8 : 0, Z, Z);
			return;
		case 'start':
			drawStart(ctx, Z / 2, Z / 2, 13.3, 0, p, dpr);
			return;
		case 'duck':
			drawDuck(ctx, Z / 2 + 0.5, Z / 2 + 1, 12.3, p, dpr);
			return;
	}
}
