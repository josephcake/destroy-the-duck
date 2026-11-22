// Phase C engine: every traced algorithm on each node type, the three find
// modes, and a randomized cross-check against an independent reference.
import { parseLevel } from '../model/level';
import { keyOf, parseId } from '../model/cell';
import { runSearch, unsupported } from './search';
import { Graph, Snapshot } from './graph';
import { snapshotOf } from '../testing/levelSnapshot';
// @ts-expect-error plain JS test helper
import { mulberry32 } from '../testing/legacyDom';
import { TRACED, TracedAlgo } from './trace';

const OPTIMAL: TracedAlgo[] = ['dijkstraW', 'astar', 'bidirectionalAstar', 'bellmanFord', 'idaStar'];
const ANY: TracedAlgo[] = ['weightedAstar', 'greedy', 'dfsStack'];
const snap = (rows: string[], mode: Snapshot['findMode'] = 'nearest') => snapshotOf(parseLevel(rows), 250_000, undefined, mode);

// ---------- independent reference ----------
const D4 = [
	[-1, 0],
	[0, 1],
	[1, 0],
	[0, -1],
];
function refEdges(s: Snapshot) {
	const walls = new Set(s.walls);
	const w = new Map(s.weights);
	const ow = new Map(s.oneWay ?? []);
	const partner = new Map<number, number>();
	for (const [a, b] of s.pads ?? []) partner.set(a, b).set(b, a);
	const { r0, c0, r1, c1 } = s.bounds;
	const ok = (r: number, c: number) => r >= r0 && r <= r1 && c >= c0 && c <= c1 && !walls.has(keyOf(r, c));
	return (r: number, c: number) => {
		const out: [number, number, number][] = [];
		const u = keyOf(r, c);
		D4.forEach(([dr, dc], d) => {
			const vr = r + dr,
				vc = c + dc,
				v = keyOf(vr, vc);
			if (!ok(vr, vc)) return;
			if (ow.has(u) && ow.get(u) !== d) return;
			if (ow.has(v) && ow.get(v) !== d) return;
			out.push([vr, vc, w.get(v) ?? 1]);
		});
		const p = partner.get(u);
		if (p !== undefined) {
			const pr = Math.floor(p / 2 ** 26) - 2 ** 25,
				pc = (p % 2 ** 26) - 2 ** 25;
			if (ok(pr, pc)) out.push([pr, pc, 0]);
		}
		return out;
	};
}
function refDist(s: Snapshot, from: { r: number; c: number }) {
	const edges = refEdges(s);
	const dist = new Map<number, number>([[keyOf(from.r, from.c), 0]]);
	for (let changed = true; changed; ) {
		changed = false;
		for (let r = s.bounds.r0; r <= s.bounds.r1; r++)
			for (let c = s.bounds.c0; c <= s.bounds.c1; c++) {
				const d = dist.get(keyOf(r, c));
				if (d === undefined) continue;
				for (const [vr, vc, w] of edges(r, c)) {
					const k = keyOf(vr, vc);
					if (d + w < (dist.get(k) ?? Infinity)) {
						dist.set(k, d + w);
						changed = true;
					}
				}
			}
	}
	return (g: { r: number; c: number }) => dist.get(keyOf(g.r, g.c)) ?? null;
}
/** Every consecutive pair is a legal edge; returns the summed cost. */
function walk(s: Snapshot, path: string[]) {
	const edges = refEdges(s);
	let cost = 0;
	const cells = path.map(parseId);
	for (let i = 1; i < cells.length; i++) {
		const a = cells[i - 1],
			b = cells[i];
		const e = edges(a.r, a.c).filter(([r, c]) => r === b.r && c === b.c);
		expect(e.length, `illegal move ${path[i - 1]} → ${path[i]}`).toBeGreaterThan(0);
		cost += Math.min(...e.map((x) => x[2]));
	}
	return cost;
}

// ---------- known boards (costs by hand) ----------
const KNOWN: { name: string; rows: string[]; cost: number | null }[] = [
	{ name: 'one-way along the arrow', rows: ['S>D', '...'], cost: 2 },
	{ name: 'one-way against the arrow forces a detour', rows: ['S<D', '...'], cost: 4 },
	{ name: 'one-way against the arrow, no detour', rows: ['S<D', '###'], cost: null },
	{ name: 'one-way cannot be left sideways', rows: ['S>>..', '##.#.', '..D..'], cost: 8 },
	{ name: 'one-way cannot be entered sideways', rows: ['....', 'S#v#', '..D.'], cost: 3 },
	{ name: 'teleporter jump costs 0', rows: ['Sa#.......aD'], cost: 2 },
	{ name: 'teleporter is optional', rows: ['SaD.......a'], cost: 2 },
	{ name: 'chained teleporters (Prism h would overestimate)', rows: ['Sa#.......a.b#......bD'], cost: 4 },
	{ name: 'weights: mud band forces the long way', rows: ['S5555D', '......'], cost: 7 },
	{ name: 'weights: wade one water rather than walk 12', rows: ['SXD', '.#.', '.#.', '.#.', '.#.', '.#.', '...'], cost: 11 },
	{ name: 'nearest of two ducks', rows: ['D.....S..D'], cost: 3 },
	{ name: 'walls around the near duck', rows: ['D#..S.....D', '##.........'], cost: 6 },
];

describe.each(OPTIMAL)('%s: known shortest paths for every node type', (algo) => {
	test.each(KNOWN)('$name', ({ rows, cost }) => {
		const s = snap(rows);
		const t = runSearch(algo, s);
		if (cost === null) return expect(t.result.found).toBe(false);
		expect(t.result.found).toBe(true);
		expect(t.result.pathCost).toBe(cost);
		expect(walk(s, t.result.path)).toBe(cost);
	});
});

describe.each(ANY)('%s: finds a legal path on every node type', (algo) => {
	test.each(KNOWN)('$name', ({ rows, cost }) => {
		const s = snap(rows);
		const t = runSearch(algo, s);
		if (cost === null) return expect(t.result.found).toBe(false);
		// walk() takes the cheaper of a step and a jump between the same two cells
		expect(walk(s, t.result.path)).toBeLessThanOrEqual(t.result.pathCost);
		expect(t.result.pathCost).toBeGreaterThanOrEqual(cost);
		if (algo === 'weightedAstar') expect(t.result.pathCost).toBeLessThanOrEqual(2 * cost);
	});
});

test('the teleport-aware h never overestimates on the chained-pads board', () => {
	const s = snap(['Sa#.......a.b#......bD']);
	const h = new Graph(s).heuristic(s.goals);
	const dist = refDist(s, s.goals[0]); // undirected board: distance to the duck
	for (let c = 0; c < 22; c++) {
		const d = dist({ r: 0, c });
		if (d !== null) expect(h(0, c)).toBeLessThanOrEqual(d);
	}
	expect(h(0, 0)).toBeLessThanOrEqual(4); // Prism's min_p M(n,p) + M(p',g) gives 12 here
});

describe('find modes (ducks numbered in reading order)', () => {
	const rows = ['D...S.....D']; // duck 1 at 4 steps, duck 2 at 6
	test.each([...OPTIMAL, 'jps4' as TracedAlgo])('%s nearest / all / tour', (algo) => {
		const n = runSearch(algo, snap(rows, 'nearest')).result;
		expect(n.paths.map((p) => [p.duck, p.cost])).toEqual([[1, 4]]);
		const a = runSearch(algo, snap(rows, 'all')).result;
		expect(a.paths.map((p) => [p.duck, p.cost]).sort()).toEqual([
			[1, 4],
			[2, 6],
		]);
		expect(a.found).toBe(true);
		const t = runSearch(algo, snap(rows, 'tour')).result;
		expect(t.paths.map((p) => [p.duck, p.cost])).toEqual([
			[1, 4],
			[2, 10],
		]);
		expect(t.pathCost).toBe(14);
		expect(t.path[0]).toBe('0-4');
		expect(t.path.at(-1)).toBe('0-10');
	});
	test('tour stops at an unreachable duck and reports the rest missing', () => {
		const r = runSearch('astar', snap(['S.D#D.D'], 'tour')).result;
		expect(r.found).toBe(false);
		expect(r.paths.map((p) => p.duck)).toEqual([1]);
		expect(r.missing).toEqual([2, 3]);
	});
});

test('JPS refuses weights, one-way lanes and teleporters, and says why', () => {
	expect(unsupported('jps4', snap(['S5D']))).toMatch(/weights.*switch to A\*/);
	expect(unsupported('jps4', snap(['S>D']))).toMatch(/one-way lanes/);
	expect(unsupported('jps4', snap(['SaDa']))).toMatch(/teleporters/);
	expect(unsupported('jps4', snap(['S#D', '...']))).toBeNull();
	expect(() => runSearch('jps4', snap(['S5D']))).toThrow(/plain grid/);
});

test('bidirectional A* does not stop at the first meeting', () => {
	// The waves first meet on the long top corridor; the short way is below.
	const s = snap(['S........D', '.########.', '..........']);
	const t = runSearch('bidirectionalAstar', s);
	expect(t.result.pathCost).toBe(9);
	expect(t.events.some((e) => e.action === 'meet')).toBe(true);
});

test('bidirectional A* uses reversed one-way edges on the duck side', () => {
	const s = snap(['S>>>>D', '......']);
	expect(runSearch('bidirectionalAstar', s).result.pathCost).toBe(5);
	expect(runSearch('bidirectionalAstar', snap(['S<<<<D', '......'])).result.pathCost).toBe(7);
});

test('every trace has monotone steps that start at 0', () => {
	for (const algo of TRACED) {
		const t = runSearch(algo, snap(['S.#..', '..#.D', '.....']));
		expect(t.events[0].step).toBe(0);
		for (let i = 1; i < t.events.length; i++) expect(t.events[i].step).toBeGreaterThanOrEqual(t.events[i - 1].step);
		expect(t.steps).toBe(t.events.at(-1)!.step);
	}
});

// ---------- randomized cross-check ----------
function randomBoard(seed: number, plain: boolean) {
	const rnd = mulberry32(seed);
	const R = 10,
		C = 16;
	const grid = Array.from({ length: R }, () => Array.from({ length: C }, () => '.'));
	const free = () => {
		for (;;) {
			const r = Math.floor(rnd() * R),
				c = Math.floor(rnd() * C);
			if (grid[r][c] === '.') return [r, c];
		}
	};
	for (let r = 0; r < R; r++)
		for (let c = 0; c < C; c++) {
			const x = rnd();
			if (x < 0.22) grid[r][c] = '#';
			else if (!plain && x < 0.3) grid[r][c] = ['2', '5', 'X'][Math.floor(rnd() * 3)];
			else if (!plain && x < 0.36) grid[r][c] = ['^', '>', 'v', '<'][Math.floor(rnd() * 4)];
		}
	if (!plain)
		for (const ch of ['a', 'b'].slice(0, Math.floor(rnd() * 3))) {
			const [r1, c1] = free();
			grid[r1][c1] = ch;
			const [r2, c2] = free();
			grid[r2][c2] = ch;
		}
	const [sr, sc] = free();
	grid[sr][sc] = 'S';
	const ducks = 1 + Math.floor(rnd() * 3);
	for (let i = 0; i < ducks; i++) {
		const [r, c] = free();
		grid[r][c] = 'D';
	}
	return grid.map((row) => row.join(''));
}

describe.each([...TRACED])('%s randomized cross-check against the reference', (algo) => {
	test('200 seeded boards, all three find modes', () => {
		for (let seed = 1; seed <= 200; seed++) {
			const rows = randomBoard(seed * 7919, algo === 'jps4');
			for (const mode of ['nearest', 'all', 'tour'] as const) {
				const s = snap(rows, mode);
				const fromStart = refDist(s, s.start);
				const t = runSearch(algo, s).result;
				const exact = OPTIMAL.includes(algo) || algo === 'jps4';
				for (const p of t.paths) {
					if (exact) expect(walk(s, p.path)).toBe(p.cost);
					else expect(walk(s, p.path)).toBeLessThanOrEqual(p.cost);
				}
				const ctx = `${algo} ${mode} seed ${seed}\n${rows.join('\n')}`;
				if (mode === 'nearest') {
					const costs = s.goals.map(fromStart).filter((d): d is number => d !== null);
					const best = costs.length ? Math.min(...costs) : null;
					expect(t.found, ctx).toBe(best !== null);
					if (best !== null && exact) expect(t.pathCost, ctx).toBe(best);
					if (best !== null && algo === 'weightedAstar') expect(t.pathCost, ctx).toBeLessThanOrEqual(2 * best);
				} else if (mode === 'all') {
					for (const g of s.goals) {
						const d = fromStart(g);
						const p = t.paths.find((x) => x.duck === s.goals.indexOf(g) + 1);
						expect(!!p, ctx).toBe(d !== null);
						if (p && exact) expect(p.cost, ctx).toBe(d);
					}
				} else {
					let from = s.start;
					for (let i = 0; i < s.goals.length; i++) {
						const d = refDist(s, from)(s.goals[i]);
						const p = t.paths[i];
						if (d === null) {
							expect(p, ctx).toBeUndefined();
							break;
						}
						expect(p.duck, ctx).toBe(i + 1);
						if (exact) expect(p.cost, ctx).toBe(d);
						from = s.goals[i];
					}
				}
			}
		}
	});
});
