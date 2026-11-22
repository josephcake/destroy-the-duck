// Jump point search on a 4-connected, uniform-cost grid (JPS4).
// Canonical order: at a tie, move horizontally first. So
//  - after a horizontal move: keep going, or turn north / south (natural);
//  - after a vertical move: keep going; turning east / west is only needed
//    ("forced") when the cell behind on that side is blocked, otherwise the
//    horizontal-first route through the cell behind is just as short.
// Horizontal runs stop where a vertical jump would find something, vertical
// runs stop at forced turns. Ducks stop both. Only valid on a plain grid:
// weights, one-way lanes and teleporters break the pruning, so the engine
// refuses to run it there (the UI disables it and says why).
import { idOf, keyOf } from '../../model/cell';
import { Core, Goal, Reach, chain } from '../emit';
import { Heap } from '../heap';

type Entry = { key: number; r: number; c: number; g: number; h: number; f: number; seq: number; dr: number; dc: number };
const less = (a: Entry, b: Entry) => a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.seq < b.seq)));
const DIRS4: [number, number, string][] = [
	[-1, 0, 'N'],
	[0, 1, 'E'],
	[1, 0, 'S'],
	[0, -1, 'W'],
];
const dirName = (dr: number, dc: number) => DIRS4.find(([a, b]) => a === dr && b === dc)![2];

export const jps4: Core = (E, G, start, goals, mode) => {
	if (!G.plain) throw new Error('JPS needs a plain grid (no weights, one-way lanes or teleporters)');
	let remaining: Goal[] = goals.slice();
	const goalAt = new Map(goals.map((g) => [g.key, g]));
	let goalKeys = new Set(remaining.map((g) => g.key));
	let h = G.heuristic(remaining.map((g) => g.cell));
	const open = (r: number, c: number) => G.passable(r, c);
	const isGoal = (r: number, c: number) => goalKeys.has(keyOf(r, c));

	const forcedV = (r: number, c: number, dr: number) => [-1, 1].some((s) => open(r, c + s) && !open(r - dr, c + s));
	const jumpV = (r: number, c: number, dr: number): [number, number] | null => {
		for (;;) {
			r += dr;
			if (!open(r, c)) return null;
			if (isGoal(r, c) || forcedV(r, c, dr)) return [r, c];
		}
	};
	const jumpH = (r: number, c: number, dc: number): [number, number] | null => {
		for (;;) {
			c += dc;
			if (!open(r, c)) return null;
			if (isGoal(r, c) || jumpV(r, c, -1) || jumpV(r, c, 1)) return [r, c];
		}
	};
	const successors = (e: { r: number; c: number; dr: number; dc: number }): [number, number][] => {
		if (e.dr === 0 && e.dc === 0) return DIRS4.map(([a, b]) => [a, b]);
		if (e.dr === 0) return [[-1, 0], [0, e.dc], [1, 0]].filter(([a, b]) => !(a === 0 && b === -e.dc)) as [number, number][];
		const out: [number, number][] = [[e.dr, 0]];
		for (const s of [1, -1]) if (open(e.r, e.c + s) && !open(e.r - e.dr, e.c + s)) out.push([0, s]);
		return out;
	};

	const heap = new Heap<Entry>(less);
	const best = new Map<number, number>();
	const parent = new Map<number, number>();
	const closed = new Set<number>();
	const reached: Reach[] = [];
	let seq = 0;
	const push = (r: number, c: number, g: number, dr: number, dc: number) => {
		const hh = h(r, c);
		const e = { key: keyOf(r, c), r, c, g, h: hh, f: g + hh, seq: seq++, dr, dc };
		heap.push(e);
		E.size = heap.size;
		return e;
	};
	const s0 = push(start.r, start.c, 0, 0, 0);
	best.set(s0.key, 0);
	E.emit({ action: 'init', node: idOf(start.r, start.c), g: 0, h: s0.h, f: s0.f, reason: 'PUSH_NEW' });
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
		E.emit({ action: 'pop', node: id, g: cur.g, h: cur.h, f: cur.f, reason: 'POP_MIN_F' });
		const goal = goalAt.get(cur.key);
		if (goal && remaining.includes(goal)) {
			reached.push({ duck: goal.duck, keys: expand(chain(parent, cur.key)), cost: cur.g });
			remaining = remaining.filter((g) => g !== goal);
			E.emit({ action: 'found', node: id, g: cur.g, duck: goal.duck, reason: 'FOUND_DUCK', params: { left: remaining.length } });
			if (mode === 'nearest' || !remaining.length) break;
			goalKeys = new Set(remaining.map((g) => g.key));
			h = G.heuristic(remaining.map((g) => g.cell));
		}
		for (const [dr, dc] of successors(cur)) {
			const jp = dr === 0 ? jumpH(cur.r, cur.c, dc) : jumpV(cur.r, cur.c, dr);
			if (!jp) continue;
			const [r, c] = jp;
			const k = keyOf(r, c);
			if (closed.has(k)) continue;
			const g = cur.g + Math.abs(r - cur.r) + Math.abs(c - cur.c);
			const old = best.get(k);
			if (old !== undefined && g >= old) continue;
			best.set(k, g);
			parent.set(k, cur.key);
			const ent = push(r, c, g, dr, dc);
			E.emit({
				action: old === undefined ? 'push' : 'relax',
				node: idOf(r, c),
				from: id,
				g,
				h: ent.h,
				f: ent.f,
				reason: 'JUMP_POINT',
				params: { dir: dirName(dr, dc), run: Math.abs(r - cur.r) + Math.abs(c - cur.c) },
			});
		}
	}
	E.size = 0;
	return { reached, budgetHit };
};

/** Jump points → every cell along the straight runs between them. */
function expand(points: number[]): number[] {
	const out: number[] = [];
	const SPAN = 2 ** 26;
	const OFF = 2 ** 25;
	const rc = (k: number) => [Math.floor(k / SPAN) - OFF, (k % SPAN) - OFF];
	for (let i = 0; i < points.length; i++) {
		const [r, c] = rc(points[i]);
		if (i === 0) {
			out.push(points[i]);
			continue;
		}
		let [pr, pc] = rc(points[i - 1]);
		const sr = Math.sign(r - pr);
		const sc = Math.sign(c - pc);
		while (pr !== r || pc !== c) {
			pr += sr;
			pc += sc;
			out.push(keyOf(pr, pc));
		}
	}
	return out;
}
