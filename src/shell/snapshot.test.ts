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

test('Home walls come from the classic grid, weights and outside walls from the Board', () => {
	const board = new Board();
	board.set(17, 16, { kind: 'weight', cost: 5 });
	board.set(17, 17, { kind: 'weight', cost: 5 }); // under a classic wall: dropped
	board.set(-3, 100, { kind: 'wall' });
	const snap = buildSnapshot(board, mirrorWith([17 * 80 + 17]));
	expect(snap.walls).toContain(keyOf(17, 17));
	expect(snap.walls).toContain(keyOf(-3, 100));
	expect(snap.weights).toEqual([[keyOf(17, 16), 5]]);
	expect(snap.start).toEqual({ r: 17, c: 15 });
	expect(snap.goals).toEqual([{ r: 17, c: 64 }]);
	expect(snap.bounds).toEqual({ r0: -19, c0: -16, r1: 50, c1: 116 });
});

test('weighted runs on the default board: detour vs wading (hand-computed)', () => {
	// Straight line 17-15 -> 17-64 costs 49. Wading one water cell costs +9.
	const short = new Board(); // water rows 14-20: around = 4 up + 4 down = +8
	for (let r = 14; r <= 20; r++) short.set(r, 40, { kind: 'weight', cost: 10 });
	const tall = new Board(); // water rows 10-24: around = +16, so wade (+9)
	for (let r = 10; r <= 24; r++) tall.set(r, 40, { kind: 'weight', cost: 10 });
	for (const algo of ['astar', 'dijkstraW'] as const) {
		expect(runSearch(algo, buildSnapshot(short, mirrorWith([]))).result.pathCost).toBe(57);
		expect(runSearch(algo, buildSnapshot(tall, mirrorWith([]))).result.pathCost).toBe(58);
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
