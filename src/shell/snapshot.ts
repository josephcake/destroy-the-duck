// Builds the engine input from the two sources of truth in Phase A:
// the legacy mirror (walls in the classic window, Arrow, Duck) and the new Board.
import { BOARD } from '../model/bounds';
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

type MirrorView = Pick<LegacyMirror, 'kind' | 'start' | 'end'> & { origin?: Cell; free?: LegacyMirror['free'] };

/** World cells of the Arrow and Duck 1: from the table, or from free mode (mirror.ts). */
export function endpoints(mirror: MirrorView): { start: Cell | null; end: Cell | null } {
	if (mirror.free) return mirror.free;
	const o = mirror.origin ?? { r: 0, c: 0 };
	return { start: mirror.start >= 0 ? windowCell(o, mirror.start) : null, end: mirror.end >= 0 ? windowCell(o, mirror.end) : null };
}

/** The box around everything placed: board tiles, window walls, Arrow and Duck (null on an empty board). */
export function contentBox(board: Board, mirror?: MirrorView): Bounds | null {
	let b = board.contentBounds();
	const grow = (r: number, c: number) => {
		if (!b) b = { r0: r, c0: c, r1: r, c1: c };
		else b = { r0: Math.min(b.r0, r), c0: Math.min(b.c0, c), r1: Math.max(b.r1, r), c1: Math.max(b.c1, c) };
	};
	if (mirror) {
		const o = mirror.origin ?? { r: 0, c: 0 };
		if (!mirror.free)
			for (let i = 0; i < mirror.kind.length; i++)
				if (mirror.kind[i] === K.Wall) {
					const q = windowCell(o, i);
					grow(q.r, q.c);
				}
		const { start, end } = endpoints(mirror);
		for (const q of [start, end]) if (q) grow(q.r, q.c);
	}
	return b;
}

/** The search area: the whole bounded board (model/bounds.ts). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function searchBounds(_board?: Board, _mirror?: MirrorView): Bounds {
	return { ...BOARD };
}

export type BuildOpts = { findMode?: FindMode };

export function buildSnapshot(board: Board, mirror: MirrorView, opts: BuildOpts = {}): Snapshot {
	const o = mirror.origin ?? { r: 0, c: 0 };
	const free = !!mirror.free; // free mode: the table is idle, everything is on the Board
	const tableIndex = (r: number, c: number) => (free ? -1 : windowIndex(o, r, c));
	const walls: number[] = [];
	for (let i = 0; i < HOME_ROWS * HOME_COLS; i++)
		if (!free && mirror.kind[i] === K.Wall) {
			const q = windowCell(o, i);
			walls.push(keyOf(q.r, q.c));
		}
	const checkpoints: number[] = [];
	const oneWay: [number, Dir][] = [];
	const padsBy = new Map<number, number[]>();
	const ducks: { n: number; cell: Cell }[] = [];
	// the classic table wins inside its window: its walls and endpoints hide board tiles
	const ends = endpoints(mirror);
	const tableWall = (r: number, c: number) => {
		const i = tableIndex(r, c);
		return i >= 0 && mirror.kind[i] === K.Wall;
	};
	const isEndpoint = (r: number, c: number) => [ends.start, ends.end].some((q) => q && q.r === r && q.c === c);
	for (const [r, c, t] of board.entries()) {
		if (t.kind === 'wall') {
			if (tableIndex(r, c) < 0 && !isEndpoint(r, c)) walls.push(keyOf(r, c));
			continue;
		}
		if (tableWall(r, c) || isEndpoint(r, c)) continue;
		if (t.kind === 'weight') checkpoints.push(keyOf(r, c));
		else if (t.kind === 'oneway') oneWay.push([keyOf(r, c), t.dir]);
		else if (t.kind === 'pad') padsBy.set(t.pair, [...(padsBy.get(t.pair) ?? []), keyOf(r, c)]);
		else if (t.kind === 'duck') ducks.push({ n: t.n, cell: { r, c } });
	}
	const pads: [number, number][] = [];
	for (const ks of padsBy.values()) if (ks.length === 2) pads.push([ks[0], ks[1]]);
	ducks.sort((x, y) => x.n - y.n);
	return {
		bounds: searchBounds(board, mirror),
		walls,
		// Weights are checkpoints (Joseph, 2026-11-22): every step costs 1 and the route visits each
		// weight tile before Quack (engine/checkpoints.ts). The tile's old cost is kept but unused.
		weights: [],
		...(checkpoints.length ? { checkpoints: checkpoints.sort((a, b) => a - b) } : {}),
		...(oneWay.length ? { oneWay } : {}),
		...(pads.length ? { pads } : {}),
		start: ends.start ?? windowCell(o, -1),
		goals: [ends.end ?? windowCell(o, -1), ...ducks.map((d) => d.cell)],
		...(opts.findMode && ducks.length ? { findMode: opts.findMode } : {}),
		budget: BUDGET,
	};
}

export { lonePads, nextPadPair, nextDuck } from '../model/nodes';
