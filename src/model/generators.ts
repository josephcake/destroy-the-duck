// Prism §6 "new generators": seeded, pure, and region-sized (Home today).
// Each returns a wall grid (and, for weight noise, a cost grid). A shared
// pass then keeps the Arrow, the ducks and any node cells open and makes the
// ducks reachable from the Arrow, so every board is solvable.
import { Weight } from './board';

export type GenId = 'backtracker' | 'prim' | 'kruskal' | 'division' | 'wilson' | 'caves' | 'weightNoise';
export const GENERATORS: { id: GenId; label: string; blurb: string }[] = [
	{ id: 'backtracker', label: 'Recursive backtracker', blurb: 'Long winding corridors from a wandering digger' },
	{ id: 'prim', label: "Prim's", blurb: 'Short dead ends sprouting from a growing frontier' },
	{ id: 'kruskal', label: "Kruskal's", blurb: 'Islands of passages merging all over at once' },
	{ id: 'division', label: 'Recursive division', blurb: 'Walls splitting rooms into smaller rooms' },
	{ id: 'wilson', label: "Wilson's", blurb: 'Loop-erased random walks: an unbiased maze' },
	{ id: 'caves', label: 'Caves', blurb: 'Cellular-automata caves after 5 smoothing steps' },
	{ id: 'weightNoise', label: 'Mud and water', blurb: 'Seeded value-noise patches of cost 2, 5 and 10' },
];
/** The five that make perfect mazes on the odd lattice (one path between any two lattice cells). */
export const PERFECT: readonly GenId[] = ['backtracker', 'prim', 'kruskal', 'wilson'];

export type Pt = { r: number; c: number };
export type GenInput = {
	rows: number;
	cols: number;
	seed: number;
	start: Pt;
	ducks: Pt[]; // duck 1 first
	keepOpen?: Pt[]; // node cells (pads, lanes): never walled
};
export type GenOutput = { wall: Uint8Array; weight: Uint8Array; seed: number };

export function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const D4 = [
	[-1, 0],
	[0, 1],
	[1, 0],
	[0, -1],
] as const;

export function generate(id: GenId, input: GenInput): GenOutput {
	const { rows: R, cols: C, seed } = input;
	const rnd = rng(seed);
	const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
	const wall = new Uint8Array(R * C);
	const weight = new Uint8Array(R * C);
	const at = (r: number, c: number) => r * C + c;
	const inside = (r: number, c: number) => r >= 0 && r < R && c >= 0 && c < C;

	// Lattice mazes: cells at odd (r, c), walls between them.
	const LR = Math.floor((R - 1) / 2),
		LC = Math.floor((C - 1) / 2);
	const lat = (i: number, j: number) => ({ r: 2 * i + 1, c: 2 * j + 1 });
	const latNbrs = (i: number, j: number) =>
		D4.map(([di, dj]) => [i + di, j + dj] as const).filter(([a, b]) => a >= 0 && a < LR && b >= 0 && b < LC);
	const carve = (i: number, j: number) => (wall[at(2 * i + 1, 2 * j + 1)] = 0);
	const join = (i: number, j: number, k: number, l: number) => {
		wall[at(i + k + 1, j + l + 1)] = 0; // (2i+1 + 2k+1) / 2
	};
	const latticeStart = () => wall.fill(1);

	switch (id) {
		case 'backtracker': {
			latticeStart();
			const seen = new Uint8Array(LR * LC);
			const stack: [number, number][] = [[Math.floor(rnd() * LR), Math.floor(rnd() * LC)]];
			seen[stack[0][0] * LC + stack[0][1]] = 1;
			carve(...stack[0]);
			while (stack.length) {
				const [i, j] = stack[stack.length - 1];
				const next = latNbrs(i, j).filter(([a, b]) => !seen[a * LC + b]);
				if (!next.length) {
					stack.pop();
					continue;
				}
				const [a, b] = pick(next);
				seen[a * LC + b] = 1;
				carve(a, b);
				join(i, j, a, b);
				stack.push([a, b]);
			}
			break;
		}
		case 'prim': {
			latticeStart();
			const inMaze = new Uint8Array(LR * LC);
			const frontier: [number, number, number, number][] = [];
			const add = (i: number, j: number) => {
				inMaze[i * LC + j] = 1;
				carve(i, j);
				for (const [a, b] of latNbrs(i, j)) if (!inMaze[a * LC + b]) frontier.push([i, j, a, b]);
			};
			add(Math.floor(rnd() * LR), Math.floor(rnd() * LC));
			while (frontier.length) {
				const k = Math.floor(rnd() * frontier.length);
				const [i, j, a, b] = frontier[k];
				frontier[k] = frontier[frontier.length - 1];
				frontier.pop();
				if (inMaze[a * LC + b]) continue;
				join(i, j, a, b);
				add(a, b);
			}
			break;
		}
		case 'kruskal': {
			latticeStart();
			const parent = Array.from({ length: LR * LC }, (_, k) => k);
			const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
			const edges: [number, number, number, number][] = [];
			for (let i = 0; i < LR; i++)
				for (let j = 0; j < LC; j++) {
					carve(i, j);
					if (i + 1 < LR) edges.push([i, j, i + 1, j]);
					if (j + 1 < LC) edges.push([i, j, i, j + 1]);
				}
			for (let k = edges.length - 1; k > 0; k--) {
				const m = Math.floor(rnd() * (k + 1));
				[edges[k], edges[m]] = [edges[m], edges[k]];
			}
			for (const [i, j, a, b] of edges) {
				const x = find(i * LC + j),
					y = find(a * LC + b);
				if (x === y) continue;
				parent[x] = y;
				join(i, j, a, b);
			}
			break;
		}
		case 'wilson': {
			latticeStart();
			const inMaze = new Uint8Array(LR * LC);
			const first = Math.floor(rnd() * LR * LC);
			inMaze[first] = 1;
			carve(Math.floor(first / LC), first % LC);
			const order = Array.from({ length: LR * LC }, (_, k) => k);
			for (let k = order.length - 1; k > 0; k--) {
				const m = Math.floor(rnd() * (k + 1));
				[order[k], order[m]] = [order[m], order[k]];
			}
			const next = new Int32Array(LR * LC).fill(-1);
			for (const s of order) {
				if (inMaze[s]) continue;
				// random walk until the maze; remembering only the last exit erases loops
				let u = s;
				while (!inMaze[u]) {
					const [a, b] = pick(latNbrs(Math.floor(u / LC), u % LC));
					next[u] = a * LC + b;
					u = next[u];
				}
				for (u = s; !inMaze[u]; u = next[u]) {
					inMaze[u] = 1;
					const i = Math.floor(u / LC),
						j = u % LC,
						v = next[u];
					carve(i, j);
					join(i, j, Math.floor(v / LC), v % LC);
				}
			}
			break;
		}
		case 'division': {
			// border open (Home's edge is the wall); rooms split by walls with one gap,
			// walls on even lines and gaps on odd ones so passages never close.
			const split = (r0: number, c0: number, r1: number, c1: number) => {
				const h = r1 - r0 + 1,
					w = c1 - c0 + 1;
				if (h < 3 || w < 3) return;
				const horizontal = h > w ? true : w > h ? false : rnd() < 0.5;
				if (horizontal) {
					const rs = [];
					for (let r = r0 + 1; r < r1; r++) if (r % 2 === 0) rs.push(r);
					if (!rs.length) return;
					const r = pick(rs);
					const gaps = [];
					for (let c = c0; c <= c1; c++) if (c % 2 === 1) gaps.push(c);
					const gap = gaps.length ? pick(gaps) : c0;
					for (let c = c0; c <= c1; c++) if (c !== gap) wall[at(r, c)] = 1;
					split(r0, c0, r - 1, c1);
					split(r + 1, c0, r1, c1);
				} else {
					const cs = [];
					for (let c = c0 + 1; c < c1; c++) if (c % 2 === 0) cs.push(c);
					if (!cs.length) return;
					const c = pick(cs);
					const gaps = [];
					for (let r = r0; r <= r1; r++) if (r % 2 === 1) gaps.push(r);
					const gap = gaps.length ? pick(gaps) : r0;
					for (let r = r0; r <= r1; r++) if (r !== gap) wall[at(r, c)] = 1;
					split(r0, c0, r1, c - 1);
					split(r0, c + 1, r1, c1);
				}
			};
			split(0, 0, R - 1, C - 1);
			break;
		}
		case 'caves': {
			for (let k = 0; k < R * C; k++) wall[k] = rnd() < 0.45 ? 1 : 0;
			const count = (g: Uint8Array, r: number, c: number) => {
				let n = 0;
				for (let dr = -1; dr <= 1; dr++)
					for (let dc = -1; dc <= 1; dc++) {
						if (!dr && !dc) continue;
						const rr = r + dr,
							cc = c + dc;
						n += inside(rr, cc) ? g[at(rr, cc)] : 1; // the edge counts as rock
					}
				return n;
			};
			for (let step = 0; step < 5; step++) {
				const prev = wall.slice();
				for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
					const n = count(prev, r, c);
					wall[at(r, c)] = n >= 5 ? 1 : n <= 3 ? 0 : prev[at(r, c)];
				}
			}
			break;
		}
		case 'weightNoise': {
			// value noise: random lattice every 6 cells, smoothstep-interpolated
			const S = 6;
			const gr = Math.ceil(R / S) + 2,
				gc = Math.ceil(C / S) + 2;
			const g = Array.from({ length: gr * gc }, () => rnd());
			const sm = (t: number) => t * t * (3 - 2 * t);
			for (let r = 0; r < R; r++)
				for (let c = 0; c < C; c++) {
					const y = r / S,
						x = c / S,
						i = Math.floor(y),
						j = Math.floor(x),
						ty = sm(y - i),
						tx = sm(x - j);
					const v = (a: number, b: number) => g[a * gc + b];
					const top = v(i, j) + (v(i, j + 1) - v(i, j)) * tx;
					const bot = v(i + 1, j) + (v(i + 1, j + 1) - v(i + 1, j)) * tx;
					const n = top + (bot - top) * ty;
					weight[at(r, c)] = n > 0.78 ? 10 : n > 0.64 ? 5 : n > 0.54 ? 2 : 0;
				}
			break;
		}
	}

	finish(wall, weight, input, id === 'caves');
	return { wall, weight, seed };
}

/** Opens the Arrow, ducks and node cells, links each to the Arrow's region
 * through the fewest walls (0-1 BFS), and for caves fills sealed pockets. */
function finish(wall: Uint8Array, weight: Uint8Array, { rows: R, cols: C, start, ducks, keepOpen = [] }: GenInput, fillPockets: boolean) {
	const at = (p: Pt) => p.r * C + p.c;
	const ok = (p: Pt) => p.r >= 0 && p.r < R && p.c >= 0 && p.c < C;
	const ends = [start, ...ducks].filter(ok);
	const linked = [...ends, ...keepOpen.filter(ok)]; // node cells get linked too
	for (const p of linked) wall[at(p)] = 0;
	for (const p of ends) weight[at(p)] = 0;
	if (!ok(start)) return;
	const reach = () => {
		const seen = new Uint8Array(R * C);
		const q = [at(start)];
		seen[q[0]] = 1;
		for (let h = 0; h < q.length; h++) {
			const u = q[h],
				r = Math.floor(u / C),
				c = u % C;
			for (const [dr, dc] of D4) {
				const rr = r + dr,
					cc = c + dc;
				if (rr < 0 || rr >= R || cc < 0 || cc >= C) continue;
				const v = rr * C + cc;
				if (seen[v] || wall[v]) continue;
				seen[v] = 1;
				q.push(v);
			}
		}
		return seen;
	};
	let seen = reach();
	for (const d of linked.slice(1)) {
		if (seen[at(d)]) continue;
		// 0-1 BFS from the duck: walls cost 1, open 0; stop at the Arrow's region
		const dist = new Int32Array(R * C).fill(-1);
		const prev = new Int32Array(R * C).fill(-1);
		const dq: number[] = [at(d)];
		let head = 0;
		dist[at(d)] = 0;
		let hit = -1;
		const front: number[] = [];
		while (head < dq.length || front.length) {
			const u = front.length ? front.pop()! : dq[head++];
			if (seen[u]) {
				hit = u;
				break;
			}
			const r = Math.floor(u / C),
				c = u % C;
			for (const [dr, dc] of D4) {
				const rr = r + dr,
					cc = c + dc;
				if (rr < 0 || rr >= R || cc < 0 || cc >= C) continue;
				const v = rr * C + cc;
				const nd = dist[u] + wall[v];
				if (dist[v] !== -1 && dist[v] <= nd) continue;
				dist[v] = nd;
				prev[v] = u;
				if (wall[v]) dq.push(v);
				else front.push(v);
			}
		}
		for (let u = hit; u !== -1; u = prev[u]) wall[u] = 0;
		seen = reach();
	}
	if (fillPockets) for (let k = 0; k < R * C; k++) if (!wall[k] && !seen[k]) wall[k] = 1;
}

export const asWeight = (n: number): Weight | null => (n === 2 || n === 5 || n === 10 ? n : null);
