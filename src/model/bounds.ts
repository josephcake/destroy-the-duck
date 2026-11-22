// The board is bounded (Joseph, 2026-11-22: "lets limit the size of the board so
// all algorithm works on it"). It is exactly the classic 35 x 80 table, the size
// the six classic helpers were written for, so every algorithm runs anywhere on
// it with the classic files byte-unchanged (see PLAN.md §11 for the numbers).
import { Bounds } from './cell';

export const BOARD_ROWS = 35;
export const BOARD_COLS = 80;
export const BOARD: Bounds = { r0: 0, c0: 0, r1: BOARD_ROWS - 1, c1: BOARD_COLS - 1 };
export const inBoard = (r: number, c: number) => r >= 0 && c >= 0 && r < BOARD_ROWS && c < BOARD_COLS;
export const clampToBoard = (r: number, c: number) => ({
	r: Math.max(0, Math.min(BOARD_ROWS - 1, r)),
	c: Math.max(0, Math.min(BOARD_COLS - 1, c)),
});
