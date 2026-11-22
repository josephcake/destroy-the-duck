// Off-screen Duck chips (Prism qa gate, must-fix 2 §6): while a Duck is out of
// view, a 44 x 44 chip sits on that screen edge at her row (or column), clamped
// inside the insets; several on one edge stack 8 px apart.
import { Insets, View, cellToScreen } from './view';

export type Chip = { key: string; r: number; c: number; n: number | null; found: boolean; edge: 'left' | 'right' | 'top' | 'bottom'; x: number; y: number };
export const CHIP = 44;
export const CHIP_GAP = 8;

export function offscreenChips(ducks: { r: number; c: number; n: number | null; found: boolean }[], v: View, w: number, h: number, ins: Insets): Chip[] {
	const half = CHIP / 2;
	const out: Chip[] = [];
	for (const d of ducks) {
		const q = cellToScreen(v, d.r, d.c);
		const cx = q.x + q.s / 2, cy = q.y + q.s / 2;
		const L = ins.left, R = w - ins.right, T = ins.top, B = h - ins.bottom;
		let edge: Chip['edge'] | null = null;
		if (q.x + q.s <= L || cx < L) edge = 'left';
		else if (q.x >= R || cx > R) edge = 'right';
		else if (q.y + q.s <= T || cy < T) edge = 'top';
		else if (q.y >= B || cy > B) edge = 'bottom';
		if (!edge) continue;
		const clampY = (y: number) => Math.min(B - half, Math.max(T + half, y));
		const clampX = (x: number) => Math.min(R - half, Math.max(L + half, x));
		const x = edge === 'left' ? L + half : edge === 'right' ? R - half : clampX(cx);
		const y = edge === 'top' ? T + half : edge === 'bottom' ? B - half : clampY(cy);
		out.push({ key: `${d.n ?? 1}`, r: d.r, c: d.c, n: d.n, found: d.found, edge, x, y });
	}
	// stack chips on the same edge 8 px apart
	for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
		const along = edge === 'left' || edge === 'right' ? 'y' : 'x';
		const on = out.filter((c) => c.edge === edge).sort((a, b) => a[along] - b[along]);
		for (let i = 1; i < on.length; i++) on[i][along] = Math.max(on[i][along], on[i - 1][along] + CHIP + CHIP_GAP);
	}
	return out;
}
