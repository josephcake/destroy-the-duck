import { cellAt, cellToScreen, frame, zoomAt, nextStop, CELL } from './view';
import { HOME } from '../model/cell';

test('cell <-> screen round trip', () => {
	const v = { panX: 37, panY: -12, zoom: 1.5 };
	for (const [r, c] of [[0, 0], [17, 64], [-5, -9]]) {
		const p = cellToScreen(v, r, c);
		expect(cellAt(v, p.x + p.s / 2, p.y + p.s / 2)).toEqual({ r, c });
	}
});

test('zoomAt keeps the cursor point fixed', () => {
	const v = { panX: 100, panY: 50, zoom: 1 };
	const z = zoomAt(v, 400, 300, 2.5);
	expect(cellAt(z, 400, 300)).toEqual(cellAt(v, 400, 300));
	expect((400 - z.panX) / z.zoom).toBeCloseTo((400 - v.panX) / v.zoom);
});

test('frame centres Home and respects insets (pinned legend padding)', () => {
	const v = frame(HOME, 1000, 600, { top: 0, right: 0, bottom: 100, left: 0 });
	const bottom = v.panY + 35 * CELL * v.zoom;
	expect(bottom).toBeLessThanOrEqual(500 + 1e-6);
	expect(v.zoom).toBeCloseTo(Math.min(1000 / 1600, 500 / 700));
});

test('zoom stops', () => {
	expect(nextStop(1, 1)).toBe(1.5);
	expect(nextStop(1, -1)).toBe(0.75);
	expect(nextStop(8, 1)).toBe(8);
});
