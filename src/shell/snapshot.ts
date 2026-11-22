// Builds the engine input from the two sources of truth in Phase A:
// the legacy mirror (Home walls, Arrow, Duck) and the new Board.
import { Board } from '../model/board';
import { Bounds, Cell, HOME, HOME_COLS, HOME_ROWS, inHome, keyOf } from '../model/cell';
import { Dir, Snapshot } from '../engine/graph';
import { FindMode } from '../engine/trace';
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

export type BuildOpts = { findMode?: FindMode };

export function buildSnapshot(board: Board, mirror: Pick<LegacyMirror, 'kind' | 'start' | 'end'>, opts: BuildOpts = {}): Snapshot {
	const walls: number[] = [];
	for (let i = 0; i < HOME_ROWS * HOME_COLS; i++)
		if (mirror.kind[i] === K.Wall) walls.push(keyOf(Math.floor(i / HOME_COLS), i % HOME_COLS));
	const weights: [number, number][] = [];
	const oneWay: [number, Dir][] = [];
	const padsBy = new Map<number, number[]>();
	const ducks: { n: number; cell: Cell }[] = [];
	const homeWall = (r: number, c: number) => inHome(r, c) && mirror.kind[r * HOME_COLS + c] === K.Wall;
	const homeEndpoint = (r: number, c: number) => inHome(r, c) && (r * HOME_COLS + c === mirror.start || r * HOME_COLS + c === mirror.end);
	for (const [r, c, t] of board.entries()) {
		if (t.kind === 'wall') {
			if (!inHome(r, c)) walls.push(keyOf(r, c));
			continue;
		}
		if (homeWall(r, c) || homeEndpoint(r, c)) continue; // the classic table wins
		if (t.kind === 'weight') weights.push([keyOf(r, c), t.cost]);
		else if (t.kind === 'oneway') oneWay.push([keyOf(r, c), t.dir]);
		else if (t.kind === 'pad') padsBy.set(t.pair, [...(padsBy.get(t.pair) ?? []), keyOf(r, c)]);
		else if (t.kind === 'duck') ducks.push({ n: t.n, cell: { r, c } });
	}
	const pads: [number, number][] = [];
	for (const ks of padsBy.values()) if (ks.length === 2) pads.push([ks[0], ks[1]]);
	ducks.sort((x, y) => x.n - y.n);
	const cellOf = (i: number) => ({ r: Math.floor(i / HOME_COLS), c: i % HOME_COLS });
	return {
		bounds: searchBounds(board),
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
