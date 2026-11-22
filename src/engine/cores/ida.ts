// IDA*: depth-first dives that never go past an f = g + h bound; the next
// bound is the smallest f that went over. Explicit stack (no recursion
// limit). Within one dive a cell already reached at a lower-or-equal g is not
// re-entered (a transposition table), which keeps dives linear on grids
// without changing the answer.
import { idOf, keyOf } from '../../model/cell';
import { Core, Reach } from '../emit';
import { Edge } from '../graph';

type Frame = { key: number; r: number; c: number; g: number; edges: Edge[]; i: number };

export const idaStar: Core = (E, G, start, goals) => {
	const h = G.heuristic(goals.map((g) => g.cell));
	const goalAt = new Map(goals.map((g) => [g.key, g]));
	let bound = h(start.r, start.c);
	E.emit({ action: 'init', node: idOf(start.r, start.c), g: 0, h: bound, f: bound, reason: 'PUSH_NEW' });
	for (;;) {
		E.next();
		E.emit({ action: 'iter', node: idOf(start.r, start.c), reason: 'ITER_BOUND', params: { bound } });
		let nextBound = Infinity;
		const seenG = new Map<number, number>();
		const onPath = new Set<number>();
		const stack: Frame[] = [];
		const res: { found: Reach | null } = { found: null };
		// enter() returns false when the cell is pruned by the bound.
		const enter = (r: number, c: number, g: number, from?: string, via?: 'step' | 'jump'): boolean | 'budget' => {
			const k = keyOf(r, c);
			const hh = h(r, c);
			const f = g + hh;
			if (f > bound) {
				nextBound = Math.min(nextBound, f);
				E.emit({ action: 'prune', node: idOf(r, c), from, g, h: hh, f, reason: 'PRUNE_F', params: { bound } });
				return false;
			}
			if (!E.expand()) return 'budget';
			seenG.set(k, g);
			onPath.add(k);
			stack.push({ key: k, r, c, g, edges: G.out(r, c), i: 0 });
			E.size = stack.length;
			E.next();
			E.emit({ action: 'pop', node: idOf(r, c), from, via, g, h: hh, f, reason: 'POP_STACK', params: { bound } });
			const goal = goalAt.get(k);
			if (goal) {
				res.found = { duck: goal.duck, keys: stack.map((s) => s.key), cost: g };
				E.emit({ action: 'found', node: idOf(r, c), g, duck: goal.duck, reason: 'FOUND_DUCK' });
			}
			return true;
		};
		if (enter(start.r, start.c, 0) === 'budget') return { reached: [], budgetHit: true };
		while (stack.length && !res.found) {
			const top = stack[stack.length - 1];
			if (top.i >= top.edges.length) {
				onPath.delete(top.key);
				stack.pop();
				E.size = stack.length;
				continue;
			}
			const e = top.edges[top.i++];
			if (onPath.has(e.key)) continue;
			const g = top.g + e.cost;
			if ((seenG.get(e.key) ?? Infinity) <= g) continue;
			if (enter(e.r, e.c, g, idOf(top.r, top.c), e.via) === 'budget') return { reached: [], budgetHit: true };
		}
		E.size = 0;
		if (res.found) return { reached: [res.found], budgetHit: false };
		if (nextBound === Infinity) return { reached: [], budgetHit: false };
		bound = nextBound;
	}
};
