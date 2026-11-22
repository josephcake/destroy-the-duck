// Prism §6 generators: same seed => same board, connectivity, Arrow/ducks reachable.
import { GENERATORS, PERFECT, generate, GenId, GenInput } from './generators';

const R = 35,
	C = 80;
const BASE: GenInput = { rows: R, cols: C, seed: 1, start: { r: 17, c: 15 }, ducks: [{ r: 17, c: 64 }] };
const IDS = GENERATORS.map((g) => g.id);

function components(wall: Uint8Array) {
	const comp = new Int32Array(R * C).fill(-1);
	let n = 0;
	for (let s = 0; s < R * C; s++) {
		if (wall[s] || comp[s] !== -1) continue;
		const q = [s];
		comp[s] = n;
		for (let h = 0; h < q.length; h++) {
			const u = q[h],
				r = Math.floor(u / C),
				c = u % C;
			for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
				const rr = r + dr,
					cc = c + dc;
				if (rr < 0 || rr >= R || cc < 0 || cc >= C) continue;
				const v = rr * C + cc;
				if (!wall[v] && comp[v] === -1) {
					comp[v] = n;
					q.push(v);
				}
			}
		}
		n++;
	}
	return { comp, n };
}
const at = (p: { r: number; c: number }) => p.r * C + p.c;
const same = (x: Uint8Array, y: Uint8Array) => x.length === y.length && x.every((v, i) => v === y[i]);

describe.each(IDS)('%s', (id: GenId) => {
	test('same seed gives the same board; another seed a different one', () => {
		const a = generate(id, { ...BASE, seed: 42 });
		const b = generate(id, { ...BASE, seed: 42 });
		const c = generate(id, { ...BASE, seed: 43 });
		expect(same(a.wall, b.wall)).toBe(true);
		expect(same(a.weight, b.weight)).toBe(true);
		const differs = !same(a.wall, c.wall) || !same(a.weight, c.weight);
		expect(differs).toBe(true);
	});

	test.each([1, 2, 3, 7, 99, 12345])('seed %i: Arrow and every duck open and reachable', (seed) => {
		const ducks = [{ r: 17, c: 64 }, { r: 0, c: 79 }, { r: 34, c: 0 }, { r: 20, c: 40 }];
		const g = generate(id, { ...BASE, seed, ducks });
		const { comp } = components(g.wall);
		expect(g.wall[at(BASE.start)]).toBe(0);
		for (const d of ducks) {
			expect(g.wall[at(d)]).toBe(0);
			expect(comp[at(d)]).toBe(comp[at(BASE.start)]);
			expect(g.weight[at(d)]).toBe(0);
		}
	});

	if (id !== 'weightNoise')
		test('Home edge is a wall ring except where the Arrow or a duck sits', () => {
			const g = generate(id, { ...BASE, seed: 9 });
			for (let c = 0; c < C; c++) expect(g.wall[c] + g.wall[(R - 1) * C + c]).toBe(2);
			for (let r = 0; r < R; r++) expect(g.wall[r * C] + g.wall[r * C + C - 1]).toBe(2);
		});
	if (id !== 'weightNoise')
		test('the open area is one connected region and a real maze (>= 25% walls)', () => {
			for (const seed of [5, 6, 7]) {
				const g = generate(id, { ...BASE, seed });
				expect(components(g.wall).n).toBe(1);
				const walls = g.wall.reduce((s, x) => s + x, 0);
				expect(walls / (R * C)).toBeGreaterThan(0.25);
			}
		});
});

test.each(PERFECT)('%s is a perfect maze on the odd lattice (a spanning tree)', (id) => {
	// with no endpoints to fix (Arrow on a lattice cell, no ducks), open cells
	// form a tree: open cells - 1 = open-open adjacencies
	const g = generate(id, { ...BASE, seed: 11, start: { r: 1, c: 1 }, ducks: [] });
	let open = 0,
		adj = 0;
	for (let r = 0; r < R; r++)
		for (let c = 0; c < C; c++) {
			if (g.wall[r * C + c]) continue;
			open++;
			if (r + 1 < R && !g.wall[(r + 1) * C + c]) adj++;
			if (c + 1 < C && !g.wall[r * C + c + 1]) adj++;
		}
	expect(adj).toBe(open - 1);
	expect(components(g.wall).n).toBe(1);
});

test('weight noise paints only 2 / 5 / 10, no walls, and a fair share of cells', () => {
	const g = generate('weightNoise', { ...BASE, seed: 3 });
	expect(g.wall.every((x) => x === 0)).toBe(true);
	const counts = new Map<number, number>();
	for (const w of g.weight) counts.set(w, (counts.get(w) ?? 0) + 1);
	expect([...counts.keys()].every((w) => [0, 2, 5, 10].includes(w))).toBe(true);
	const painted = R * C - (counts.get(0) ?? 0);
	expect(painted / (R * C)).toBeGreaterThan(0.1);
	expect(painted / (R * C)).toBeLessThan(0.8);
});

test('node cells are kept open and linked to the Arrow', () => {
	const keepOpen = [{ r: 2, c: 2 }, { r: 10, c: 40 }];
	for (const id of IDS) {
		const g = generate(id, { ...BASE, seed: 8, keepOpen });
		const { comp } = components(g.wall);
		for (const p of keepOpen) {
			expect(g.wall[at(p)]).toBe(0);
			expect(comp[at(p)]).toBe(comp[at(BASE.start)]);
		}
	}
});
