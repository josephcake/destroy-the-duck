// Feature switches. One place to turn a shipped-but-parked feature back on.
import type { Board } from './model/board';

export const FEATURES = {
	/**
	 * One-way lanes (the draw tool, its hints and legend row). Off for now (Joseph 2026-11-22:
	 * "comment out directional feature for now. i'll think about how to implement it").
	 * The engine, the Board tile and the renderer keep full one-way support; only the UI is gated.
	 */
	oneWay: false as boolean,
};

/**
 * Drops tiles of parked features from a board (a board loaded or built with one-way
 * cells turns them into plain empty cells). Returns how many were dropped.
 */
export function dropParkedTiles(board: Board, features: { oneWay: boolean } = FEATURES): number {
	if (features.oneWay) return 0;
	let n = 0;
	for (const [, , t] of board.entries()) if (t.kind === 'oneway') n++;
	if (n) board.clear((t) => t.kind === 'oneway');
	return n;
}
