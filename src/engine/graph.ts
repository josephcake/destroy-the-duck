// A compact, transferable snapshot of the board plus the 4-connected
// neighbour function every new algorithm uses (order N, E, S, W).
import { Bounds, Cell, inBounds, keyOf } from '../model/cell';

export type Snapshot = {
	bounds: Bounds;
	walls: number[]; // packed cell keys
	weights: [number, number][]; // [packed key, cost]
	start: Cell;
	goals: Cell[];
	budget: number; // max expanded nodes
};

export const NESW: readonly [number, number, string][] = [
	[-1, 0, 'N'],
	[0, 1, 'E'],
	[1, 0, 'S'],
	[0, -1, 'W'],
];

export class Graph {
	readonly walls: Set<number>;
	readonly weights: Map<number, number>;
	constructor(readonly snap: Snapshot) {
		this.walls = new Set(snap.walls);
		this.weights = new Map(snap.weights);
	}
	passable(r: number, c: number) {
		return inBounds(this.snap.bounds, r, c) && !this.walls.has(keyOf(r, c));
	}
	/** Cost of entering (r, c). */
	cost(r: number, c: number) {
		return this.weights.get(keyOf(r, c)) ?? 1;
	}
}
