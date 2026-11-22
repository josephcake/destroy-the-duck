// Builds the engine input from the two sources of truth in Phase A:
// the legacy mirror (walls in the classic window, Arrow, Duck) and the new Board.
import { Board } from '../model/board';
import { Bounds, Cell, HOME_COLS, HOME_ROWS, keyOf } from '../model/cell';
import { Dir, Snapshot } from '../engine/graph';
import { FindMode } from '../engine/trace';
import { K, LegacyMirror, windowCell, windowIndex } from '../canvas/mirror';

export const MARGIN = 16;
// No visit budget: the search area is finite (everything on the board plus
// MARGIN), and every algorithm stops on a finite area (IDA* too: its
// transposition table keeps each dive within the area).
export const BUDGET = Number.POSITIVE_INFINITY;

type MirrorView = Pick<LegacyMirror, 'kind' | 'start' | 'end'> & { origin?: Cell };

/** The box around everything placed: board tiles, window walls, Arrow and Duck (null on an empty board). */
export function contentBox(board: Board, mirror?: MirrorView): Bounds | null {
	let b = board.contentBounds();
	const grow = (r: number, c: number) => {
		if (!b) b = { r0: r, c0: c, r1: r, c1: c };
		else b = { r0: Math.min(b.r0, r), c0: Math.min(b.c0, c), r1: Math.max(b.r1, r), c1: Math.max(b.c1, c) };
	};
	if (mirror) {
		const o = mirror.origin ?? { r: 0, c: 0 };
		for (let i = 0; i < mirror.kind.length; i++)
			if (mirror.kind[i] === K.Wall || i === mirror.start || i === mirror.end) {
				const q = windowCell(o, i);
				grow(q.r, q.c);
			}
	}
	return b;
}

/** The search area: the content box plus MARGIN on every side. The canvas itself has no edges. */
export function searchBounds(board: Board, mirror?: MirrorView): Bounds {
	const x = contentBox(board, mirror) ?? { r0: 0, c0: 0, r1: 0, c1: 0 };
	return { r0: x.r0 - MARGIN, c0: x.c0 - MARGIN, r1: x.r1 + MARGIN, c1: x.c1 + MARGIN };
}

export type BuildOpts = { findMode?: FindMode };

export function buildSnapshot(board: Board, mirror: MirrorView, opts: BuildOpts = {}): Snapshot {
	const o = mirror.origin ?? { r: 0, c: 0 };
	const walls: number[] = [];
	for (let i = 0; i < HOME_ROWS * HOME_COLS; i++)
		if (mirror.kind[i] === K.Wall) {
			const q = windowCell(o, i);
			walls.push(keyOf(q.r, q.c));
		}
	const weights: [number, number][] = [];
	const oneWay: [number, Dir][] = [];
	const padsBy = new Map<number, number[]>();
	const ducks: { n: number; cell: Cell }[] = [];
	// the classic table wins inside its window: its walls and endpoints hide board tiles
	const tableWall = (r: number, c: number) => {
		const i = windowIndex(o, r, c);
		return i >= 0 && mirror.kind[i] === K.Wall;
	};
	const tableEndpoint = (r: number, c: number) => {
		const i = windowIndex(o, r, c);
		return i >= 0 && (i === mirror.start || i === mirror.end);
	};
	for (const [r, c, t] of board.entries()) {
		if (t.kind === 'wall') {
			if (windowIndex(o, r, c) < 0) walls.push(keyOf(r, c));
			continue;
		}
		if (tableWall(r, c) || tableEndpoint(r, c)) continue;
		if (t.kind === 'weight') weights.push([keyOf(r, c), t.cost]);
		else if (t.kind === 'oneway') oneWay.push([keyOf(r, c), t.dir]);
		else if (t.kind === 'pad') padsBy.set(t.pair, [...(padsBy.get(t.pair) ?? []), keyOf(r, c)]);
		else if (t.kind === 'duck') ducks.push({ n: t.n, cell: { r, c } });
	}
	const pads: [number, number][] = [];
	for (const ks of padsBy.values()) if (ks.length === 2) pads.push([ks[0], ks[1]]);
	ducks.sort((x, y) => x.n - y.n);
	const cellOf = (i: number) => windowCell(o, i);
	return {
		bounds: searchBounds(board, mirror),
		walls,
		weights,
		...(oneWay.length ? { oneWay } : {}),
		...(pads.length ? { pads } : {}),
		start: cellOf(mirror.start),
		goals: [cellOf(mirror.end), ...ducks.map((d) => d.cell)],
		...(opts.findMode && ducks.length ? { findMode: opts.findMode } : {}),
		budget: BUDGET,
	};
}

export { lonePads, nextPadPair, nextDuck } from '../model/nodes';
