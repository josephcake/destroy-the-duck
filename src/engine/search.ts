// Traced Dijkstra (weighted) and A*. One best-first loop; the algorithms
// differ only in the heuristic and the heap ordering.
import { Cell, cellOfKey, idOf, keyOf, manhattan } from '../model/cell';
import { Graph, NESW, Snapshot } from './graph';
import { Heap } from './heap';
import { Trace, TraceEvent, TracedAlgo } from './trace';

type Entry = { key: number; r: number; c: number; g: number; h: number; f: number; seq: number };

const byG = (a: Entry, b: Entry) => a.g < b.g || (a.g === b.g && a.seq < b.seq);
const byFthenH = (a: Entry, b: Entry) =>
	a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.seq < b.seq)));

/** Admissible on this board: every step costs >= 1. */
export const manhattanToNearest = (goals: Cell[]) => (r: number, c: number) => {
	let best = Infinity;
	for (const g of goals) best = Math.min(best, manhattan({ r, c }, g));
	return best;
};

export function runSearch(algo: TracedAlgo, snap: Snapshot): Trace {
	const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
	const graph = new Graph(snap);
	const h = algo === 'astar' ? manhattanToNearest(snap.goals) : () => 0;
	const heap = new Heap<Entry>(algo === 'astar' ? byFthenH : byG);
	const goalKeys = new Set(snap.goals.map((g) => keyOf(g.r, g.c)));
	const best = new Map<number, number>(); // best known g
	const parent = new Map<number, number>();
	const closed = new Set<number>();
	const events: TraceEvent[] = [];
	let step = 0;
	let seq = 0;
	let maxFrontier = 0;
	const emit = (e: Omit<TraceEvent, 'i' | 'step' | 'dsSize'>) => {
		maxFrontier = Math.max(maxFrontier, heap.size);
		events.push({ i: events.length, step, dsSize: heap.size, ...e });
	};
	const withH = algo === 'astar';

	const { start } = snap;
	const sKey = keyOf(start.r, start.c);
	const h0 = h(start.r, start.c);
	best.set(sKey, 0);
	heap.push({ key: sKey, r: start.r, c: start.c, g: 0, h: h0, f: h0, seq: seq++ });
	emit({ action: 'init', node: idOf(start.r, start.c), g: 0, ...(withH ? { h: h0, f: h0 } : {}), reason: 'PUSH_NEW' });

	let foundKey: number | null = null;
	let budgetHit = false;
	while (heap.size) {
		const cur = heap.pop()!;
		const id = idOf(cur.r, cur.c);
		if (closed.has(cur.key) || cur.g > (best.get(cur.key) ?? Infinity)) {
			emit({ action: 'skip', node: id, g: cur.g, reason: 'SKIP_STALE' });
			continue;
		}
		if (closed.size >= snap.budget) {
			budgetHit = true;
			break;
		}
		closed.add(cur.key);
		step++;
		emit({
			action: 'pop',
			node: id,
			g: cur.g,
			...(withH ? { h: cur.h, f: cur.f } : {}),
			reason: withH ? 'POP_MIN_F' : 'POP_MIN_G',
		});
		if (goalKeys.has(cur.key)) {
			foundKey = cur.key;
			emit({ action: 'found', node: id, g: cur.g, reason: 'FOUND_DUCK' });
			break;
		}
		for (const [dr, dc, dir] of NESW) {
			const r = cur.r + dr;
			const c = cur.c + dc;
			if (!graph.passable(r, c)) continue;
			const k = keyOf(r, c);
			if (closed.has(k)) continue;
			const g = cur.g + graph.cost(r, c);
			const old = best.get(k);
			if (old !== undefined && g >= old) continue;
			best.set(k, g);
			parent.set(k, cur.key);
			const hh = h(r, c);
			heap.push({ key: k, r, c, g, h: hh, f: g + hh, seq: seq++ });
			emit({
				action: old === undefined ? 'push' : 'relax',
				node: idOf(r, c),
				from: id,
				g,
				...(withH ? { h: hh, f: g + hh } : {}),
				reason: old === undefined ? 'PUSH_NEW' : 'RELAX_IMPROVED',
				params: old === undefined ? { dir } : { dir, oldG: old, newG: g },
			});
		}
	}

	const path: string[] = [];
	let pathCost = 0;
	if (foundKey !== null) {
		pathCost = best.get(foundKey)!;
		const keys: number[] = [];
		for (let k: number | undefined = foundKey; k !== undefined; k = parent.get(k)) keys.push(k);
		keys.reverse();
		for (const k of keys) {
			const cell = cellOfKey(k);
			path.push(idOf(cell.r, cell.c));
			emit({ action: 'path', node: idOf(cell.r, cell.c), g: best.get(k), reason: 'PATH' });
		}
	}
	emit({
		action: 'done',
		node: path.length ? path[path.length - 1] : idOf(start.r, start.c),
		reason: foundKey !== null ? 'FOUND_DUCK' : budgetHit ? 'BUDGET_EXHAUSTED' : 'NOT_FOUND',
	});

	const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
	return {
		v: 1,
		algo,
		neighbourOrder: 'NESW',
		tieBreak: algo === 'astar' ? 'f-then-h-then-fifo' : 'g-then-fifo',
		events,
		result: {
			found: foundKey !== null,
			path,
			pathCost,
			pathLen: path.length,
			expanded: closed.size,
			maxFrontier,
			engineMs: Math.round((t1 - t0) * 10) / 10,
		},
	};
}
