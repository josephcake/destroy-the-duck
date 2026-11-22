// Bidirectional A*: one A* from the Arrow over out(), one from every duck over
// in() (reversed one-way lanes; it pays the weight of the cell it comes from).
// mu = cheapest meeting seen so far. Stop when mu <= max(min f fwd, min f bwd):
// any cheaper path would still have an open cell on both sides.
import { idOf, keyOf } from '../../model/cell';
import { Core, chain, idOfKey } from '../emit';
import { Heap } from '../heap';
import { Side } from '../trace';

type Entry = { key: number; r: number; c: number; g: number; h: number; f: number; seq: number };
const less = (a: Entry, b: Entry) => a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.seq < b.seq)));

type Half = {
	side: Side;
	heap: Heap<Entry>;
	best: Map<number, number>;
	parent: Map<number, number>;
	closed: Set<number>;
	h: (r: number, c: number) => number;
};

export const bidirectionalAstar: Core = (E, G, start, goals) => {
	let seq = 0;
	const half = (side: Side, h: Half['h']): Half => ({ side, heap: new Heap(less), best: new Map(), parent: new Map(), closed: new Set(), h });
	const F = half('fwd', G.heuristic(goals.map((g) => g.cell)));
	const B = half('bwd', G.heuristic([start]));
	const size = () => (E.size = F.heap.size + B.heap.size);
	const push = (H: Half, r: number, c: number, g: number) => {
		const hh = H.h(r, c);
		const e = { key: keyOf(r, c), r, c, g, h: hh, f: g + hh, seq: seq++ };
		H.heap.push(e);
		size();
		return e;
	};
	let mu = Infinity;
	let meet: number | null = null;
	const tryMeet = (H: Half, k: number, g: number) => {
		const O = H === F ? B : F;
		const og = O.best.get(k);
		if (og === undefined || g + og >= mu) return;
		mu = g + og;
		meet = k;
		E.emit({ action: 'meet', node: idOfKey(k), g: mu, side: H.side, reason: 'MEET', params: { mu } });
	};
	const s = push(F, start.r, start.c, 0);
	F.best.set(s.key, 0);
	E.emit({ action: 'init', node: idOf(start.r, start.c), g: 0, h: s.h, f: s.f, side: 'fwd', reason: 'PUSH_NEW' });
	for (const goal of goals) {
		const e = push(B, goal.cell.r, goal.cell.c, 0);
		B.best.set(e.key, 0);
		E.emit({ action: 'init', node: idOf(goal.cell.r, goal.cell.c), g: 0, h: e.h, f: e.f, side: 'bwd', duck: goal.duck, reason: 'PUSH_NEW' });
	}
	tryMeet(F, s.key, 0); // the Arrow standing on a duck cannot happen, but keep the rule uniform

	// Drops stale tops so peek() is the real minimum.
	const top = (H: Half) => {
		for (;;) {
			const t = H.heap.peek();
			if (!t || (!H.closed.has(t.key) && t.g <= H.best.get(t.key)!)) return t;
			H.heap.pop();
			size();
			E.emit({ action: 'skip', node: idOf(t.r, t.c), g: t.g, side: H.side, reason: 'SKIP_STALE' });
		}
	};
	let budgetHit = false;
	for (;;) {
		const tf = top(F);
		const tb = top(B);
		const fF = tf ? tf.f : Infinity;
		const fB = tb ? tb.f : Infinity;
		if (mu <= Math.max(fF, fB) || (!tf && !tb)) break;
		const H = fF <= fB ? F : B;
		const cur = H.heap.pop()!;
		size();
		if (!E.expand()) {
			budgetHit = true;
			break;
		}
		H.closed.add(cur.key);
		E.next();
		const id = idOf(cur.r, cur.c);
		E.emit({ action: 'pop', node: id, g: cur.g, h: cur.h, f: cur.f, side: H.side, reason: 'POP_MIN_F' });
		for (const e of H === F ? G.out(cur.r, cur.c) : G.in(cur.r, cur.c)) {
			if (H.closed.has(e.key)) continue;
			const g = cur.g + e.cost;
			const old = H.best.get(e.key);
			if (old !== undefined && g >= old) continue;
			H.best.set(e.key, g);
			H.parent.set(e.key, cur.key);
			const ent = push(H, e.r, e.c, g);
			E.emit({
				action: old === undefined ? 'push' : 'relax',
				node: idOf(e.r, e.c),
				from: id,
				via: e.via,
				g,
				h: ent.h,
				f: ent.f,
				side: H.side,
				reason: old === undefined ? 'PUSH_NEW' : 'RELAX_IMPROVED',
				params: old === undefined ? { dir: e.dir } : { dir: e.dir, oldG: old, newG: g },
			});
			tryMeet(H, e.key, g);
		}
	}
	E.size = 0;
	if (meet === null) return { reached: [], budgetHit };
	const fwd = chain(F.parent, meet);
	const bwd = chain(B.parent, meet).reverse(); // meet → duck
	const keys = [...fwd, ...bwd.slice(1)];
	const end = keys[keys.length - 1];
	const goal = goals.find((g) => g.key === end)!;
	E.emit({ action: 'found', node: idOf(goal.cell.r, goal.cell.c), g: mu, duck: goal.duck, reason: 'FOUND_DUCK' });
	return { reached: [{ duck: goal.duck, keys, cost: mu }], budgetHit };
};
