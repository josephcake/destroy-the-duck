// Pan/zoom math. screen = world * zoom + pan; world px = cell * CELL.
import { Bounds } from '../model/cell';

export const CELL = 20; // today's cell size (td.styles.js)
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;
export const ZOOM_STOPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 8];

export type View = { panX: number; panY: number; zoom: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function cellAt(v: View, sx: number, sy: number) {
	return {
		r: Math.floor((sy - v.panY) / v.zoom / CELL),
		c: Math.floor((sx - v.panX) / v.zoom / CELL),
	};
}

export function cellToScreen(v: View, r: number, c: number) {
	const s = CELL * v.zoom;
	return { x: v.panX + c * s, y: v.panY + r * s, s };
}

/** Zoom to `zoom` keeping the screen point (sx, sy) fixed. */
export function zoomAt(v: View, sx: number, sy: number, zoom: number): View {
	const z = clampZoom(zoom);
	const k = z / v.zoom;
	return { zoom: z, panX: sx - (sx - v.panX) * k, panY: sy - (sy - v.panY) * k };
}

export function nextStop(z: number, dir: 1 | -1) {
	if (dir > 0) return ZOOM_STOPS.find((s) => s > z + 1e-6) ?? ZOOM_MAX;
	return [...ZOOM_STOPS].reverse().find((s) => s < z - 1e-6) ?? ZOOM_MIN;
}

/** View that frames `b` (cells, inclusive) inside a w x h viewport minus insets. */
export function frame(b: Bounds, w: number, h: number, inset: Insets, maxZoom = 1.5, minZoom = ZOOM_MIN): View {
	const cols = b.c1 - b.c0 + 1;
	const rows = b.r1 - b.r0 + 1;
	const aw = Math.max(50, w - inset.left - inset.right);
	const ah = Math.max(50, h - inset.top - inset.bottom);
	const zoom = clampZoom(Math.max(minZoom, Math.min(aw / (cols * CELL), ah / (rows * CELL), maxZoom)));
	const s = CELL * zoom;
	return {
		zoom,
		panX: inset.left + (aw - cols * s) / 2 - b.c0 * s,
		panY: inset.top + (ah - rows * s) / 2 - b.r0 * s,
	};
}

export function visibleBounds(v: View, w: number, h: number): Bounds {
	const a = cellAt(v, 0, 0);
	const b = cellAt(v, w, h);
	return { r0: a.r - 1, c0: a.c - 1, r1: b.r + 1, c1: b.c + 1 };
}

/** Board overscroll: how far past its edge the board can be pulled, in px. */
export const OVERSCROLL = 48;
/**
 * Keeps a bounded board on screen (Joseph 2026-11-22: the board has edges).
 * Zoom: no smaller than half the zoom that fits the board. Pan, per axis: a
 * board wider than the viewport can't be pulled more than OVERSCROLL past
 * either edge; a narrower one stays fully visible (OVERSCROLL from the sides).
 */
export function clampView(v: View, w: number, h: number, b: Bounds): View {
	const cols = b.c1 - b.c0 + 1, rows = b.r1 - b.r0 + 1;
	const fitZ = Math.min(w / (cols * CELL), h / (rows * CELL));
	const zoom = clampZoom(Math.max(v.zoom, Math.min(1, fitZ * 0.5)));
	const s = CELL * zoom;
	const axis = (pan: number, view: number, size: number, first: number) => {
		const ov = Math.min(OVERSCROLL, Math.max(0, (view - size) / 2));
		const lo = Math.min(view - size - ov, ov), hi = Math.max(view - size - ov, ov);
		const edge = pan + first * s; // screen position of the board's first edge
		return pan + (Math.max(lo, Math.min(hi, edge)) - edge);
	};
	// keep the screen point under the old centre when the zoom was clamped
	const z0 = zoom === v.zoom ? v : zoomAt(v, w / 2, h / 2, zoom);
	return { zoom, panX: axis(z0.panX, w, cols * s, b.c0), panY: axis(z0.panY, h, rows * s, b.r0) };
}
