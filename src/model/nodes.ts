// Phase C node bookkeeping on the Board: teleporter pairs and extra ducks.
import { Board } from './board';

/** Pads without a partner (shown in the UI; the engine ignores them). */
export function lonePads(board: Board): number[] {
	const n = new Map<number, number>();
	for (const [, , t] of board.entries()) if (t.kind === 'pad') n.set(t.pair, (n.get(t.pair) ?? 0) + 1);
	return [...n].filter(([, k]) => k === 1).map(([p]) => p);
}

/** Next free pad pair: the first pair with one pad, else the lowest unused. */
export function nextPadPair(board: Board): number {
	const n = new Map<number, number>();
	for (const [, , t] of board.entries()) if (t.kind === 'pad') n.set(t.pair, (n.get(t.pair) ?? 0) + 1);
	for (const [p, k] of [...n].sort((a, b) => a[0] - b[0])) if (k === 1) return p;
	for (let p = 0; p < 26; p++) if (!n.has(p)) return p;
	return -1;
}

/** Next extra duck number (duck 1 is the classic Duck). */
export function nextDuck(board: Board): number {
	const used = new Set<number>();
	for (const [, , t] of board.entries()) if (t.kind === 'duck') used.add(t.n);
	for (let n = 2; n < 100; n++) if (!used.has(n)) return n;
	return -1;
}

/** Direction of a one-cell move, or null. N=0 E=1 S=2 W=3. */
export function dirOf(a: { r: number; c: number }, b: { r: number; c: number }): 0 | 1 | 2 | 3 | null {
	if (b.r === a.r - 1 && b.c === a.c) return 0;
	if (b.r === a.r && b.c === a.c + 1) return 1;
	if (b.r === a.r + 1 && b.c === a.c) return 2;
	if (b.r === a.r && b.c === a.c - 1) return 3;
	return null;
}
export const PAD_LETTER = (pair: number) => String.fromCharCode(97 + pair);
