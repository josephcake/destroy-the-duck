// One-way lane drag (Prism one-way spec §1.1, §1.2): the drag picks an axis once
// the pointer is 0.5 cell from the down point and switches only after 0.75 cell
// of travel on the other axis, so a 45° drag lays an L, never a staircase. The
// corner cell takes the new direction. Mid-drag a turn also needs the pointer to
// be moving mostly across the lane (a diagonal keeps the axis); on release, an
// offset of 0.75 cell or more lays the second arm, which is what makes a 45°
// drag an L. Pure: positions are world cells as floats
// (x = column, y = row); `place` does the writing.
import { Dir } from '../model/board';
import { clampToBoard } from '../model/bounds';

export const LOCK_CELLS = 0.5;
export const SWITCH_CELLS = 0.75;

export type Cell = { r: number; c: number };
export type LaneDrag = {
	down: { x: number; y: number };
	axis: 'h' | 'v' | null;
	dir: Dir | null;
	/** the head: the last cell laid */
	cur: Cell;
	/** recent motion (smoothed), to tell a turn from a diagonal */
	last: { x: number; y: number };
	vx: number;
	vy: number;
};

const cellOf = (x: number, y: number) => clampToBoard(Math.floor(y), Math.floor(x));
export const dirFor = (axis: 'h' | 'v', sign: number): Dir => (axis === 'h' ? (sign >= 0 ? 1 : 3) : sign >= 0 ? 2 : 0);
/** Quarter turn: clockwise N -> E -> S -> W, or counter-clockwise. */
export const turn = (d: Dir, ccw = false): Dir => ((d + (ccw ? 3 : 1)) % 4) as Dir;

export function laneStart(x: number, y: number): LaneDrag {
	return { down: { x, y }, axis: null, dir: null, cur: cellOf(x, y), last: { x, y }, vx: 0, vy: 0 };
}

/** Advances the drag to (x, y), laying cells through `place(r, c, dir)`. */
export function laneMove(g: LaneDrag, x: number, y: number, place: (r: number, c: number, d: Dir) => void) {
	g.vx = g.vx * 0.6 + (x - g.last.x) * 0.4;
	g.vy = g.vy * 0.6 + (y - g.last.y) * 0.4;
	g.last = { x, y };
	if (!g.axis) {
		const dx = x - g.down.x, dy = y - g.down.y;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_CELLS) return;
		g.axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
		g.dir = dirFor(g.axis, g.axis === 'h' ? dx : dy);
		place(g.cur.r, g.cur.c, g.dir); // the first cell commits with the locked direction
	}
	// switch axis after 0.75 cell off the lane's centre line
	const perp = g.axis === 'h' ? y - (g.cur.r + 0.5) : x - (g.cur.c + 0.5);
	const across = Math.abs(g.axis === 'h' ? g.vy : g.vx) > 1.2 * Math.abs(g.axis === 'h' ? g.vx : g.vy);
	turnOrWalk(g, x, y, perp, across, place);
}

/** Pointer up: a lane still 0.75 cell or more off the pointer gets its second arm. */
export function laneEnd(g: LaneDrag, x: number, y: number, place: (r: number, c: number, d: Dir) => void) {
	if (!g.axis) return;
	const perp = g.axis === 'h' ? y - (g.cur.r + 0.5) : x - (g.cur.c + 0.5);
	turnOrWalk(g, x, y, perp, true, place);
}

function turnOrWalk(g: LaneDrag, x: number, y: number, perp: number, across: boolean, place: (r: number, c: number, d: Dir) => void) {
	const target = cellOf(x, y);
	if (Math.abs(perp) >= SWITCH_CELLS && across) {
		walk(g, g.axis === 'h' ? { r: g.cur.r, c: target.c } : { r: target.r, c: g.cur.c }, place); // finish this leg
		g.axis = g.axis === 'h' ? 'v' : 'h';
		g.dir = dirFor(g.axis, perp);
		place(g.cur.r, g.cur.c, g.dir); // the corner turns
	}
	walk(g, g.axis === 'h' ? { r: g.cur.r, c: target.c } : { r: target.r, c: g.cur.c }, place);
}

/** Walks the head along its axis to `to`, re-pointing the head when the motion reverses. */
function walk(g: LaneDrag, to: Cell, place: (r: number, c: number, d: Dir) => void) {
	const dr = Math.sign(to.r - g.cur.r), dc = Math.sign(to.c - g.cur.c);
	if (!dr && !dc) return;
	const d = dirFor(g.axis!, dr || dc);
	if (d !== g.dir) {
		g.dir = d; // back-tracking: the lane follows your last motion
		place(g.cur.r, g.cur.c, d);
	}
	while (g.cur.r !== to.r || g.cur.c !== to.c) {
		g.cur = { r: g.cur.r + dr, c: g.cur.c + dc };
		place(g.cur.r, g.cur.c, d);
	}
}
