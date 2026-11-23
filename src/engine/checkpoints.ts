// Weights are checkpoints (Joseph, 2026-11-22). The route starts at the Arrow,
// passes through every checkpoint, then goes on to Quack. The visit order is free:
// we take the order with the shortest total route.
//
// The order is planned once, from a true shortest-distance matrix over the board
// graph (Dijkstra from the Arrow and from each checkpoint; steps cost 1, teleport
// jumps cost 0, one-way lanes count). Then each algorithm runs its own search one
// segment at a time in that order. Why one matrix and not each algorithm's own
// segment costs: greedy, DFS and the classic searches don't return shortest
// segments, and their costs between every pair of stops would mean n² extra full
// runs per algorithm. One true-distance order is also the same for every algorithm,
// so their runs can be compared like for like: the order is the puzzle and the
// algorithm solves each segment.
//
// Order search: every permutation for up to EXACT_MAX checkpoints (8! = 40,320
// orders, pruned), the nearest unvisited checkpoint next above that.
import { Cell, keyOf } from '../model/cell';
import { Graph } from './graph';
import { Heap } from './heap';

export const EXACT_MAX = 8;
const NO_EXIT = 1e12; // stands in for an unreachable Quack while ranking orders
export type OrderMethod = 'exact' | 'nearest';

export type TourPlan = {
	/** Checkpoint indices (into the input list) in visit order. */
	order: number[];
	method: OrderMethod;
	/** Planned length from the Arrow through every checkpoint to Quack; Infinity when a stop can't be reached. */
	cost: number;
};

/** Shortest distance from `from` to every reachable cell (cell key → cost). */
export function distancesFrom(G: Graph, from: Cell): Map<number, number> {
	const dist = new Map<number, number>([[keyOf(from.r, from.c), 0]]);
	const heap = new Heap<[number, number, number]>((a, b) => a[0] < b[0]);
	heap.push([0, from.r, from.c]);
	for (let top = heap.pop(); top; top = heap.pop()) {
		const [d, r, c] = top;
		if (d > (dist.get(keyOf(r, c)) ?? Infinity)) continue;
		for (const e of G.out(r, c)) {
			const nd = d + e.cost;
			if (nd < (dist.get(e.key) ?? Infinity)) {
				dist.set(e.key, nd);
				heap.push([nd, e.r, e.c]);
			}
		}
	}
	return dist;
}

/**
 * The visit order for `checkpoints`, from `start`, finishing at the nearest of `finish`.
 * When some checkpoint can't be reached, the reachable ones come first (nearest next)
 * and the unreachable ones last, so a chained run fails at the first one it can't reach.
 */
export function planTour(G: Graph, start: Cell, checkpoints: readonly Cell[], finish: readonly Cell[]): TourPlan {
	const n = checkpoints.length;
	const stops = [start, ...checkpoints];
	const rows = stops.map((s) => distancesFrom(G, s));
	const d = (from: number, cp: number) => rows[from].get(keyOf(checkpoints[cp].r, checkpoints[cp].c)) ?? Infinity; // from: 0 = Arrow, i + 1 = checkpoint i
	const end = (from: number) => Math.min(...finish.map((g) => rows[from].get(keyOf(g.r, g.c)) ?? Infinity));
	const method: OrderMethod = n <= EXACT_MAX ? 'exact' : 'nearest';
	if (method === 'exact') {
		let best: number[] = [];
		let bestCost = Infinity;
		const order: number[] = [];
		const used = new Array<boolean>(n).fill(false);
		const walk = (at: number, sofar: number) => {
			if (sofar >= bestCost) return;
			if (order.length === n) {
				const e = end(at);
				const total = sofar + (e === Infinity ? NO_EXIT : e); // still order the checkpoints well when Quack is walled off
				if (total < bestCost) [bestCost, best] = [total, order.slice()];
				return;
			}
			for (let i = 0; i < n; i++) {
				if (used[i]) continue;
				const step = d(at, i);
				if (step === Infinity) continue;
				used[i] = true;
				order.push(i);
				walk(i + 1, sofar + step);
				order.pop();
				used[i] = false;
			}
		};
		walk(0, 0);
		if (bestCost < Infinity) return { order: best, method, cost: bestCost >= NO_EXIT ? Infinity : bestCost };
	}
	// nearest unvisited next (also the order for an unreachable tour)
	const order: number[] = [];
	const left = new Set(checkpoints.map((_, i) => i));
	let at = 0;
	let cost = 0;
	while (left.size) {
		let pick = -1;
		let step = Infinity;
		for (const i of left) if (d(at, i) < step) [pick, step] = [i, d(at, i)];
		if (pick < 0) break; // the rest can't be reached from here
		order.push(pick);
		left.delete(pick);
		cost += step;
		at = pick + 1;
	}
	const blocked = left.size > 0;
	order.push(...left);
	return { order, method, cost: blocked ? Infinity : cost + end(at) };
}
