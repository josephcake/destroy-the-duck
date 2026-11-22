// Bellman-Ford: relax every out-edge of every reached cell, row by row,
// round after round, until a round changes nothing. One distance field
// answers Nearest and All at once. Search area = snapshot bounds.
import { idOf, keyOf } from '../../model/cell';
import { Core, Reach, chain } from '../emit';

export const bellmanFord: Core = (E, G, start, goals, mode) => {
	const { r0, c0, r1, c1 } = G.snap.bounds;
	const dist = new Map<number, number>([[keyOf(start.r, start.c), 0]]);
	const parent = new Map<number, number>();
	E.size = 1;
	E.emit({ action: 'init', node: idOf(start.r, start.c), g: 0, reason: 'PUSH_NEW' });
	let budgetHit = false;
	for (let round = 1; !budgetHit; round++) {
		E.next();
		E.emit({ action: 'round', node: idOf(start.r, start.c), reason: 'ROUND', params: { round } });
		let changed = false;
		for (let r = r0; r <= r1 && !budgetHit; r++)
			for (let c = c0; c <= c1; c++) {
				const k = keyOf(r, c);
				const d = dist.get(k);
				if (d === undefined) continue;
				let scanned = false;
				for (const e of G.out(r, c)) {
					const nd = d + e.cost;
					const old = dist.get(e.key);
					if (old !== undefined && nd >= old) continue;
					if (!scanned) {
						if (!E.expand()) {
							budgetHit = true;
							break;
						}
						scanned = true;
						E.next();
						E.emit({ action: 'pop', node: idOf(r, c), g: d, reason: 'POP_SCAN', params: { round } });
					}
					dist.set(e.key, nd);
					parent.set(e.key, k);
					changed = true;
					E.size = dist.size;
					E.emit({
						action: old === undefined ? 'push' : 'relax',
						node: idOf(e.r, e.c),
						from: idOf(r, c),
						via: e.via,
						g: nd,
						reason: old === undefined ? 'PUSH_NEW' : 'RELAX_IMPROVED',
						params: old === undefined ? { dir: e.dir } : { dir: e.dir, oldG: old, newG: nd },
					});
				}
				if (budgetHit) break;
			}
		if (!changed) break;
	}
	let reached: Reach[] = goals
		.filter((g) => dist.has(g.key))
		.map((g) => ({ duck: g.duck, keys: chain(parent, g.key), cost: dist.get(g.key)! }));
	if (mode === 'nearest' && reached.length) reached = [reached.reduce((a, b) => (b.cost < a.cost ? b : a))];
	for (const r of reached) {
		const end = r.keys[r.keys.length - 1];
		const g = goals.find((x) => x.key === end)!;
		E.emit({ action: 'found', node: idOf(g.cell.r, g.cell.c), g: r.cost, duck: r.duck, reason: 'FOUND_DUCK' });
	}
	E.size = 0;
	return { reached, budgetHit };
};
