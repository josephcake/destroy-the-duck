// Builds the engine input from the two sources of truth in Phase A:
// the legacy mirror (Home walls, Arrow, Duck) and the new Board.
import { Board } from '../model/board';
import { Bounds, HOME, HOME_COLS, HOME_ROWS, inHome, keyOf } from '../model/cell';
import { Snapshot } from '../engine/graph';
import { K, LegacyMirror } from '../canvas/mirror';

export const MARGIN = 16;
export const BUDGET = 250_000;

export function searchBounds(board: Board): Bounds {
	const c = board.contentBounds();
	const b = c
		? { r0: Math.min(c.r0, HOME.r0), c0: Math.min(c.c0, HOME.c0), r1: Math.max(c.r1, HOME.r1), c1: Math.max(c.c1, HOME.c1) }
		: { ...HOME };
	return { r0: b.r0 - MARGIN, c0: b.c0 - MARGIN, r1: b.r1 + MARGIN, c1: b.c1 + MARGIN };
}

export function buildSnapshot(board: Board, mirror: Pick<LegacyMirror, 'kind' | 'start' | 'end'>): Snapshot {
	const walls: number[] = [];
	for (let i = 0; i < HOME_ROWS * HOME_COLS; i++)
		if (mirror.kind[i] === K.Wall) walls.push(keyOf(Math.floor(i / HOME_COLS), i % HOME_COLS));
	const weights: [number, number][] = [];
	for (const [r, c, t] of board.entries()) {
		if (t.kind === 'wall') {
			if (!inHome(r, c)) walls.push(keyOf(r, c));
		} else if (!(inHome(r, c) && mirror.kind[r * HOME_COLS + c] === K.Wall)) {
			weights.push([keyOf(r, c), t.cost]);
		}
	}
	const cellOf = (i: number) => ({ r: Math.floor(i / HOME_COLS), c: i % HOME_COLS });
	return {
		bounds: searchBounds(board),
		walls,
		weights,
		start: cellOf(mirror.start),
		goals: [cellOf(mirror.end)],
		budget: BUDGET,
	};
}
