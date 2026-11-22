// Coordinates on the infinite board. Negative rows/cols are allowed.
export type Cell = { readonly r: number; readonly c: number };

// Legacy cell ids ("r-c") are kept at the boundaries (classic grid, traces, levels).
export type LegacyId = string;

export type Bounds = { r0: number; c0: number; r1: number; c1: number }; // inclusive

export const HOME: Bounds = { r0: 0, c0: 0, r1: 34, c1: 79 }; // today's 35x80 grid
export const HOME_ROWS = 35;
export const HOME_COLS = 80;

const OFFSET = 2 ** 25;
const SPAN = 2 ** 26;

/** Packs a cell into one safe integer (|r|, |c| < 2^25). */
export const keyOf = (r: number, c: number): number => (r + OFFSET) * SPAN + (c + OFFSET);
export const cellOfKey = (k: number): Cell => ({
	r: Math.floor(k / SPAN) - OFFSET,
	c: (k % SPAN) - OFFSET,
});

export const idOf = (r: number, c: number): LegacyId => `${r}-${c}`;

const ID = /^(-?\d+)-(-?\d+)$/;
export function parseId(id: LegacyId): Cell {
	const m = ID.exec(id);
	if (!m) throw new Error(`bad cell id ${id}`);
	return { r: Number(m[1]), c: Number(m[2]) };
}

export const inBounds = (b: Bounds, r: number, c: number) =>
	r >= b.r0 && r <= b.r1 && c >= b.c0 && c <= b.c1;

export const inHome = (r: number, c: number) => inBounds(HOME, r, c);

export const manhattan = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
