// Dijkstra (weighted), A*, weighted A* and greedy best-first: one loop that
// differs only in the heap key.
//   dijkstraW: g            A*: g + h        weighted A*: g + 2h        greedy: h
// With 'all', each duck reached is dropped from the target set and the open
// set is re-keyed with the new (still consistent) heuristic.
import { Cell, idOf, keyOf } from '../../model/cell';
import { Core, Goal, Reach, chain } from '../emit';
import { Heap } from '../heap';
import { ReasonCode } from '../trace';

export type BestFirstKind = 'dijkstraW' | 'astar' | 'weightedAstar' | 'greedy';
type Entry = { key: number; r: number; c: number; g: number; h: number; f: number; seq: number };

const byF = (a: Entry, b: Entry) => a.f < b.f || (a.f === b.f && a.seq < b.seq);
const byFthenH = (a: Entry, b: Entry) => a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.seq < b.seq)));

export const EPSILON = 2;

export const bestFirst =
	(kind: BestFirstKind): Core =>
	(E, G, start, goals, mode) => {
		const withH = kind !== 'dijkstraW';
		const popReason: ReasonCode = kind === 'dijkstraW' ? 'POP_MIN_G' : kind === 'greedy' ? 'POP_MIN_H' : 'POP_MIN_F';
		let remaining: Goal[] = goals.slice();
		const goalAt = new Map(goals.map((g) => [g.key, g]));
		let h = withH ? G.heuristic(remaining.map((g) => g.cell)) : () => 0;
		const keyOfEntry = (g: number, hh: number) =>
			kind === 'dijkstraW' ? g : kind === 'astar' ? g + hh : kind === 'weightedAstar' ? g + EPSILON * hh : hh;
		let heap = new Heap<Entry>(kind === 'dijkstraW' ? byF : byFthenH);
		const best = new Map<number, number>();
		const parent = new Map<number, number>();
		const closed = new Set<number>();
		const reached: Reach[] = [];
		let seq = 0;
		const hf = (e: { g: number; h: number; f: number }) => (withH ? { h: e.h, f: e.f } : {});

		const push = (r: number, c: number, g: number): Entry => {
			const hh = h(r, c);
			const e = { key: keyOf(r, c), r, c, g, h: hh, f: keyOfEntry(g, hh), seq: seq++ };
			heap.push(e);
			E.size = heap.size;
			return e;
		};

		const s = push(start.r, start.c, 0);
		best.set(s.key, 0);
		E.emit({ action: 'init', node: idOf(start.r, start.c), g: 0, ...hf(s), reason: 'PUSH_NEW' });

		let budgetHit = false;
		while (heap.size) {
			const cur = heap.pop()!;
			E.size = heap.size;
			const id = idOf(cur.r, cur.c);
			if (closed.has(cur.key) || cur.g > best.get(cur.key)!) {
				E.emit({ action: 'skip', node: id, g: cur.g, reason: 'SKIP_STALE' });
				continue;
			}
			if (!E.expand()) {
				budgetHit = true;
				break;
			}
			closed.add(cur.key);
			E.next();
			E.emit({ action: 'pop', node: id, g: cur.g, ...hf(cur), reason: popReason });
			const goal = goalAt.get(cur.key);
			if (goal && remaining.includes(goal)) {
				reached.push({ duck: goal.duck, keys: chain(parent, cur.key), cost: cur.g });
				remaining = remaining.filter((g) => g !== goal);
				E.emit({ action: 'found', node: id, g: cur.g, duck: goal.duck, reason: 'FOUND_DUCK', params: { left: remaining.length } });
				if (mode === 'nearest' || remaining.length === 0) break;
				if (withH) {
					h = G.heuristic(remaining.map((g) => g.cell));
					const old = heap.toArray();
					heap = new Heap<Entry>(byFthenH);
					for (const e of old) {
						e.h = h(e.r, e.c);
						e.f = keyOfEntry(e.g, e.h);
						heap.push(e);
					}
				}
			}
			for (const e of G.out(cur.r, cur.c)) {
				if (closed.has(e.key)) continue;
				const g = cur.g + e.cost;
				const old = best.get(e.key);
				if (old !== undefined && (kind === 'greedy' || g >= old)) continue;
				best.set(e.key, g);
				parent.set(e.key, cur.key);
				const ent = push(e.r, e.c, g);
				E.emit({
					action: old === undefined ? 'push' : 'relax',
					node: idOf(e.r, e.c),
					from: id,
					via: e.via,
					g,
					...hf(ent),
					reason: old === undefined ? 'PUSH_NEW' : 'RELAX_IMPROVED',
					params: old === undefined ? { dir: e.dir } : { dir: e.dir, oldG: old, newG: g },
				});
			}
		}
		E.size = 0;
		return { reached, budgetHit };
	};

export type { Cell };
