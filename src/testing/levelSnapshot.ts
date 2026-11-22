import { Cell, keyOf } from '../model/cell';
import { Level } from '../model/level';
import { Snapshot } from '../engine/graph';

export function snapshotOf(level: Level, budget = 250_000, origin: Cell = { r: 0, c: 0 }, findMode: Snapshot['findMode'] = 'nearest'): Snapshot {
	const { r: r0, c: c0 } = origin;
	return {
		bounds: { r0, c0, r1: r0 + level.rows - 1, c1: c0 + level.cols - 1 },
		walls: level.walls.map((w) => keyOf(w.r, w.c)),
		weights: level.weights.map((w) => [keyOf(w.cell.r, w.cell.c), w.cost] as [number, number]),
		oneWay: level.oneWay.map((o) => [keyOf(o.cell.r, o.cell.c), o.dir] as [number, 0 | 1 | 2 | 3]),
		pads: level.pads.map(([a, b]) => [keyOf(a.r, a.c), keyOf(b.r, b.c)] as [number, number]),
		start: level.arrow,
		goals: level.ducks,
		budget,
		findMode,
	};
}
