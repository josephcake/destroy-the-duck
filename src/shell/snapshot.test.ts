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
