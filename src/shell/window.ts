// The classic window: the hidden 35x80 table (which the classic six run on,
// unchanged) covers a 35x80 patch of the endless board at mirror.origin.
// When the Arrow or Duck 1 is dropped outside it, the window moves:
//   1. every table wall goes to the Board (world cells),
//   2. the Arrow and Duck move to their new table cells with the table's own
//      drag handlers (mousedown / mousemove / mouseup, as a player would),
//   3. the origin changes, and Board walls inside the new window go back
//      into the table, so the classic six see them.
// Invariant: the Board holds no walls inside the window (the table does).
import { flushSync } from 'react-dom';
import { Board } from '../model/board';
import { Cell, HOME_COLS, HOME_ROWS, idOf } from '../model/cell';
import { LegacyMirror, legacy, windowBounds, windowIndex } from '../canvas/mirror';

const STATE = /\b(\w+)_(unvisited|visited|wall)\b/;
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

/** The window origin that holds both cells, centred on them; null when they are too far apart. */
export function windowFor(a: Cell, b: Cell): Cell | null {
	const fit = (x: number, y: number, n: number) => {
		const lo = Math.min(x, y);
		const span = Math.abs(x - y);
		return span >= n ? null : lo - Math.floor((n - 1 - span) / 2);
	};
	const r = fit(a.r, b.r, HOME_ROWS);
	const c = fit(a.c, b.c, HOME_COLS);
	return r === null || c === null ? null : { r, c };
}

export type DropResult = 'moved' | 'blocked' | 'too-far';

/**
 * Puts the Arrow ('start') or Duck 1 ('end') on world cell `target`, moving
 * the classic window when the target is outside it. The caller clears any
 * run first (visited cells and the best-path preview).
 */
export function placeEndpoint(mirror: LegacyMirror, board: Board, which: 'start' | 'end', target: Cell): DropResult {
	const curI = tableIndex(which);
	const otherI = tableIndex(which === 'start' ? 'end' : 'start');
	if (curI < 0 || otherI < 0) return 'blocked';
	const other = mirror.cellAt(otherI);
	if (target.r === other.r && target.c === other.c) return 'blocked';
	if (mirror.inWindow(target.r, target.c) ? mirror.at(target.r, target.c) === 1 /* K.Wall */ : board.get(target.r, target.c)?.kind === 'wall') return 'blocked';
	const o = windowFor(target, other);
	if (!o) return 'too-far';
	if (board.get(target.r, target.c)) board.set(target.r, target.c, undefined); // a node under the drop gives way
	if (mirror.inWindow(target.r, target.c)) {
		dragTableCell(idOfIndex(curI), mirror.idAt(target.r, target.c));
		return 'moved';
	}
	mirror.silent = true;
	// 1. table walls out to the Board
	for (let i = 0; i < HOME_ROWS * HOME_COLS; i++) {
		const el = td(idOfIndex(i));
		if (!el || !/_wall\b/.test(el.className)) continue;
		const q = mirror.cellAt(i);
		board.set(q.r, q.c, { kind: 'wall' });
		setState(idOfIndex(i), 'unvisited');
	}
	// 2. Arrow and Duck to their new table cells (never onto each other mid-way)
	const newCur = windowIndex(o, target.r, target.c);
	const newOther = windowIndex(o, other.r, other.c);
	let moves: [number, number][] = [
		[curI, newCur],
		[otherI, newOther],
	];
	if (newCur === otherI) {
		if (newOther === curI) {
			const tmp = [...Array(HOME_ROWS * HOME_COLS).keys()].find((i) => i !== curI && i !== otherI && i !== newCur && i !== newOther)!;
			dragTableCell(idOfIndex(curI), idOfIndex(tmp));
			moves = [
				[otherI, newOther],
				[tmp, newCur],
			];
		} else moves.reverse();
	}
	for (const [a, b] of moves) dragTableCell(idOfIndex(a), idOfIndex(b));
	// 3. the window moves; Board walls inside it go into the table
	mirror.origin = o;
	for (const [r, c, t] of [...board.entries(windowBounds(o))]) {
		const i = windowIndex(o, r, c);
		if (i < 0 || t.kind !== 'wall') continue;
		board.set(r, c, undefined);
		if (i !== newCur && i !== newOther) setState(idOfIndex(i), 'wall');
	}
	return 'moved';
}
