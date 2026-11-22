import { parseLevel } from '../model/level';
import { keyOf, parseId } from '../model/cell';
import { runSearch } from './search';
import { snapshotOf } from '../testing/levelSnapshot';
// @ts-expect-error plain JS test helper
import { mulberry32 } from '../testing/legacyDom';
import { Snapshot } from './graph';
import { TracedAlgo } from './trace';

const ALGOS: TracedAlgo[] = ['dijkstraW', 'astar'];

// Known shortest costs, computed by hand (cost = sum of weights of cells entered).
const KNOWN: { name: string; rows: string[]; cost: number | null; len?: number }[] = [
	{ name: 'open line', rows: ['S...D'], cost: 4, len: 5 },
	{ name: 'wall detour', rows: ['S.#..', '..#..', '.....', '..#.D'], cost: 7, len: 8 },
	{ name: 'mud band (5s) forces the long way', rows: ['S5555D', '......'], cost: 7, len: 8 },
	{ name: 'water (X = 10) forces the long way', rows: ['SXD', '...'], cost: 4, len: 5 },
	{ name: 'cheaper to wade one mud than walk around', rows: ['S5D', '.#.', '.#.', '...'], cost: 6, len: 3 },
	{ name: 'unreachable duck', rows: ['S#.', '##.', '..D'], cost: null },
	{ name: 'adjacent duck', rows: ['SD'], cost: 1, len: 2 },
];

describe.each(ALGOS)('%s known shortest paths', (algo) => {
	test.each(KNOWN)('$name', ({ rows, cost, len }) => {
		const trace = runSearch(algo, snapshotOf(parseLevel(rows)));
		if (cost === null) {
			expect(trace.result.found).toBe(false);
			expect(trace.events.at(-1)!.reason).toBe('NOT_FOUND');
		} else {
			expect(trace.result.found).toBe(true);
			expect(trace.result.pathCost).toBe(cost);
			expect(trace.result.pathLen).toBe(len);
		}
	});
});

function validatePath(snap: Snapshot, path: string[], expectedCost: number) {
	const walls = new Set(snap.walls);
	const weights = new Map(snap.weights);
	let cost = 0;
	const cells = path.map(parseId);
	expect(cells[0]).toEqual(snap.start);
	expect(snap.goals).toContainEqual(cells.at(-1));
	for (let i = 1; i < cells.length; i++) {
		const a = cells[i - 1];
		const b = cells[i];
		expect(Math.abs(a.r - b.r) + Math.abs(a.c - b.c)).toBe(1);
		expect(walls.has(keyOf(b.r, b.c))).toBe(false);
		cost += weights.get(keyOf(b.r, b.c)) ?? 1;
	}
	expect(cost).toBe(expectedCost);
}

// Independent reference: Bellman-Ford style relaxation until nothing changes.
function referenceCost(snap: Snapshot): number | null {
	const { r0, c0, r1, c1 } = snap.bounds;
	const walls = new Set(snap.walls);
	const weights = new Map(snap.weights);
	const dist = new Map<number, number>([[keyOf(snap.start.r, snap.start.c), 0]]);
	for (let changed = true; changed; ) {
		changed = false;
		for (let r = r0; r <= r1; r++)
			for (let c = c0; c <= c1; c++) {
				const d = dist.get(keyOf(r, c));
				if (d === undefined) continue;
				for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
					const nr = r + dr;
					const nc = c + dc;
					if (nr < r0 || nr > r1 || nc < c0 || nc > c1) continue;
					const k = keyOf(nr, nc);
					if (walls.has(k)) continue;
					const nd = d + (weights.get(k) ?? 1);
					if (nd < (dist.get(k) ?? Infinity)) {
						dist.set(k, nd);
						changed = true;
					}
				}
			}
	}
	const g = snap.goals[0];
	return dist.get(keyOf(g.r, g.c)) ?? null;
}

function randomLevel(seed: number): string[] {
	const rnd = mulberry32(seed);
	const rows = 12;
	const cols = 20;
	const grid: string[][] = Array.from({ length: rows }, () =>
		Array.from({ length: cols }, (): string => {
			const x = rnd();
			return x < 0.25 ? '#' : x < 0.35 ? '5' : x < 0.4 ? 'X' : x < 0.45 ? '2' : '.';
		}),
	);
	grid[Math.floor(rnd() * rows)][Math.floor(rnd() * cols)] = 'S';
	let dr = Math.floor(rnd() * rows);
	let dc = Math.floor(rnd() * cols);
	if (grid[dr][dc] === 'S') dc = (dc + 1) % cols;
	grid[dr][dc] = 'D';
	return grid.map((r) => r.join(''));
}

test('300 seeded random boards: Dijkstra = A* = reference, paths valid', () => {
	let reachable = 0;
	for (let seed = 1; seed <= 300; seed++) {
		const snap = snapshotOf(parseLevel(randomLevel(seed)));
		const ref = referenceCost(snap);
		for (const algo of ALGOS) {
			const t = runSearch(algo, snap);
			expect(t.result.found).toBe(ref !== null);
			if (ref !== null) {
				expect(t.result.pathCost).toBe(ref);
				validatePath(snap, t.result.path, ref);
			}
		}
		if (ref !== null) reachable++;
	}
	expect(reachable).toBeGreaterThan(100); // the property is exercised on real paths
});

test('A* expands fewer cells than Dijkstra on an open board', () => {
	const rows = Array.from({ length: 20 }, (_, r) =>
		Array.from({ length: 40 }, (_, c) => (r === 10 && c === 2 ? 'S' : r === 10 && c === 37 ? 'D' : '.')).join(''),
	);
	const snap = snapshotOf(parseLevel(rows));
	const d = runSearch('dijkstraW', snap).result;
	const a = runSearch('astar', snap).result;
	expect(a.pathCost).toBe(35);
	expect(d.pathCost).toBe(35);
	expect(a.expanded).toBeLessThan(d.expanded / 4);
});

test('traces are deterministic (same board => same events)', () => {
	const snap = snapshotOf(parseLevel(randomLevel(7)));
	for (const algo of ALGOS) {
		const a = runSearch(algo, snap);
		const b = runSearch(algo, snap);
		expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
	}
});

test('works at negative coordinates (infinite board)', () => {
	const origin = { r: -100, c: -7 };
	const snap = snapshotOf(parseLevel(['S.#..', '..#..', '.....', '..#.D'], origin), 250_000, origin);
	const t = runSearch('astar', snap);
	expect(t.result.pathCost).toBe(7);
	expect(t.result.path[0]).toBe('-100--7');
});

test('stops at the visit budget', () => {
	const rows = Array.from({ length: 30 }, (_, r) =>
		Array.from({ length: 30 }, (_, c) => (r === 0 && c === 0 ? 'S' : r === 29 && c === 29 ? 'D' : '.')).join(''),
	);
	const t = runSearch('dijkstraW', snapshotOf(parseLevel(rows), 50));
	expect(t.result.found).toBe(false);
	expect(t.result.expanded).toBe(50);
	expect(t.events.at(-1)!.reason).toBe('BUDGET_EXHAUSTED');
});

test('event shape: pop steps are numbered, pushes share their pop step, N E S W order', () => {
	const t = runSearch('dijkstraW', snapshotOf(parseLevel(['...', '.S.', '..D'])));
	const pushes = t.events.filter((e) => e.action === 'push' && e.step === 1).map((e) => e.params!.dir);
	expect(pushes).toEqual(['N', 'E', 'S', 'W']);
	expect(t.events[0].action).toBe('init');
	expect(t.events.map((e) => e.i)).toEqual(t.events.map((_, i) => i));
});
