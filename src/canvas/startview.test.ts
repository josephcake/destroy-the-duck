// Prism qa gate, must-fix 2: the phone start view, Fit board, and off-screen Duck chips.
import { BOARD } from '../model/bounds';
import { CELL, cellInView, fitZoom, frame, revealCell, startView } from './view';
import { offscreenChips } from './chips';

const ARROW = { r: 17, c: 15 }, DUCK = { r: 17, c: 64 };
const portrait = { w: 390, h: 844, ins: { top: 68, right: 12, bottom: 68, left: 12 } };
const landscape = { w: 844, h: 390, ins: { top: 64, right: 24, bottom: 64, left: 24 } };
const desk = { w: 1280, h: 800, ins: { top: 56, right: 24, bottom: 72, left: 24 } };
const firstCol = (v: { panX: number; zoom: number }, left: number) => (left - v.panX) / (CELL * v.zoom);

test('390 x 844: Start view opens at 75% with all rows, cols 12-35, the Arrow 3 cells in; Fit board stays at ~23%', () => {
	const { w, h, ins } = portrait;
	expect(fitZoom(BOARD, w, h, ins)).toBeCloseTo(0.229, 2);
	const v = startView(BOARD, w, h, ins, ARROW, DUCK)!;
	expect(v.zoom).toBe(0.75);
	expect(firstCol(v, ins.left)).toBeCloseTo(12, 5); // Arrow (col 15) three cells from the left
	expect(Math.floor(firstCol(v, w - ins.right))).toBe(36); // cols 12-35 fully in view
	expect(cellInView(v, w, h, ins, ARROW.r, ARROW.c)).toBe(true);
	expect(cellInView(v, w, h, ins, 0, 15) && cellInView(v, w, h, ins, 34, 15)).toBe(true); // every row
	expect(cellInView(v, w, h, ins, DUCK.r, DUCK.c)).toBe(false); // she gets an edge chip
	expect(frame(BOARD, w, h, ins, 1.5).zoom).toBeCloseTo(0.229, 2);
});

test('844 x 390: Start view at 75% centres on the Arrow-Duck span, both in view, rows around the Arrow', () => {
	const { w, h, ins } = landscape;
	expect(fitZoom(BOARD, w, h, ins)).toBeLessThan(0.5);
	const v = startView(BOARD, w, h, ins, ARROW, DUCK)!;
	expect(v.zoom).toBe(0.75);
	expect(cellInView(v, w, h, ins, ARROW.r, ARROW.c)).toBe(true);
	expect(cellInView(v, w, h, ins, DUCK.r, DUCK.c)).toBe(true);
	expect(cellInView(v, w, h, ins, 9, 40) && cellInView(v, w, h, ins, 25, 40)).toBe(true); // rows 9-25
	expect(cellInView(v, w, h, ins, 0, 40)).toBe(false);
});

test('1280: unchanged, Start view and Fit board both frame the whole board', () => {
	const { w, h, ins } = desk;
	expect(fitZoom(BOARD, w, h, ins)).toBeGreaterThanOrEqual(0.5);
	expect(startView(BOARD, w, h, ins, ARROW, DUCK)).toBeNull();
});

test('off-screen Duck chips: one per Duck on her edge at her row, clamped inside the insets, stacked 8 px apart, ✓ once found', () => {
	const { w, h, ins } = portrait;
	const v = startView(BOARD, w, h, ins, ARROW, DUCK)!;
	const ducks = [
		{ ...DUCK, n: 1, found: false },
		{ r: 17, c: 70, n: 2, found: true },
		{ r: 18, c: 20, n: 3, found: false }, // in view: no chip
		{ r: 0, c: 1, n: 4, found: false },
	];
	const chips = offscreenChips(ducks, v, w, h, ins);
	expect(chips.map((c) => [c.n, c.edge])).toEqual([[1, 'right'], [2, 'right'], [4, 'left']]);
	const [a, b] = chips;
	expect(a.x).toBe(w - ins.right - 22);
	expect(b.y - a.y).toBeGreaterThanOrEqual(44 + 8);
	expect(b.found).toBe(true);
	for (const c of chips) expect(c.y - 22).toBeGreaterThanOrEqual(ins.top);
	// tapping eases until she is in view
	const to = revealCell(v, w, h, ins, DUCK.r, DUCK.c);
	expect(to.zoom).toBe(v.zoom);
	expect(cellInView(to, w, h, ins, DUCK.r, DUCK.c)).toBe(true);
	expect(offscreenChips([{ ...DUCK, n: 1, found: false }], to, w, h, ins)).toHaveLength(0);
});
