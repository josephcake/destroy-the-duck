// Depth-first with a real stack (the classic "Depth First Search" is a
// backwards BFS and keeps its name). Neighbours are pushed W, S, E, N so N
// comes off first. Ignores weights when choosing; the path cost still counts them.
import { idOf, keyOf } from '../../model/cell';
import { Core, Goal, Reach, chain } from '../emit';

type Entry = { key: number; r: number; c: number; g: number; parent?: number };

export const dfsStack: Core = (E, G, start, goals, mode) => {
	let remaining: Goal[] = goals.slice();
	const goalAt = new Map(goals.map((g) => [g.key, g]));
	const stack: Entry[] = [{ key: keyOf(start.r, start.c), r: start.r, c: start.c, g: 0 }];
	const closed = new Set<number>();
	const parent = new Map<number, number>();
	const reached: Reach[] = [];
	E.size = 1;
	E.emit({ action: 'init', node: idOf(start.r, start.c), g: 0, reason: 'PUSH_NEW' });
	let budgetHit = false;
	while (stack.length) {
		const cur = stack.pop()!;
		E.size = stack.length;
		const id = idOf(cur.r, cur.c);
		if (closed.has(cur.key)) {
			E.emit({ action: 'skip', node: id, g: cur.g, reason: 'SKIP_SEEN' });
			continue;
		}
		if (!E.expand()) {
			budgetHit = true;
			break;
		}
		closed.add(cur.key);
		if (cur.parent !== undefined) parent.set(cur.key, cur.parent);
		E.next();
		E.emit({ action: 'pop', node: id, g: cur.g, reason: 'POP_STACK' });
		const goal = goalAt.get(cur.key);
		if (goal && remaining.includes(goal)) {
			reached.push({ duck: goal.duck, keys: chain(parent, cur.key), cost: cur.g });
			remaining = remaining.filter((g) => g !== goal);
			E.emit({ action: 'found', node: id, g: cur.g, duck: goal.duck, reason: 'FOUND_DUCK', params: { left: remaining.length } });
			if (mode === 'nearest' || remaining.length === 0) break;
		}
		const edges = G.out(cur.r, cur.c);
		for (let i = edges.length - 1; i >= 0; i--) {
			const e = edges[i];
			if (closed.has(e.key)) continue;
			stack.push({ key: e.key, r: e.r, c: e.c, g: cur.g + e.cost, parent: cur.key });
			E.size = stack.length;
			E.emit({ action: 'push', node: idOf(e.r, e.c), from: id, via: e.via, g: cur.g + e.cost, reason: 'PUSH_NEW', params: { dir: e.dir } });
		}
	}
	E.size = 0;
	return { reached, budgetHit };
};
