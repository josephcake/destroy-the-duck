// @vitest-environment node
// The bounded board (model/bounds.ts, 2026-11-22): every algorithm, the six
// classics included, reaches a Duck in each corner with the Arrow in the
// opposite corner. The classics run byte-unchanged on a 35 x 80 stand-in table.
import { BOARD, BOARD_COLS, BOARD_ROWS, clampToBoard, inBoard } from './bounds';
import { runWide } from '../classic/wide';
import { ClassicAlgo, TRACED, TracedAlgo } from '../engine/trace';
import { CLASSIC } from '../shell/legacy';
import { runSearch } from '../engine/search';
import { buildSnapshot } from '../shell/snapshot';
import { Board } from './board';
import { K } from '../canvas/mirror';

const corners = [
	[0, 0],
	[0, BOARD_COLS - 1],
	[BOARD_ROWS - 1, 0],
	[BOARD_ROWS - 1, BOARD_COLS - 1],
] as const;
const cases = corners.map(([r, c]) => ({ duck: { r, c }, arrow: { r: BOARD_ROWS - 1 - r, c: BOARD_COLS - 1 - c } }));
const name = (q: { r: number; c: number }) => `${q.r}-${q.c}`;

test('the board is the classic 35 x 80 table', () => {
	expect(BOARD).toEqual({ r0: 0, c0: 0, r1: 34, c1: 79 });
	expect([inBoard(0, 0), inBoard(34, 79), inBoard(-1, 0), inBoard(0, 80), inBoard(35, 0)]).toEqual([true, true, false, false, false]);
	expect(clampToBoard(-5, 200)).toEqual({ r: 0, c: 79 });
});

describe.each(cases)('Duck at $duck.r,$duck.c, Arrow at $arrow.r,$arrow.c', ({ duck, arrow }) => {
	test.each(CLASSIC.map((a) => a.id) as ClassicAlgo[])('classic %s reaches the Duck', (algo) => {
		const classes = Array.from({ length: BOARD_ROWS * BOARD_COLS }, (_, i) => {
			const r = Math.floor(i / BOARD_COLS), c = i % BOARD_COLS;
			return r === arrow.r && c === arrow.c ? 'light_starting' : r === duck.r && c === duck.c ? 'light_ending' : 'light_unvisited';
		});
		const res = runWide({ algo, classes, cols: BOARD_COLS, starting: name(arrow), ending: name(duck), origin: { r: 0, c: 0 }, seed: 7 });
		if (!res.ok) throw new Error(res.reason);
		expect(res.trace.result.found).toBe(true);
		expect(res.trace.result.path.at(-1)).toBe(name(duck));
	});
	test.each(TRACED as readonly TracedAlgo[])('%s reaches the Duck', (algo) => {
		const kind = new Uint8Array(BOARD_ROWS * BOARD_COLS);
		kind[arrow.r * BOARD_COLS + arrow.c] = K.Start;
		kind[duck.r * BOARD_COLS + duck.c] = K.End;
		const snap = buildSnapshot(new Board(), { kind, start: arrow.r * BOARD_COLS + arrow.c, end: duck.r * BOARD_COLS + duck.c });
		expect(snap.bounds).toEqual(BOARD);
		const t = runSearch(algo, snap);
		expect(t.result.found).toBe(true);
		expect(t.result.path.at(-1)).toBe(name(duck));
		// shortest for all but the stack DFS (it reaches the Duck, by a long way round)
		if (algo !== 'dfsStack') expect(t.result.pathCost).toBe(BOARD_ROWS - 1 + BOARD_COLS - 1);
	});
});
