// The classic window: the hidden 35x80 table (which the classic six run on,
// unchanged) covers a 35x80 patch of the endless board at mirror.origin.
//
// Table mode (the Arrow and Duck 1 fit in one 35x80 window): the window
// follows them. Moving it:
//   1. every table wall goes to the Board (world cells),
//   2. the Arrow and Duck move to their new table cells with the table's own
//      drag handlers (mousedown / mousemove / mouseup, as a player would),
//   3. the origin changes, and Board walls inside the new window go back
//      into the table, so the classic six see them.
// Invariant: the Board holds no walls inside the window (the table does).
//
// Free mode (they are further apart): step 1 only; the table sits idle and the
// Arrow and Duck 1 live in mirror.free. Classic runs then go wide
// (classic/wide.ts): the same helpers on a shim sized to the content.
import { flushSync } from 'react-dom';
import { Board } from '../model/board';
import { Bounds, Cell, HOME_COLS, HOME_ROWS, idOf } from '../model/cell';
import { LegacyMirror, legacy, windowBounds, windowIndex } from '../canvas/mirror';
import { MARGIN, contentBox } from './snapshot';
import { WideJob } from '../classic/wide';
import { ClassicAlgo } from '../engine/trace';

const STATE = /\b(\w+)_(unvisited|visited|wall)\b/;
const N = HOME_ROWS * HOME_COLS;
const td = (id: string) => document.getElementById(id);
const setState = (id: string, want: 'wall' | 'unvisited') => {
	const el = td(id);
	if (el && STATE.test(el.className)) el.className = el.className.replace(STATE, `$1_${want}`).replace(/\s*\bpreview\b/, '');
};

/** Moves the Arrow or Duck between two table cells with the table's own drag handlers. */
export function dragTableCell(fromId: string, toId: string) {
	if (fromId === toId) return;
	flushSync(() => legacy.down(fromId));
	flushSync(() => legacy.move(toId));
	flushSync(() => legacy.up());
}

/** Table index of the Arrow ('start') or Duck 1 ('end'), read from the table itself (the mirror lags a microtask). */
function tableIndex(which: 'start' | 'end') {
	const el = document.querySelector(`#main td[class*="_${which === 'start' ? 'starting' : 'ending'}"]`);
	const m = el && /^(\d+)-(\d+)$/.exec(el.id);
	return m ? Number(m[1]) * HOME_COLS + Number(m[2]) : -1;
}
const idOfIndex = (i: number) => idOf(Math.floor(i / HOME_COLS), i % HOME_COLS);

/** The window origin that holds the box, centred on it; null when it is bigger than 35x80. */
export function windowForBox(b: Bounds): Cell | null {
	const fit = (lo: number, hi: number, n: number) => (hi - lo >= n ? null : lo - Math.floor((n - 1 - (hi - lo)) / 2));
	const r = fit(b.r0, b.r1, HOME_ROWS);
	const c = fit(b.c0, b.c1, HOME_COLS);
	return r === null || c === null ? null : { r, c };
}
/** The window origin that holds both cells, centred on them; null when they are too far apart. */
export const windowFor = (a: Cell, b: Cell) =>
	windowForBox({ r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) });

/** Step 1: table walls out to the Board. */
function wallsOut(mirror: LegacyMirror, board: Board) {
	for (let i = 0; i < N; i++) {
		const el = td(idOfIndex(i));
		if (!el || !/_wall\b/.test(el.className)) continue;
		const q = mirror.cellAt(i);
		board.set(q.r, q.c, { kind: 'wall' });
		setState(idOfIndex(i), 'unvisited');
	}
}

/**
 * Puts the table at origin `o` with the Arrow on `start` and Duck 1 on `end`
 * (both inside it), leaving free mode if the mirror was in it.
 */
export function setWindow(mirror: LegacyMirror, board: Board, o: Cell, start: Cell, end: Cell) {
	const sI = tableIndex('start');
	const eI = tableIndex('end');
	if (sI < 0 || eI < 0) return;
	mirror.silent = true;
	if (!mirror.free) wallsOut(mirror, board); // free mode already has none in the table
	// 2. Arrow and Duck to their new table cells (never onto each other mid-way)
	const newS = windowIndex(o, start.r, start.c);
	const newE = windowIndex(o, end.r, end.c);
	let moves: [number, number][] = [
		[sI, newS],
		[eI, newE],
	];
	if (newS === eI) {
		if (newE === sI) {
			const tmp = [...Array(N).keys()].find((i) => i !== sI && i !== eI && i !== newS && i !== newE)!;
			dragTableCell(idOfIndex(sI), idOfIndex(tmp));
			moves = [
				[eI, newE],
				[tmp, newS],
			];
		} else moves.reverse();
	}
	for (const [a, b] of moves) dragTableCell(idOfIndex(a), idOfIndex(b));
	// 3. the window moves; Board walls inside it go into the table
	mirror.free = null;
	mirror.origin = o;
	for (const [r, c, t] of [...board.entries(windowBounds(o))]) {
		const i = windowIndex(o, r, c);
		if (i < 0 || t.kind !== 'wall') continue;
		board.set(r, c, undefined);
		if (i !== newS && i !== newE) setState(idOfIndex(i), 'wall');
	}
}

export type DropResult = 'moved' | 'blocked';

/**
 * Puts the Arrow ('start') or Duck 1 ('end') on world cell `target`, anywhere.
 * The caller clears any run first (visited cells and the best-path preview).
 */
export function placeEndpoint(mirror: LegacyMirror, board: Board, which: 'start' | 'end', target: Cell): DropResult {
	const cur = which === 'start' ? mirror.startCell() : mirror.endCell();
	const other = which === 'start' ? mirror.endCell() : mirror.startCell();
	if (!cur || !other) return 'blocked';
	if (target.r === cur.r && target.c === cur.c) return 'moved';
	if (target.r === other.r && target.c === other.c) return 'blocked';
	if (mirror.inWindow(target.r, target.c) ? mirror.at(target.r, target.c) === 1 /* K.Wall */ : board.get(target.r, target.c)?.kind === 'wall') return 'blocked';
	if (board.get(target.r, target.c)) board.set(target.r, target.c, undefined); // a node under the drop gives way
	if (mirror.inWindow(target.r, target.c)) {
		dragTableCell(idOfIndex(tableIndex(which)), mirror.idAt(target.r, target.c));
		return 'moved';
	}
	const start = which === 'start' ? target : other;
	const end = which === 'end' ? target : other;
	const o = windowFor(start, end);
	if (o) setWindow(mirror, board, o, start, end);
	else {
		if (!mirror.free) {
			mirror.silent = true;
			wallsOut(mirror, board);
		}
		mirror.free = { start, end };
	}
	return 'moved';
}

/**
 * Where a classic run happens: on the table when everything placed fits in a
 * 35x80 window (moving the window over it first if needed; the classic
 * framing and visit order are exactly as before), else wide, on the content
 * box plus MARGIN.
 */
export type ClassicFrame = { kind: 'table'; origin: Cell } | { kind: 'wide'; bounds: Bounds; rows: number; cols: number };
export function classicFrame(board: Board, mirror: LegacyMirror): ClassicFrame {
	const box = contentBox(board, mirror) ?? mirror.window;
	const w = mirror.window;
	if (!mirror.free) {
		if (box.r0 >= w.r0 && box.c0 >= w.c0 && box.r1 <= w.r1 && box.c1 <= w.c1) return { kind: 'table', origin: mirror.origin };
		const o = windowForBox(box);
		if (o) return { kind: 'table', origin: o };
	}
	const bounds = { r0: box.r0 - MARGIN, c0: box.c0 - MARGIN, r1: box.r1 + MARGIN, c1: box.c1 + MARGIN };
	return { kind: 'wide', bounds, rows: bounds.r1 - bounds.r0 + 1, cols: bounds.c1 - bounds.c0 + 1 };
}

/** Moves the table window to `origin` (table mode only), keeping the Arrow and Duck where they are. */
export function moveWindow(mirror: LegacyMirror, board: Board, origin: Cell) {
	const a = mirror.startCell();
	const d = mirror.endCell();
	if (mirror.free || !a || !d || (origin.r === mirror.origin.r && origin.c === mirror.origin.c)) return;
	setWindow(mirror, board, origin, a, d);
}

/** The wide run's input: the classic class strings for every cell of `bounds`. */
export function wideJob(algo: ClassicAlgo, board: Board, mirror: LegacyMirror, bounds: Bounds, seed?: number): WideJob {
	const rows = bounds.r1 - bounds.r0 + 1;
	const cols = bounds.c1 - bounds.c0 + 1;
	const a = mirror.startCell()!;
	const d = mirror.endCell()!;
	const classes = new Array<string>(rows * cols);
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const R = r + bounds.r0;
			const C = c + bounds.c0;
			const wall = mirror.inWindow(R, C) ? mirror.at(R, C) === 1 /* K.Wall */ : board.get(R, C)?.kind === 'wall';
			classes[r * cols + c] = R === a.r && C === a.c ? 'light_starting' : R === d.r && C === d.c ? 'light_ending' : wall ? 'light_wall' : 'light_unvisited';
		}
	return { algo, classes, cols, starting: idOf(a.r - bounds.r0, a.c - bounds.c0), ending: idOf(d.r - bounds.r0, d.c - bounds.c0), origin: { r: bounds.r0, c: bounds.c0 }, seed };
}
