// Runs any traced algorithm with a find mode (decisions 4 and 12):
//  nearest: one search toward every duck, stop at the first reached
//  all:     a path to each duck (one search when the core supports it,
//           otherwise one leg from the Arrow per duck)
//  tour:    legs Arrow → duck 1 → duck 2 → … in number order
// Checkpoints (weights) come first in every mode: one leg per checkpoint, in the
// planned order (checkpoints.ts), then the find mode runs from the last one.
import { Cell, cellOfKey, idOf, keyOf, manhattan } from '../model/cell';
import { Core, CoreOut, Emitter, Goal, Reach, idOfKey } from './emit';
import { Graph, Snapshot } from './graph';
import { Trace, TracedAlgo, ALGO_INFO, DuckPath, CheckpointResult } from './trace';
import { planTour } from './checkpoints';
import { bestFirst } from './cores/bestFirst';
import { dfsStack } from './cores/dfs';
import { bellmanFord } from './cores/bellmanFord';
import { idaStar } from './cores/ida';
import { bidirectionalAstar } from './cores/bidirectional';
import { jps4 } from './cores/jps';

const CORES: Record<TracedAlgo, Core> = {
	dijkstraW: bestFirst('dijkstraW'),
	astar: bestFirst('astar'),
	weightedAstar: bestFirst('weightedAstar'),
	greedy: bestFirst('greedy'),
	bidirectionalAstar,
	jps4,
	dfsStack,
	bellmanFord,
	idaStar,
};
const NATIVE_ALL = new Set<TracedAlgo>(['dijkstraW', 'astar', 'weightedAstar', 'greedy', 'dfsStack', 'bellmanFord']);

/** Why an algorithm cannot run on this board, or null. */
export function unsupported(algo: TracedAlgo, snap: Snapshot): string | null {
	if (algo !== 'jps4') return null;
	const g = new Graph(snap);
	if (g.plain) return null;
	const what = [g.weights.size && 'weights', g.oneWay.size && 'one-way lanes', g.partner.size && 'teleporters'].filter(Boolean);
	return `Jump point search needs a plain grid: it assumes every step costs 1 and works both ways. Remove the ${what.join(', ')} or switch to A*.`;
}

/** Kept for older callers and tests: Manhattan to the nearest goal. */
export const manhattanToNearest = (goals: Cell[]) => (r: number, c: number) =>
	Math.min(...goals.map((g) => manhattan({ r, c }, g)));

export function runSearch(algo: TracedAlgo, snap: Snapshot): Trace {
	const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const why = unsupported(algo, snap);
	if (why) throw new Error(why);
	const G = new Graph(snap);
	const E = new Emitter(snap.budget);
	const core = CORES[algo];
	const mode = snap.findMode ?? 'nearest';
	const goals: Goal[] = snap.goals.map((cell, i) => ({ cell, key: keyOf(cell.r, cell.c), duck: i + 1 }));
	const reaches: Reach[] = [];
	let budgetHit = false;
	const collect = (o: CoreOut) => {
		reaches.push(...o.reached);
		budgetHit = budgetHit || o.budgetHit;
	};
	const leg = (i: number, from: Cell, goal: Goal) => {
		E.leg = i;
		E.next();
		E.emit({ action: 'leg', node: idOf(from.r, from.c), duck: goal.duck, reason: 'LEG', params: { to: idOf(goal.cell.r, goal.cell.c) } });
		const o = core(E, G, from, [goal], 'nearest');
		collect(o);
		return o.reached.length > 0;
	};

	// checkpoints: one leg each, in the planned order; a leg that can't reach its checkpoint ends the run
	const cps = (snap.checkpoints ?? []).map(cellOfKey);
	let origin = snap.start;
	let legs = 0; // legs used so far (the find mode's legs are numbered after them)
	const prefix: Reach[] = [];
	let checkpoints: CheckpointResult | undefined;
	if (cps.length) {
		const plan = planTour(G, snap.start, cps, mode === 'nearest' ? snap.goals : snap.goals.slice(0, 1));
		checkpoints = { order: plan.order.map((i) => idOf(cps[i].r, cps[i].c)), method: plan.method, reached: 0 };
		for (const i of plan.order) {
			const cell = cps[i];
			E.leg = legs++;
			E.next();
			E.emit({ action: 'leg', node: idOf(origin.r, origin.c), reason: 'LEG', params: { to: idOf(cell.r, cell.c), checkpoint: checkpoints.reached + 1 } });
			const o = core(E, G, origin, [{ cell, key: keyOf(cell.r, cell.c), duck: 0 }], 'nearest');
			budgetHit = budgetHit || o.budgetHit;
			if (!o.reached.length || budgetHit) break;
			prefix.push(o.reached[0]);
			checkpoints.reached++;
			origin = cell;
		}
	}
	const blocked = !!checkpoints && checkpoints.reached < checkpoints.order.length;
	const finalLeg = () => {
		// after checkpoints, the search toward Quack is a leg of its own (a fresh frontier)
		if (!cps.length) return;
		E.leg = legs;
		E.next();
		E.emit({ action: 'leg', node: idOf(origin.r, origin.c), reason: 'LEG', params: { to: idOf(snap.goals[0].r, snap.goals[0].c) } });
	};

	if (blocked) {
		// no Quack phase: a checkpoint is out of reach
	} else if (mode === 'nearest' || goals.length === 1) {
		finalLeg();
		collect(core(E, G, origin, goals, 'nearest'));
	} else if (mode === 'all' && NATIVE_ALL.has(algo)) {
		finalLeg();
		collect(core(E, G, origin, goals, 'all'));
	} else if (mode === 'all') goals.forEach((g, i) => !budgetHit && leg(legs + i, origin, g));
	else {
		let from = origin;
		for (let i = 0; i < goals.length && !budgetHit; i++) {
			if (!leg(legs + i, from, goals[i])) break;
			from = goals[i].cell;
		}
	}
	E.leg = undefined;

	const paths: DuckPath[] = reaches.map((r) => ({ duck: r.duck, path: r.keys.map(idOfKey), cost: r.cost }));
	if (prefix.length && paths.length) {
		// one gold path: Arrow → checkpoints → the first Quack (other Quacks branch from the last checkpoint)
		const lead = prefix.flatMap((r, i) => (i ? r.keys.slice(1) : r.keys)).map(idOfKey);
		paths[0] = { ...paths[0], path: [...lead, ...paths[0].path.slice(1)], cost: paths[0].cost + prefix.reduce((s, r) => s + r.cost, 0) };
	}
	const wanted = mode === 'nearest' ? 1 : goals.length;
	const found = !blocked && paths.length >= Math.min(wanted, goals.length) && paths.length > 0;
	if (paths.length) {
		E.next();
		paths.forEach((p, pi) => p.path.forEach((node) => E.emit({ action: 'path', node, duck: p.duck, reason: 'PATH', params: { p: pi } })));
	}
	const flat = mode === 'tour' ? paths.flatMap((p, i) => (i ? p.path.slice(1) : p.path)) : (paths[0]?.path ?? []);
	E.emit({
		action: 'done',
		node: flat.length ? flat[flat.length - 1] : idOf(snap.start.r, snap.start.c),
		reason: found ? 'FOUND_DUCK' : budgetHit ? 'BUDGET_EXHAUSTED' : 'NOT_FOUND',
	});
	const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
	return {
		v: 1,
		algo,
		findMode: mode,
		neighbourOrder: 'NESW',
		tieBreak: ALGO_INFO[algo].tieBreak,
		steps: E.step,
		events: E.events,
		result: {
			found,
			path: flat,
			pathCost: paths.reduce((s, p) => s + p.cost, 0),
			pathLen: flat.length,
			paths,
			missing: goals.filter((g) => !paths.some((p) => p.duck === g.duck)).map((g) => g.duck),
			expanded: E.expanded,
			maxFrontier: E.maxFrontier,
			engineMs: Math.round((t1 - t0) * 10) / 10,
			...(checkpoints ? { checkpoints } : {}),
		},
	};
}
