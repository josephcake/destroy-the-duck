// The board as a graph (PLAN §4.1). Every new algorithm walks it through
// out() / in(), so node types behave the same everywhere:
//  - cost of an edge = weight of the cell entered (1 when plain); walls: no edge
//  - one-way lane: u→v moving in direction d exists iff u is not one-way or
//    points d, and v is not one-way or points d (enter and leave along the arrow)
//  - teleporter pad: after its four steps, a pad has a 0-cost jump to its partner
//  - in(v) lists the u with u→v in out(u); backward searches pay weight(v).
import { Bounds, Cell, cellOfKey, inBounds, keyOf, manhattan } from '../model/cell';
import { FindMode } from './trace';

export type Dir = 0 | 1 | 2 | 3; // N, E, S, W
export const DIRS: readonly { d: Dir; dr: number; dc: number; name: 'N' | 'E' | 'S' | 'W' }[] = [
	{ d: 0, dr: -1, dc: 0, name: 'N' },
	{ d: 1, dr: 0, dc: 1, name: 'E' },
	{ d: 2, dr: 1, dc: 0, name: 'S' },
	{ d: 3, dr: 0, dc: -1, name: 'W' },
];

export type Snapshot = {
	bounds: Bounds;
	walls: number[]; // packed cell keys
	weights: [number, number][]; // [key, cost]
	oneWay?: [number, Dir][]; // [key, direction]
	pads?: [number, number][]; // complete pairs [keyA, keyB]
	start: Cell;
	goals: Cell[]; // ducks in number order (goals[0] = duck 1)
	findMode?: FindMode;
	budget: number; // max expanded nodes
};

export type Edge = { key: number; r: number; c: number; cost: number; via: 'step' | 'jump'; dir: 'N' | 'E' | 'S' | 'W' | 'J' };

export class Graph {
	readonly walls: Set<number>;
	readonly weights: Map<number, number>;
	readonly oneWay: Map<number, Dir>;
	readonly partner = new Map<number, number>();
	readonly padCells: Cell[] = [];
	constructor(readonly snap: Snapshot) {
		this.walls = new Set(snap.walls);
		this.weights = new Map(snap.weights);
		this.oneWay = new Map(snap.oneWay ?? []);
		for (const [a, b] of snap.pads ?? []) {
			this.partner.set(a, b);
			this.partner.set(b, a);
			this.padCells.push(cellOfKey(a), cellOfKey(b));
		}
	}
	get plain() {
		return this.weights.size === 0 && this.oneWay.size === 0 && this.partner.size === 0;
	}
	passable(r: number, c: number) {
		return inBounds(this.snap.bounds, r, c) && !this.walls.has(keyOf(r, c));
	}
	/** Cost of entering (r, c). */
	cost(r: number, c: number) {
		return this.weights.get(keyOf(r, c)) ?? 1;
	}
	out(r: number, c: number): Edge[] {
		const out: Edge[] = [];
		const u = keyOf(r, c);
		const du = this.oneWay.get(u);
		for (const { d, dr, dc, name } of DIRS) {
			if (du !== undefined && du !== d) continue;
			const vr = r + dr;
			const vc = c + dc;
			if (!this.passable(vr, vc)) continue;
			const v = keyOf(vr, vc);
			const dv = this.oneWay.get(v);
			if (dv !== undefined && dv !== d) continue;
			out.push({ key: v, r: vr, c: vc, cost: this.weights.get(v) ?? 1, via: 'step', dir: name });
		}
		this.jump(u, out);
		return out;
	}
	in(r: number, c: number): Edge[] {
		const out: Edge[] = [];
		const v = keyOf(r, c);
		const dv = this.oneWay.get(v);
		const cost = this.weights.get(v) ?? 1;
		for (const { d, dr, dc, name } of DIRS) {
			// u steps in direction d onto v, so u = v - delta(d)
			if (dv !== undefined && dv !== d) continue;
			const ur = r - dr;
			const uc = c - dc;
			if (!this.passable(ur, uc)) continue;
			const uk = keyOf(ur, uc);
			const du = this.oneWay.get(uk);
			if (du !== undefined && du !== d) continue;
			out.push({ key: uk, r: ur, c: uc, cost, via: 'step', dir: name });
		}
		this.jump(v, out);
		return out;
	}
	private jump(k: number, out: Edge[]) {
		const p = this.partner.get(k);
		if (p === undefined) return;
		const pc = cellOfKey(p);
		if (this.passable(pc.r, pc.c)) out.push({ key: p, r: pc.r, c: pc.c, cost: 0, via: 'jump', dir: 'J' });
	}

	/**
	 * Teleport-aware Manhattan lower bound to the nearest of `targets`
	 * (PLAN §4.5): min(M(n,g), min_p M(n,p) + min_{q,g} M(q,g)). Admissible and
	 * consistent for any number of pairs, because steps cost >= 1 and jumps 0.
	 */
	heuristic(targets: readonly Cell[]): (r: number, c: number) => number {
		const pads = this.padCells;
		const toTargets = (r: number, c: number) => {
			let best = Infinity;
			for (const t of targets) {
				const d = Math.abs(t.r - r) + Math.abs(t.c - c);
				if (d < best) best = d;
			}
			return best;
		};
		if (!pads.length || !targets.length) return toTargets;
		let minExit = Infinity;
		for (const q of pads) minExit = Math.min(minExit, toTargets(q.r, q.c));
		return (r, c) => {
			let toPad = Infinity;
			for (const p of pads) {
				const d = Math.abs(p.r - r) + Math.abs(p.c - c);
				if (d < toPad) toPad = d;
			}
			return Math.min(toTargets(r, c), toPad + minExit);
		};
	}
}

export const manhattanTo = (targets: readonly Cell[]) => (r: number, c: number) => {
	let best = Infinity;
	for (const t of targets) best = Math.min(best, manhattan({ r, c }, t));
	return best;
};
