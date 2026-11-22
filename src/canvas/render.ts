// Canvas 2D renderer. Cost is proportional to content, not to viewport area:
// it walks Home (2,800 cells), board chunks in view and the trace overlay.
import { Board, Weight } from '../model/board';
import { HOME, HOME_COLS, HOME_ROWS, idOf, inHome, parseId } from '../model/cell';
import { TraceState } from '../learn/player';
import { K, LegacyMirror } from './mirror';
import { WallCache, drawWalls } from './walls';
import { Palette, labelOn, mix, weightColor, weightEdge } from './palette';
import { CELL, View, cellToScreen, visibleBounds } from './view';

const FRONTIER_PULSE_MAX = 2000;
const PULSE_MS = 900;
/** alpha 0.775 ± 0.225 (0.55..1) over 900 ms, eased in-out (cubic-bezier(.45,0,.55,1) ~ smoothstep). */
export function frontierAlpha(now: number) {
	const t = (now % PULSE_MS) / PULSE_MS;
	const tri = t < 0.5 ? t * 2 : 2 - t * 2; // 0 -> 1 -> 0
	const e = tri * tri * (3 - 2 * tri);
	return 0.55 + 0.45 * e;
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
	now: number;
	reducedMotion: boolean;
};

const ENTER_MS = 480;
const wallCaches = new WeakMap<CanvasRenderingContext2D, WallCache>();
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function isWallAt(scene: Scene, r: number, c: number) {
	if (inHome(r, c)) return scene.mirror.at(r, c) === K.Wall;
	return scene.board.get(r, c)?.kind === 'wall';
}

/** True while something is still animating. */
export function render(ctx: CanvasRenderingContext2D, scene: Scene): boolean {
	const { view, width, height, dpr, palette: p } = scene;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.fillStyle = p.paper;
	ctx.fillRect(0, 0, width, height);
	const vb = visibleBounds(view, width, height);
	const s = CELL * view.zoom;
	let animating = false;

	// Home dock
	const home = cellToScreen(view, 0, 0);
	const hw = HOME_COLS * s;
	const hh = HOME_ROWS * s;
	ctx.fillStyle = p.home;
	ctx.fillRect(home.x, home.y, hw, hh);

	// Grid lines: full at >= 50 %, fading to 0 at 25 %
	const gridAlpha = Math.max(0, Math.min(1, (view.zoom - 0.25) / 0.25));
	if (gridAlpha > 0) {
		ctx.lineWidth = 1 / dpr;
		ctx.globalAlpha = gridAlpha;
		for (const [color, inside] of [[p.outerGrid, false], [p.grid, true]] as const) {
			ctx.strokeStyle = color;
			ctx.beginPath();
			const r0 = inside ? Math.max(vb.r0, 0) : vb.r0;
			const r1 = inside ? Math.min(vb.r1, HOME_ROWS) : vb.r1;
			const c0 = inside ? Math.max(vb.c0, 0) : vb.c0;
			const c1 = inside ? Math.min(vb.c1, HOME_COLS) : vb.c1;
			if (inside) {
				ctx.save();
				ctx.rect(home.x, home.y, hw, hh);
				ctx.clip();
				ctx.beginPath();
			}
			for (let c = c0; c <= c1; c++) {
				const x = Math.round((view.panX + c * s) * dpr) / dpr;
				ctx.moveTo(x, view.panY + r0 * s);
				ctx.lineTo(x, view.panY + r1 * s);
			}
			for (let r = r0; r <= r1; r++) {
				const y = Math.round((view.panY + r * s) * dpr) / dpr;
				ctx.moveTo(view.panX + c0 * s, y);
				ctx.lineTo(view.panX + c1 * s, y);
			}
			ctx.stroke();
			if (inside) ctx.restore();
		}
		ctx.globalAlpha = 1;
	}


	// Weights: same-cost neighbours merge into one blob (4-neighbour mask, a
	// shared side has no inset and its corners no radius). The edge stroke
	// carries the 3:1 contrast (fix 2) and is drawn only on open sides. Over
	// visited cells the edge, label and texture are drawn again (fix 7).
	const weightCells: [number, number, Weight][] = [];
	for (const [r, c, t] of scene.board.entries(vb)) if (t.kind === 'weight' && !isWallAt(scene, r, c)) weightCells.push([r, c, t.cost]);
	const sameW = (r: number, c: number, cost: number) => {
		const t = scene.board.get(r, c);
		return !!t && t.kind === 'weight' && t.cost === cost && !isWallAt(scene, r, c);
	};
	const blobs = view.zoom >= 0.5;
	const wGeom = (r: number, c: number, cost: number, shrink = 0) => {
		const { x, y } = cellToScreen(view, r, c);
		const n = sameW(r - 1, c, cost), e = sameW(r, c + 1, cost), so = sameW(r + 1, c, cost), w = sameW(r, c - 1, cost);
		const ins = (blobs ? 0.06 * s : 0) + shrink;
		const x0 = x + (w ? 0 : ins), x1 = x + s - (e ? 0 : ins), y0 = y + (n ? 0 : ins), y1 = y + s - (so ? 0 : ins);
		const R = blobs ? Math.max(0, 0.22 * s - shrink) : 0;
		// concave corners (both sides shared, diagonal not): notch by the inset so
		// the blob's outline steps in cleanly instead of poking out a square
		const k = blobs ? 0.06 * s : 0;
		const cc = [
			n && w && !sameW(r - 1, c - 1, cost) ? k : 0,
			n && e && !sameW(r - 1, c + 1, cost) ? k : 0,
			so && e && !sameW(r + 1, c + 1, cost) ? k : 0,
			so && w && !sameW(r + 1, c - 1, cost) ? k : 0,
		];
		return { x, y, x0, x1, y0, y1, n, e, so, w, cc, rad: [!n && !w ? R : 0, !n && !e ? R : 0, !so && !e ? R : 0, !so && !w ? R : 0] };
	};
	const blobCellPath = (g: ReturnType<typeof wGeom>) => {
		const { x0, x1, y0, y1, cc } = g;
		const [tl, tr, br, bl] = g.rad;
		ctx.moveTo(x0 + Math.max(tl, cc[0]), y0);
		if (cc[1]) { ctx.lineTo(x1 - cc[1], y0); ctx.lineTo(x1 - cc[1], y0 + cc[1]); ctx.lineTo(x1, y0 + cc[1]); }
		else { ctx.lineTo(x1 - tr, y0); if (tr) ctx.arcTo(x1, y0, x1, y0 + tr, tr); }
		if (cc[2]) { ctx.lineTo(x1, y1 - cc[2]); ctx.lineTo(x1 - cc[2], y1 - cc[2]); ctx.lineTo(x1 - cc[2], y1); }
		else { ctx.lineTo(x1, y1 - br); if (br) ctx.arcTo(x1, y1, x1 - br, y1, br); }
		if (cc[3]) { ctx.lineTo(x0 + cc[3], y1); ctx.lineTo(x0 + cc[3], y1 - cc[3]); ctx.lineTo(x0, y1 - cc[3]); }
		else { ctx.lineTo(x0 + bl, y1); if (bl) ctx.arcTo(x0, y1, x0, y1 - bl, bl); }
		if (cc[0]) { ctx.lineTo(x0, y0 + cc[0]); ctx.lineTo(x0 + cc[0], y0 + cc[0]); ctx.lineTo(x0 + cc[0], y0); }
		else { ctx.lineTo(x0, y0 + tl); if (tl) ctx.arcTo(x0, y0, x0 + tl, y0, tl); }
		ctx.closePath();
	};
	const weightDecor = (r: number, c: number, cost: Weight, covered: string | null) => {
		if (view.zoom < 0.35) return;
		const edge = weightEdge(p, cost);
		const lw = Math.max(1, Math.min(2, 0.08 * s));
		const g = wGeom(r, c, cost, lw / 2);
		const [tl, tr, br, bl] = g.rad;
		ctx.beginPath();
		if (!g.n) { ctx.moveTo(g.x0 + tl, g.y0); ctx.lineTo(g.x1 - tr, g.y0); if (tr) ctx.arcTo(g.x1, g.y0, g.x1, g.y0 + tr, tr); }
		if (!g.e) { ctx.moveTo(g.x1, g.y0 + tr); ctx.lineTo(g.x1, g.y1 - br); if (br) ctx.arcTo(g.x1, g.y1, g.x1 - br, g.y1, br); }
		if (!g.so) { ctx.moveTo(g.x1 - br, g.y1); ctx.lineTo(g.x0 + bl, g.y1); if (bl) ctx.arcTo(g.x0, g.y1, g.x0, g.y1 - bl, bl); }
		if (!g.w) { ctx.moveTo(g.x0, g.y1 - bl); ctx.lineTo(g.x0, g.y0 + tl); if (tl) ctx.arcTo(g.x0, g.y0, g.x0 + tl, g.y0, tl); }
		// concave notches: the two short inner edges
		const o = lw / 2;
		const [c0, c1, c2, c3] = g.cc;
		if (c0) { ctx.moveTo(g.x0, g.y0 + c0 + o); ctx.lineTo(g.x0 + c0 + o, g.y0 + c0 + o); ctx.lineTo(g.x0 + c0 + o, g.y0); }
		if (c1) { ctx.moveTo(g.x1 - c1 - o, g.y0); ctx.lineTo(g.x1 - c1 - o, g.y0 + c1 + o); ctx.lineTo(g.x1, g.y0 + c1 + o); }
		if (c2) { ctx.moveTo(g.x1, g.y1 - c2 - o); ctx.lineTo(g.x1 - c2 - o, g.y1 - c2 - o); ctx.lineTo(g.x1 - c2 - o, g.y1); }
		if (c3) { ctx.moveTo(g.x0 + c3 + o, g.y1); ctx.lineTo(g.x0 + c3 + o, g.y1 - c3 - o); ctx.lineTo(g.x0, g.y1 - c3 - o); }
		ctx.strokeStyle = edge;
		ctx.lineWidth = lw;
		ctx.stroke();
		if (view.zoom < 2) return;
		const { x, y } = g;
		ctx.fillStyle = labelOn(covered ?? weightColor(p, cost));
		ctx.font = `500 ${0.34 * s}px "DM Mono", monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(String(cost), x + s / 2, y + s / 2 + 0.02 * s);
		ctx.textAlign = 'left';
		if (view.zoom < 3) return; // texture only up close (design: >= 300%)
		ctx.strokeStyle = ctx.fillStyle = cost === 10 ? 'rgba(255,255,255,0.45)' : edge;
		if (cost === 10) {
			ctx.beginPath();
			for (const k of [0.2, 0.82]) {
				const yy = y + k * s;
				ctx.moveTo(x + 0.22 * s, yy);
				ctx.quadraticCurveTo(x + 0.36 * s, yy - 0.06 * s, x + 0.5 * s, yy);
				ctx.quadraticCurveTo(x + 0.64 * s, yy + 0.06 * s, x + 0.78 * s, yy);
			}
			ctx.lineWidth = Math.max(1, 0.035 * s);
			ctx.stroke();
		} else {
			const d = Math.max(1, 0.035 * s);
			const pts = cost === 2 ? [[0.22, 0.24], [0.78, 0.76]] : [[0.22, 0.24], [0.78, 0.24], [0.22, 0.78], [0.78, 0.78]];
			ctx.beginPath();
			for (const [u, v] of pts) {
				ctx.moveTo(x + u * s + d, y + v * s);
				ctx.arc(x + u * s, y + v * s, d, 0, Math.PI * 2);
			}
			ctx.fill();
		}
	};
	for (const cost of [2, 5, 10] as Weight[]) {
		ctx.beginPath();
		let any = false;
		for (const [r, c, w] of weightCells) {
			if (w !== cost) continue;
			any = true;
			blobCellPath(wGeom(r, c, cost));
		}
		if (!any) continue;
		ctx.fillStyle = weightColor(p, cost);
		ctx.fill();
	}
	for (const [r, c, w] of weightCells) weightDecor(r, c, w, null);

	// Walls: raised slabs from per-chunk cached bitmaps (walls.ts)
	let cache = wallCaches.get(ctx);
	if (!cache) wallCaches.set(ctx, (cache = new WallCache()));
	const wallSrc = {
		isWall: (r: number, c: number) => isWallAt(scene, r, c),
		changedAt: (r: number, c: number) => (inHome(r, c) ? scene.mirror.changedAt[r * HOME_COLS + c] : 0),
	};
	if (drawWalls(ctx, wallSrc, view, vb, p, dpr, scene.now, scene.reducedMotion, cache)) animating = true;

	// Visited: classic (mirror) and traced, entering at the frontier colour
	const visitedCell = (r: number, c: number, born: number, fade: number) => {
		const age = scene.now - born;
		const t = scene.reducedMotion || born === 0 ? 1 : Math.min(1, age / ENTER_MS);
		if (t < 1) animating = true;
		const k = 0.6 + 0.4 * ease(t);
		const { x, y } = cellToScreen(view, r, c);
		const inset = 0.05 * s;
		const w = (s - 2 * inset) * k;
		ctx.globalAlpha = fade;
		ctx.fillStyle = t < 1 ? mix(p.front, p.visited, ease(t)) : p.visited;
		roundRect(ctx, x + s / 2 - w / 2, y + s / 2 - w / 2, w, w, 0.18 * s * k);
		ctx.fill();
		ctx.globalAlpha = 1;
	};
	const m = scene.mirror;
	if (m.visitedCount > 0)
		for (let i = 0; i < m.kind.length; i++)
			if (m.kind[i] === K.Visited) {
				const { r, c } = LegacyMirror.cellAt(i);
				if (r >= vb.r0 && r <= vb.r1 && c >= vb.c0 && c <= vb.c1) visitedCell(r, c, m.changedAt[i], 1);
			}
	const tr = scene.trace;
	if (tr) {
		const total = Math.max(1, tr.visited.size);
		for (const [id, order] of tr.visited) {
			const { r, c } = parseId(id);
			if (r < vb.r0 || r > vb.r1 || c < vb.c0 || c > vb.c1) continue;
			visitedCell(r, c, scene.traceTimes.get(id) ?? 0, 1 - 0.2 * (1 - order / total));
		}
		// Frontier rings: thinner, with a slow breathing pulse (static under
		// reduced motion). Pulsing only while a few thousand are on screen.
		ctx.strokeStyle = p.front;
		ctx.lineWidth = Math.max(1, 0.06 * s);
		let onScreen = 0;
		ctx.beginPath();
		for (const id of tr.frontier.keys()) {
			const { r, c } = parseId(id);
			if (r < vb.r0 || r > vb.r1 || c < vb.c0 || c > vb.c1) continue;
			onScreen++;
			const { x, y } = cellToScreen(view, r, c);
			roundRectPath(ctx, x + 0.12 * s, y + 0.12 * s, s - 0.24 * s, s - 0.24 * s, [0.2 * s, 0.2 * s, 0.2 * s, 0.2 * s]);
		}
		const pulse = onScreen > 0 && onScreen <= FRONTIER_PULSE_MAX && !scene.reducedMotion && !tr.done;
		ctx.globalAlpha = pulse ? frontierAlpha(scene.now) : 1;
		ctx.stroke();
		ctx.globalAlpha = 1;
		if (pulse) animating = true;
	}
	for (const [r, c, t] of scene.board.entries(vb)) {
		if (t.kind !== 'weight' || isWallAt(scene, r, c)) continue;
		const covered = (inHome(r, c) && m.at(r, c) === K.Visited) || !!tr?.visited.has(idOf(r, c));
		if (covered) weightDecor(r, c, t.cost, p.visited);
	}

	// Home outline + label, on top of the cells so visited never hides them.
	// Colours meet 3:1 (line) and 4.5:1 (label) against the paper.
	ctx.save();
	ctx.strokeStyle = p.homeLine;
	ctx.lineWidth = 1.5;
	ctx.setLineDash([6, 4]);
	ctx.strokeRect(home.x - 1, home.y - 1, hw + 2, hh + 2);
	ctx.restore();
	ctx.fillStyle = p.label;
	ctx.font = '700 12px "Instrument Sans", system-ui, sans-serif';
	ctx.textBaseline = 'bottom';
	ctx.fillText('HOME · 35 × 80', home.x, home.y - 6);

	// Paths: traced path, and the classic Show Best Path preview (in tag order)
	const drawPath = (cells: { r: number; c: number }[]) => {
		if (cells.length < 1) return;
		ctx.save();
		ctx.globalAlpha = 0.14;
		ctx.fillStyle = p.path;
		for (const { r, c } of cells) {
			const { x, y } = cellToScreen(view, r, c);
			ctx.fillRect(x, y, s, s);
		}
		ctx.globalAlpha = 1;
		ctx.strokeStyle = p.path;
		ctx.lineWidth = Math.max(2, 0.32 * s);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.shadowColor = p.path;
		ctx.shadowBlur = 0.5 * s;
		ctx.beginPath();
		cells.forEach(({ r, c }, i) => {
			const { x, y } = cellToScreen(view, r, c);
			if (i === 0) ctx.moveTo(x + s / 2, y + s / 2);
			else ctx.lineTo(x + s / 2, y + s / 2);
		});
		if (cells.length === 1) {
			const { x, y } = cellToScreen(view, cells[0].r, cells[0].c);
			ctx.lineTo(x + s / 2 + 0.01, y + s / 2);
		}
		ctx.stroke();
		ctx.restore();
	};
	if (tr && tr.path.length) drawPath(tr.path.map(parseId));
	if (scene.bestPath && scene.bestPath.length && !m.previewOrder.length) drawPath(scene.bestPath);
	if (m.previewOrder.length) {
		const cells = m.previewOrder.map((i) => LegacyMirror.cellAt(i));
		if (m.start >= 0) cells.unshift(LegacyMirror.cellAt(m.start));
		drawPath(cells);
	}

	// Learn: ring the node the current event is about
	if (tr && scene.learnCurrent && tr.current) {
		const { r, c } = parseId(tr.current);
		const { x, y } = cellToScreen(view, r, c);
		ctx.strokeStyle = p.ink;
		ctx.lineWidth = Math.max(2, 0.12 * s);
		roundRect(ctx, x - 0.08 * s, y - 0.08 * s, s * 1.16, s * 1.16, 0.3 * s);
		ctx.stroke();
	}

	// Arrow and duck sprites (from the classic state)
	const duckCell = m.end >= 0 ? LegacyMirror.cellAt(m.end) : null;
	if (m.start >= 0) {
		const a = LegacyMirror.cellAt(m.start);
		drawArrow(ctx, view, a.r, a.c, duckCell, p);
	}
	if (duckCell) drawDuck(ctx, view, duckCell.r, duckCell.c, p, !!(tr && tr.trace.result.found && tr.done));

	// Hover outline
	if (scene.hover) {
		const { x, y } = cellToScreen(view, scene.hover.r, scene.hover.c);
		ctx.strokeStyle = p.ink;
		ctx.globalAlpha = 0.35;
		ctx.lineWidth = 1.5;
		roundRect(ctx, x + 0.06 * s, y + 0.06 * s, s - 0.12 * s, s - 0.12 * s, 0.22 * s);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}
	return animating;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	roundRectPath(ctx, x, y, w, h, [r, r, r, r]);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number[]) {
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

function drawArrow(
	ctx: CanvasRenderingContext2D,
	view: View,
	r: number,
	c: number,
	toward: { r: number; c: number } | null,
	p: Palette,
) {
	let { x, y, s } = cellToScreen(view, r, c);
	if (s < 12) {
		x -= (12 - s) / 2;
		y -= (12 - s) / 2;
		s = 12;
	}
	ctx.fillStyle = p.start;
	roundRect(ctx, x + 0.04 * s, y + 0.04 * s, s * 0.92, s * 0.92, 0.3 * s);
	ctx.fill();
	const angle = toward ? Math.atan2(toward.r - r, toward.c - c) : 0;
	ctx.save();
	ctx.translate(x + s / 2, y + s / 2);
	ctx.rotate(angle);
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = Math.max(1.5, 0.09 * s);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(-0.26 * s, 0);
	ctx.lineTo(0.26 * s, 0);
	ctx.moveTo(0.08 * s, -0.17 * s);
	ctx.lineTo(0.26 * s, 0);
	ctx.lineTo(0.08 * s, 0.17 * s);
	ctx.moveTo(-0.26 * s, 0);
	ctx.lineTo(-0.36 * s, -0.12 * s);
	ctx.moveTo(-0.26 * s, 0);
	ctx.lineTo(-0.36 * s, 0.12 * s);
	ctx.stroke();
	ctx.restore();
}

/** The modern duck mark (filled shapes after src/Images/duck.png). */
export function drawDuck(
	ctx: CanvasRenderingContext2D,
	view: View,
	r: number,
	c: number,
	p: Palette,
	found: boolean,
) {
	const cell = cellToScreen(view, r, c);
	const s = Math.max(12, cell.s) * 1.12;
	const cx = cell.x + cell.s / 2;
	const cy = cell.y + cell.s / 2;
	ctx.save();
	if (!found) {
		ctx.fillStyle = 'rgba(255,208,0,0.30)';
		ctx.beginPath();
		ctx.arc(cx, cy, 0.62 * s, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.translate(cx, cy);
	ctx.lineWidth = Math.max(1, 0.05 * s);
	ctx.strokeStyle = '#1c2230';
	ctx.lineJoin = 'round';
	// body
	ctx.fillStyle = p.duck;
	ctx.beginPath();
	ctx.ellipse(0.06 * s, 0.14 * s, 0.4 * s, 0.26 * s, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	// tail
	ctx.beginPath();
	ctx.moveTo(0.36 * s, 0.02 * s);
	ctx.lineTo(0.5 * s, -0.12 * s);
	ctx.lineTo(0.44 * s, 0.12 * s);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	// head
	ctx.beginPath();
	ctx.arc(-0.16 * s, -0.16 * s, 0.21 * s, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	// beak
	ctx.fillStyle = '#ff9a1f';
	ctx.beginPath();
	ctx.ellipse(-0.4 * s, -0.12 * s, 0.11 * s, 0.06 * s, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
	// eye + wing smile
	ctx.fillStyle = '#1c2230';
	ctx.beginPath();
	ctx.arc(-0.2 * s, -0.2 * s, 0.035 * s, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.arc(0.08 * s, 0.08 * s, 0.16 * s, 0.15 * Math.PI, 0.85 * Math.PI);
	ctx.stroke();
	ctx.restore();
}
