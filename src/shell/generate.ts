// Applies a Prism generator to a region of the endless board (the cells in
// view): walls inside the classic window go into the table (the same class
// swap the classic mazes and Clear Wall use, so the classic algorithms see
// them), walls outside it and all weights into the board store.
import { Board, Weight } from '../model/board';
import { Bounds, Cell, inBounds } from '../model/cell';
import { GenId, generate, Pt } from '../model/generators';
import { LegacyMirror } from '../canvas/mirror';

const STATE = /\b(\w+)_(unvisited|visited|wall)\b/;

export function applyGenerator(id: GenId, seed: number, board: Board, mirror: LegacyMirror, region: Bounds) {
	const R = region.r1 - region.r0 + 1;
	const C = region.c1 - region.c0 + 1;
	const local = (q: Cell): Pt => ({ r: q.r - region.r0, c: q.c - region.c0 });
	const world = (i: number): Cell => ({ r: region.r0 + Math.floor(i / C), c: region.c0 + (i % C) });
	// Arrow and ducks outside the region are pinned to its nearest edge cell:
	// the generator keeps that cell open and reachable, so a way out stays open.
	const pin = (q: Cell): Pt => local({ r: Math.min(region.r1, Math.max(region.r0, q.r)), c: Math.min(region.c1, Math.max(region.c0, q.c)) });
	const centre = { r: (region.r0 + region.r1) >> 1, c: (region.c0 + region.c1) >> 1 };
	const start = mirror.startCell() ?? centre;
	const d1 = mirror.endCell();
	const ducks: Pt[] = d1 ? [pin(d1)] : [];
	const extra: (Cell & { n: number })[] = [];
	const keepOpen: Pt[] = [];
	for (const [r, c, t] of board.entries()) {
		if (t.kind === 'duck') extra.push({ r, c, n: t.n });
		else if ((t.kind === 'oneway' || t.kind === 'pad') && inBounds(region, r, c)) keepOpen.push(local({ r, c }));
	}
	ducks.push(...extra.sort((a, b) => a.n - b.n).map(pin));
	const out = generate(id, { rows: R, cols: C, seed, start: pin(start), ducks, keepOpen });

	const tableCell = (q: Cell) => (mirror.inWindow(q.r, q.c) ? document.getElementById(mirror.idAt(q.r, q.c)) : null);
	if (id !== 'weightNoise') {
		for (let i = 0; i < R * C; i++) {
			const q = world(i);
			const want = !!out.wall[i];
			if (mirror.inWindow(q.r, q.c)) {
				const td = tableCell(q);
				if (!td || !STATE.test(td.className)) continue; // Arrow / Duck cells keep their class
				td.className = td.className.replace(STATE, `$1_${want ? 'wall' : 'unvisited'}`).replace(/\s*\bpreview\b/, '');
				if (want && board.get(q.r, q.c)?.kind === 'weight') board.set(q.r, q.c, undefined);
			} else {
				const t = board.get(q.r, q.c);
				if (want && (!t || t.kind === 'weight' || t.kind === 'wall')) board.set(q.r, q.c, { kind: 'wall' });
				else if (!want && t?.kind === 'wall') board.set(q.r, q.c, undefined);
			}
		}
	} else {
		const old = [...board.entries(region)].filter(([r, c, t]) => t.kind === 'weight' && inBounds(region, r, c));
		for (const [r, c] of old) board.set(r, c, undefined);
		for (let i = 0; i < R * C; i++) {
			const w = out.weight[i];
			if (!w) continue;
			const q = world(i);
			const td = tableCell(q);
			if (td && !/_unvisited\b/.test(td.className)) continue; // walls, Arrow, Duck
			if (board.get(q.r, q.c)) continue; // nodes and outside walls stay
			board.set(q.r, q.c, { kind: 'weight', cost: w as Weight });
		}
	}
	return out;
}
