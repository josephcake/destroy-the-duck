// Applies a Prism generator to Home: walls go into the classic table (the
// same class swap the classic mazes and Clear Wall use, so the classic
// algorithms see them), weights into the board store.
import { Board } from '../model/board';
import { HOME_COLS, HOME_ROWS, idOf } from '../model/cell';
import { GenId, generate, Pt } from '../model/generators';

const STATE = /\b(\w+)_(unvisited|visited|wall)\b/;

export function applyGenerator(id: GenId, seed: number, board: Board, start: number, end: number) {
	const at = (i: number): Pt => ({ r: Math.floor(i / HOME_COLS), c: i % HOME_COLS });
	const inHome = (r: number, c: number) => r >= 0 && r < HOME_ROWS && c >= 0 && c < HOME_COLS;
	const ducks: Pt[] = end >= 0 ? [at(end)] : [];
	const extra: (Pt & { n: number })[] = [];
	const keepOpen: Pt[] = [];
	for (const [r, c, t] of board.entries()) {
		if (!inHome(r, c)) continue;
		if (t.kind === 'duck') extra.push({ r, c, n: t.n });
		else if (t.kind === 'oneway' || t.kind === 'pad') keepOpen.push({ r, c });
	}
	ducks.push(...extra.sort((a, b) => a.n - b.n));
	const out = generate(id, { rows: HOME_ROWS, cols: HOME_COLS, seed, start: start >= 0 ? at(start) : { r: 17, c: 15 }, ducks, keepOpen });

	if (id !== 'weightNoise') {
		for (let i = 0; i < HOME_ROWS * HOME_COLS; i++) {
			const { r, c } = at(i);
			const td = document.getElementById(idOf(r, c));
			if (!td || !STATE.test(td.className)) continue; // Arrow / Duck cells keep their class
			const want = out.wall[i] ? 'wall' : 'unvisited';
			td.className = td.className.replace(STATE, `$1_${want}`).replace(/\s*\bpreview\b/, '');
			if (out.wall[i] && board.get(r, c)?.kind === 'weight') board.set(r, c, undefined);
		}
	} else {
		const old = [...board.entries()].filter(([r, c, t]) => t.kind === 'weight' && inHome(r, c));
		for (const [r, c] of old) board.set(r, c, undefined);
		for (let i = 0; i < HOME_ROWS * HOME_COLS; i++) {
			const w = out.weight[i];
			if (!w) continue;
			const { r, c } = at(i);
			const td = document.getElementById(idOf(r, c));
			if (td && /_wall\b/.test(td.className)) continue;
			if (board.get(r, c)) continue; // nodes stay
			board.set(r, c, { kind: 'weight', cost: w as 2 | 5 | 10 });
		}
	}
	return out;
}
