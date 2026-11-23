import { Board } from '../model/board';
import { keyOf } from '../model/cell';
import { K } from '../canvas/mirror';
import { buildSnapshot } from './snapshot';
import { runSearch } from '../engine/search';

function mirrorWith(walls: number[]) {
	const kind = new Uint8Array(35 * 80);
	for (const i of walls) kind[i] = K.Wall;
	const start = 17 * 80 + 15;
	const end = 17 * 80 + 64;
	kind[start] = K.Start;
	kind[end] = K.End;
	return { kind, start, end };
}

test('table walls come from the classic grid, checkpoints (weight tiles) from the Board', () => {
	const board = new Board();
	board.set(20, 3, { kind: 'weight', cost: 10 });
	board.set(17, 16, { kind: 'weight', cost: 5 });
	board.set(17, 17, { kind: 'weight', cost: 5 }); // under a classic wall: dropped
	const snap = buildSnapshot(board, mirrorWith([17 * 80 + 17]));
	expect(snap.walls).toContain(keyOf(17, 17));
	// weights are checkpoints: no step costs, keys in reading order
	expect(snap.weights).toEqual([]);
	expect(snap.checkpoints).toEqual([keyOf(17, 16), keyOf(20, 3)]);
	expect(buildSnapshot(new Board(), mirrorWith([])).checkpoints).toBeUndefined();
	expect(snap.start).toEqual({ r: 17, c: 15 });
	expect(snap.goals).toEqual([{ r: 17, c: 64 }]);
	// the search box is the whole bounded board (model/bounds.ts)
	expect(snap.bounds).toEqual({ r0: 0, c0: 0, r1: 34, c1: 79 });
});

test('a checkpoint run on the default board (hand-computed)', () => {
	// 17-15 -> 5-40 is 12 + 25 = 37; 5-40 -> 17-64 is 12 + 24 = 36; whatever the tile's old cost
	const board = new Board();
	board.set(5, 40, { kind: 'weight', cost: 10 });
	for (const algo of ['astar', 'dijkstraW', 'jps4'] as const) {
		const t = runSearch(algo, buildSnapshot(board, mirrorWith([])));
		expect(t.result.pathCost).toBe(73);
		expect(t.result.checkpoints).toEqual({ order: ['5-40'], method: 'exact', reached: 1 });
	}
});

// Phase C nodes reach the engine from the Board.
import { lonePads, nextDuck, nextPadPair } from './snapshot';
import { TraceState } from '../learn/player';

test('one-way lanes, complete teleporter pairs and extra ducks (in number order) reach the engine', () => {
	const board = new Board();
	board.set(10, 20, { kind: 'oneway', dir: 1 });
	board.set(5, 5, { kind: 'pad', pair: 0 });
	board.set(30, 70, { kind: 'pad', pair: 0 });
	board.set(2, 2, { kind: 'pad', pair: 1 }); // lone: ignored
	board.set(3, 40, { kind: 'duck', n: 3 });
	board.set(30, 10, { kind: 'duck', n: 2 });
	board.set(17, 15, { kind: 'oneway', dir: 0 }); // under the Arrow: the classic table wins
	const snap = buildSnapshot(board, mirrorWith([]), { findMode: 'tour' });
	expect(snap.oneWay).toEqual([[keyOf(10, 20), 1]]);
	expect(snap.pads).toEqual([[keyOf(5, 5), keyOf(30, 70)]]);
	expect(snap.goals).toEqual([{ r: 17, c: 64 }, { r: 30, c: 10 }, { r: 3, c: 40 }]);
	expect(snap.findMode).toBe('tour');
	expect(lonePads(board)).toEqual([1]);
	expect(nextPadPair(board)).toBe(1); // finish b before starting c
	expect(nextDuck(board)).toBe(4);
});

test('find mode is only sent when there is more than one duck', () => {
	expect(buildSnapshot(new Board(), mirrorWith([]), { findMode: 'all' }).findMode).toBeUndefined();
});

test('All and Tour runs give one drawn path per duck; a teleporter jump is free', () => {
	const board = new Board();
	board.set(30, 10, { kind: 'duck', n: 2 });
	const all = runSearch('astar', buildSnapshot(board, mirrorWith([]), { findMode: 'all' }));
	const st = new TraceState(all).seek(all.events.length);
	expect(st.paths.map((p) => p.duck).sort()).toEqual([1, 2]);
	expect(st.paths.find((p) => p.duck === 1)!.nodes.length).toBe(50);
	const tour = runSearch('astar', buildSnapshot(board, mirrorWith([]), { findMode: 'tour' }));
	expect(tour.result.paths!.map((p) => p.duck)).toEqual([1, 2]);
	// pads next to Arrow and Duck: 1 step in, free jump, 1 step out
	const b2 = new Board();
	b2.set(17, 16, { kind: 'pad', pair: 0 });
	b2.set(17, 63, { kind: 'pad', pair: 0 });
	const jt = runSearch('dijkstraW', buildSnapshot(b2, mirrorWith([])));
	expect(jt.result.pathCost).toBe(2);
});

test('JPS refuses boards with one-way lanes and says why', async () => {
	const { unsupported } = await import('../engine/search');
	const board = new Board();
	board.set(10, 20, { kind: 'oneway', dir: 1 });
	expect(unsupported('jps4', buildSnapshot(board, mirrorWith([])))).toMatch(/one-way/);
	expect(unsupported('astar', buildSnapshot(board, mirrorWith([])))).toBeNull();
});

test('an unpaired pad is harmless: not sent to the engine, every search unchanged, JPS still allowed', async () => {
	const { unsupported } = await import('../engine/search');
	const { TRACED } = await import('../engine/trace');
	const plain = new Board();
	const lone = new Board();
	lone.set(17, 30, { kind: 'pad', pair: 1 }); // pair B with no partner, right on the straight path
	const a = buildSnapshot(plain, mirrorWith([]));
	const b = buildSnapshot(lone, mirrorWith([]));
	expect(b.pads).toBeUndefined();
	expect(unsupported('jps4', b)).toBeNull();
	for (const algo of TRACED) expect(runSearch(algo, b).result.pathCost).toBe(runSearch(algo, a).result.pathCost);
});

// Infinite board: placement and search are not tied to the old 35x80 Home.
