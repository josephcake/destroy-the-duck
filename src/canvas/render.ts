// Canvas 2D renderer. Cost is proportional to content, not to viewport area:
// it walks Home (2,800 cells), board chunks in view and the trace overlay.
import { Board } from '../model/board';
import { HOME, HOME_COLS, HOME_ROWS, idOf, inHome, parseId } from '../model/cell';
import { TraceState } from '../learn/player';
import { K, LegacyMirror } from './mirror';
import { Palette, mix, weightColor, weightEdge } from './palette';
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


	// Weight edge + texture. Drawn again over visited cells so the cost stays
	// readable after the search passes (fix 7): dots = cost (2, 5), waves = water.
	const weightMarks = (r: number, c: number, cost: number, covered: boolean) => {
		if (view.zoom < 0.35) return;
		const { x, y } = cellToScreen(view, r, c);
		const edge = weightEdge(p, cost);
		const inset = view.zoom >= 0.5 ? 0.06 * s : 0;
		ctx.strokeStyle = edge;
		ctx.lineWidth = Math.max(1, Math.min(2, 0.08 * s));
		roundRect(ctx, x + inset + 0.75, y + inset + 0.75, s - 2 * inset - 1.5, s - 2 * inset - 1.5, view.zoom >= 0.5 ? 0.2 * s : 0);
		ctx.stroke();
		if (view.zoom >= 2) {
			ctx.fillStyle = covered ? edge : cost === 10 ? 'rgba(255,255,255,0.85)' : 'rgba(28,34,48,0.72)';
			ctx.font = `500 ${0.34 * s}px "DM Mono", monospace`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(String(cost), x + s / 2, y + s / 2 + 0.02 * s);
			ctx.textAlign = 'left';
			return;
		}
		if (view.zoom < 0.75) return;
		ctx.fillStyle = edge;
		const d = Math.max(1, 0.07 * s);
		if (cost === 10) {
			ctx.beginPath();
			for (const k of [0.38, 0.62]) {
				const yy = y + k * s;
				ctx.moveTo(x + 0.25 * s, yy);
				ctx.quadraticCurveTo(x + 0.375 * s, yy - 0.08 * s, x + 0.5 * s, yy);
				ctx.quadraticCurveTo(x + 0.625 * s, yy + 0.08 * s, x + 0.75 * s, yy);
			}
			ctx.lineWidth = Math.max(1, 0.06 * s);
			ctx.stroke();
		} else {
			const pts = cost === 2 ? [[0.35, 0.35], [0.65, 0.65]] : [[0.32, 0.32], [0.68, 0.32], [0.5, 0.5], [0.32, 0.68], [0.68, 0.68]];
			ctx.beginPath();
			for (const [u, v] of pts) {
				ctx.moveTo(x + u * s + d, y + v * s);
				ctx.arc(x + u * s, y + v * s, d, 0, Math.PI * 2);
			}
			ctx.fill();
		}
	};

	// Weights (board store; classic Home walls win over a weight underneath)
	for (const [r, c, t] of scene.board.entries(vb)) {
		if (t.kind !== 'weight' || isWallAt(scene, r, c)) continue;
		const { x, y } = cellToScreen(view, r, c);
		ctx.fillStyle = weightColor(p, t.cost);
		const inset = view.zoom >= 0.5 ? 0.06 * s : 0;
		roundRect(ctx, x + inset, y + inset, s - 2 * inset, s - 2 * inset, view.zoom >= 0.5 ? 0.22 * s : 0);
		ctx.fill();
		weightMarks(r, c, t.cost, false);
	}

	// Walls: merged look, outer corners rounded where both neighbours are open
	const walls: [number, number][] = [];
	for (let r = Math.max(0, vb.r0); r <= Math.min(HOME.r1, vb.r1); r++)
		for (let c = Math.max(0, vb.c0); c <= Math.min(HOME.c1, vb.c1); c++)
			if (scene.mirror.at(r, c) === K.Wall) walls.push([r, c]);
	for (const [r, c, t] of scene.board.entries(vb)) if (t.kind === 'wall' && !inHome(r, c)) walls.push([r, c]);
	const fancy = view.zoom >= 0.5;
	if (fancy && !scene.reducedMotion) {
		ctx.save();
		ctx.shadowColor = p.shadow;
		ctx.shadowBlur = 0.22 * s;
		ctx.shadowOffsetY = 0.1 * s;
	}
	ctx.fillStyle = p.wall;
	ctx.beginPath();
	for (const [r, c] of walls) {
		const { x, y } = cellToScreen(view, r, c);
		const up = isWallAt(scene, r - 1, c);
		const dn = isWallAt(scene, r + 1, c);
		const lf = isWallAt(scene, r, c - 1);
		const rt = isWallAt(scene, r, c + 1);
		const R = fancy ? 0.28 * s : 0;
		const rad = [!up && !lf ? R : 0, !up && !rt ? R : 0, !dn && !rt ? R : 0, !dn && !lf ? R : 0];
		roundRectPath(ctx, x - 0.25, y - 0.25, s + 0.5, s + 0.5, rad);
	}
	ctx.fill();
	if (fancy && !scene.reducedMotion) ctx.restore();

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
		if (covered) weightMarks(r, c, t.cost, true);
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
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = 1.5;
		ctx.strokeRect(x + 0.75, y + 0.75, s - 1.5, s - 1.5);
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
