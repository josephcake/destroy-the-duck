// Weights are checkpoints (Joseph, 2026-11-22): every algorithm visits every
// checkpoint, in the order with the shortest total route, then goes on to Quack.
import { parseLevel } from '../model/level';
import { Cell, keyOf, parseId } from '../model/cell';
import { snapshotOf } from '../testing/levelSnapshot';
// @ts-expect-error plain JS test helper
import { mulberry32 } from '../testing/legacyDom';
import { runSearch } from './search';
import { EXACT_MAX, planTour } from './checkpoints';
import { Graph, Snapshot } from './graph';
import { TRACED, TracedAlgo } from './trace';

const OPTIMAL: TracedAlgo[] = ['dijkstraW', 'astar', 'bidirectionalAstar', 'jps4', 'bellmanFord', 'idaStar'];

/** Level text with '*' for a checkpoint (numbered in reading order, as the board lists them). */
function level(rows: string[]): Snapshot {
	const cps: number[] = [];
	const plain = rows.map((row, r) => [...row].map((ch, c) => (ch === '*' ? (cps.push(keyOf(r, c)), '.') : ch)).join(''));
	return { ...snapshotOf(parseLevel(plain)), checkpoints: cps };
}
const cellsOf = (snap: Snapshot) => (snap.checkpoints ?? []).map((k) => {
	const r = Math.floor(k / 2 ** 26) - 2 ** 25;
	return { r, c: (k % 2 ** 26) - 2 ** 25 };
});
const id = (c: Cell) => `${c.r}-${c.c}`;

/** Independent BFS distances on the walls-only grid (no weights, lanes or pads in these levels). */
function bfs(snap: Snapshot, from: Cell): Map<string, number> {
	const walls = new Set(snap.walls);
	const { r0, c0, r1, c1 } = snap.bounds;
	const d = new Map([[id(from), 0]]);
	const q = [from];
	while (q.length) {
		const u = q.shift()!;
		for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
			const v = { r: u.r + dr, c: u.c + dc };
			if (v.r < r0 || v.r > r1 || v.c < c0 || v.c > c1 || walls.has(keyOf(v.r, v.c)) || d.has(id(v))) continue;
			d.set(id(v), d.get(id(u))! + 1);
			q.push(v);
		}
	}
	return d;
}
/** Brute-force shortest tour length (every permutation), or null when some stop can't be reached. */
function bruteTour(snap: Snapshot): number | null {
	const cps = cellsOf(snap);
	const stops = [snap.start, ...cps];
	const D = stops.map((s) => bfs(snap, s));
	const goal = id(snap.goals[0]);
	let best = Infinity;
	const go = (at: number, left: number[], sofar: number) => {
		if (!left.length) return void (best = Math.min(best, sofar + (D[at].get(goal) ?? Infinity)));
		for (const i of left) go(i + 1, left.filter((j) => j !== i), sofar + (D[at].get(id(cps[i])) ?? Infinity));
	};
	go(0, cps.map((_, i) => i), 0);
	return best === Infinity ? null : best;
}
/** The path is legal (unit steps, no walls), Arrow to Quack, and meets the checkpoints in the planned order. */
function checkRoute(snap: Snapshot, path: string[], order: string[]) {
	const walls = new Set(snap.walls);
	const cells = path.map(parseId);
	expect(cells[0]).toEqual(snap.start);
	expect(cells.at(-1)).toEqual(snap.goals[0]);
	for (let i = 1; i < cells.length; i++) {
		expect(Math.abs(cells[i].r - cells[i - 1].r) + Math.abs(cells[i].c - cells[i - 1].c)).toBe(1);
		expect(walls.has(keyOf(cells[i].r, cells[i].c))).toBe(false);
	}
	let at = -1;
	for (const cp of order) {
		const next = path.indexOf(cp, at + 1);
		expect(next, `checkpoint ${cp} after index ${at}`).toBeGreaterThan(at);
		at = next;
	}
	expect(new Set(order)).toEqual(new Set(cellsOf(snap).map(id)));
}

const ONE = ['S..*.', '.....', '....D']; // S(0,0) → (0,3) → D(2,4): 3 + 3 = 6
const THREE = ['S....*....', '..........', '.*.......*', '.........D']; // (2,1) → (0,5) → (2,9) → D: 3 + 6 + 6 + 1 = 16
const ORDER = ['.......*..', '*.S......D']; // index order (0,7) first costs 23; (1,0) first costs 13
const WALLED = ['S...#*', '....##', '.....D'];

describe('planTour', () => {
	test('no checkpoints: no order, the route is Arrow to Quack', () => {
		const snap = level(['S...D']);
		expect(planTour(new Graph(snap), snap.start, [], snap.goals)).toEqual({ order: [], method: 'exact', cost: 4 });
	});
	test('order matters: the shorter order wins, not reading order', () => {
		const snap = level(ORDER);
		const plan = planTour(new Graph(snap), snap.start, cellsOf(snap), snap.goals);
		expect(plan.order.map((i) => id(cellsOf(snap)[i]))).toEqual(['1-0', '0-7']);
		expect(plan.cost).toBe(13);
	});
	test('exact plans match an independent brute force on 150 seeded boards (1 to 6 checkpoints)', () => {
		const rnd = mulberry32(42);
		for (let n = 0; n < 150; n++) {
			const rows = Array.from({ length: 7 }, () => Array.from({ length: 11 }, (): string => (rnd() < 0.22 ? '#' : '.')));
			const free = () => {
				for (;;) {
					const r = Math.floor(rnd() * 7), c = Math.floor(rnd() * 11);
					if (rows[r][c] === '.') return [r, c];
				}
			};
			const [sr, sc] = free(); rows[sr][sc] = 'S';
			const [dr, dc] = free(); rows[dr][dc] = 'D';
			const k = 1 + Math.floor(rnd() * 6);
			for (let i = 0; i < k; i++) { const [r, c] = free(); rows[r][c] = '*'; }
			const snap = level(rows.map((r) => r.join('')));
			const plan = planTour(new Graph(snap), snap.start, cellsOf(snap), snap.goals);
			const want = bruteTour(snap);
			expect(plan.cost === Infinity ? null : plan.cost, rows.map((r) => r.join('')).join('\n')).toBe(want);
		}
	});
	test(`more than ${EXACT_MAX} checkpoints: nearest next, every checkpoint still visited`, () => {
		const snap = level(['S.*.*.*.*.*', '...........', '*.*.*.*.*.D']);
		expect(cellsOf(snap).length).toBe(10);
		const plan = planTour(new Graph(snap), snap.start, cellsOf(snap), snap.goals);
		expect(plan.method).toBe('nearest');
		expect([...plan.order].sort((a, b) => a - b)).toEqual([...Array(10).keys()]);
		// independent nearest-next: from the current stop, the closest unvisited (ties: reading order)
		const cps = cellsOf(snap);
		const want: number[] = [];
		let at = snap.start;
		const left = new Set(cps.keys());
		while (left.size) {
			const D = bfs(snap, at);
			const pick = [...left].sort((a, b) => D.get(id(cps[a]))! - D.get(id(cps[b]))! || a - b)[0];
			want.push(pick);
			left.delete(pick);
			at = cps[pick];
		}
		expect(plan.order).toEqual(want);
	});
});

describe.each([...TRACED])('%s: checkpoints', (algo) => {
	const optimal = OPTIMAL.includes(algo);
	test('0 checkpoints: the same trace as a board without the field', () => {
		for (const rows of [['S...D'], ['S.#..', '..#..', '.....', '..#.D'], ['S#.', '##.', '..D']]) {
			const plain = snapshotOf(parseLevel(rows));
			const a = runSearch(algo, plain);
			const b = runSearch(algo, { ...plain, checkpoints: [] });
			expect({ ...b, result: { ...b.result, engineMs: 0 } }).toEqual({ ...a, result: { ...a.result, engineMs: 0 } });
			expect(a.result.checkpoints).toBeUndefined();
		}
	});
	test.each([
		['1 checkpoint', ONE, 6],
		['3 checkpoints', THREE, 16],
		['order matters', ORDER, 13],
	] as const)('%s: visits all, in the planned order, then Quack', (_, rows, best) => {
		const snap = level([...rows]);
		expect(bruteTour(snap)).toBe(best);
		const t = runSearch(algo, snap);
		expect(t.result.found).toBe(true);
		expect(t.result.checkpoints!.reached).toBe(cellsOf(snap).length);
		expect(t.result.checkpoints!.method).toBe('exact');
		checkRoute(snap, t.result.path, t.result.checkpoints!.order);
		if (optimal) expect(t.result.pathCost).toBe(best);
		else expect(t.result.pathCost).toBeGreaterThanOrEqual(best);
		expect(t.result.pathCost).toBe(t.result.path.length - 1);
		// one leg per checkpoint, then one to Quack; the gold path is one path
		expect(t.events.filter((e) => e.action === 'leg')).toHaveLength(cellsOf(snap).length + 1);
		expect(t.result.paths).toHaveLength(1);
	});
	test('an unreachable checkpoint is a no-path, and the run stops there', () => {
		const t = runSearch(algo, level(WALLED));
		expect(t.result.found).toBe(false);
		expect(t.result.path).toEqual([]);
		expect(t.result.checkpoints).toEqual({ order: ['0-5'], method: 'exact', reached: 0 });
		expect(t.events.at(-1)!.reason).toBe('NOT_FOUND');
		// reachable ones first, the walled one last
		const t2 = runSearch(algo, level(['S*..#*', '....##', '..*..D']));
		expect(t2.result.found).toBe(false);
		expect(t2.result.checkpoints!.reached).toBe(2);
		expect(t2.result.checkpoints!.order.at(-1)).toBe('0-5');
	});
	test(`more than ${EXACT_MAX} checkpoints: nearest next, still every one`, () => {
		const snap = level(['S.*.*.*.*.*', '...........', '*.*.*.*.*.D']);
		const t = runSearch(algo, snap);
		expect(t.result.found).toBe(true);
		expect(t.result.checkpoints!.method).toBe('nearest');
		checkRoute(snap, t.result.path, t.result.checkpoints!.order);
	});
	test('Quack walled off after the checkpoints: no-path with every checkpoint reached', () => {
		const t = runSearch(algo, level(['S.*.#.', '....#D', '..*.#.']));
		expect(t.result.found).toBe(false);
		expect(t.result.checkpoints!.reached).toBe(2);
	});
});
