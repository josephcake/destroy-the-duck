// @vitest-environment node
// One-way spec §1.1/§1.2: axis lock, L-turns, re-pointing, quarter turns.
import { laneEnd, laneMove, laneStart, turn } from './laneDrag';
import { Dir } from '../model/board';

function drag(points: [number, number][]) {
	const laid = new Map<string, Dir>();
	const g = laneStart(points[0][0], points[0][1]);
	const put = (r: number, c: number, d: Dir) => void laid.set(`${r},${c}`, d);
	for (const [x, y] of points.slice(1)) laneMove(g, x, y, put);
	const [x, y] = points[points.length - 1];
	laneEnd(g, x, y, put);
	return laid;
}
const path = (from: [number, number], to: [number, number], n = 40) => Array.from({ length: n + 1 }, (_, i) => [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n] as [number, number]);

test('a 45° drag lays an L (E then S), never a staircase', () => {
	const laid = drag(path([10.5, 10.5], [16.5, 16.5]));
	const cells = [...laid.keys()];
	const rows = new Set(cells.map((k) => k.split(',')[0]));
	const cols = new Set(cells.map((k) => k.split(',')[1]));
	// every cell sits on one of the two arms of the L
	for (const [k, d] of laid) {
		const [r, c] = k.split(',').map(Number);
		const onTop = r === 10, corner = laid.get(`${r},${c}`);
		expect(onTop || c === Math.max(...[...cols].map(Number))).toBe(true);
		if (!onTop) expect(d).toBe(2); // the vertical arm points S
		void corner;
	}
	expect(rows.size).toBeGreaterThan(3);
	const cornerCol = Math.max(...[...cols].map(Number));
	expect(laid.get(`10,${cornerCol}`)).toBe(2); // the corner takes the new direction
	expect(laid.get('10,10')).toBe(1); // the first arm points E
});

test('a right-then-down drag turns a clean corner mid-drag', () => {
	const laid = drag([...path([3.5, 3.5], [9.5, 3.5]), ...path([9.5, 3.5], [9.5, 9.5])]);
	expect(laid.get('3,8')).toBe(1);
	expect(laid.get('3,9')).toBe(2); // the corner takes the new direction
	expect(laid.get('9,9')).toBe(2);
	expect(laid.size).toBe(13);
});

test('the axis locks at 0.5 cell: a short wobble lays nothing', () => {
	expect(drag([[10.5, 10.5], [10.8, 10.7], [10.6, 10.3]]).size).toBe(0);
});

test('a straight drag lays one lane in the drag direction; dragging back re-points it', () => {
	const fwd = drag(path([5.5, 3.5], [12.5, 3.6]));
	expect([...fwd.values()].every((d) => d === 1)).toBe(true);
	expect(fwd.size).toBe(8);
	const back = drag([...path([5.5, 3.5], [12.5, 3.5]), ...path([12.5, 3.5], [5.5, 3.5])]);
	expect([...back.values()].every((d) => d === 3)).toBe(true); // the lane follows the last motion
});

test('a vertical drag up points N; perpendicular drift under 0.75 cell does not turn', () => {
	const up = drag(path([7.5, 20.5], [8.2, 12.5]));
	expect([...up.values()].every((d) => d === 0)).toBe(true);
	expect(new Set([...up.keys()].map((k) => k.split(',')[1]))).toEqual(new Set(['7']));
});

test('tap turns a lane clockwise a quarter; Shift turns it back', () => {
	expect(turn(0)).toBe(1);
	expect(turn(1)).toBe(2);
	expect(turn(3)).toBe(0);
	expect(turn(0, true)).toBe(3);
	expect(turn(turn(2), true)).toBe(2);
});

test('the drag clamps at the board edge', () => {
	const laid = drag(path([75.5, 3.5], [95.5, 3.5]));
	expect(Math.max(...[...laid.keys()].map((k) => Number(k.split(',')[1])))).toBe(79);
});
