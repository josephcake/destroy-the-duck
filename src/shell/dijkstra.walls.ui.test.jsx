// Classic Dijkstra "ignored walls painted around Quack" (Mochi, for Joseph, 2026-11-22).
// Root cause: not the helper. The legacy wall painter only turns *unvisited* cells
// into walls, so a stroke across the cells the last classic run left 'visited'
// (the drawn path) silently skipped them. The ring around Quack had a hole exactly
// where the old path ran, and Dijkstra, correctly, went through it.
// Classic Dijkstra shows only its shortest path (the helper returns the path, not a
// visit order), so "visited 48" on the open board is the 50-cell path minus the
// Arrow and Duck: by design, not an early stop.
import { fireEvent, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import { dijkstraHelper } from '../Context/algorithms/dijkstraHelper';
import { makeDocument, withShim } from '../classic/shim';
import AppShell from './AppShell';
import { mountLegacy, drain, act, T } from '../testing/legacyController';

const ROWS = 35, COLS = 80;
const RING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const blank = () => Array.from({ length: ROWS * COLS }, () => 'light_unvisited');
const run = (classes, s, e) => withShim(makeDocument(classes), () => dijkstraHelper(s, e));
const key = (id) => id.split('-').map(Number);
/** BFS shortest path length in cells (Arrow and Duck included), or 0 when unreachable. */
function bfsCells(classes, s, e) {
	const [sr, sc] = key(s), [er, ec] = key(e);
	const d = new Map([[sr * COLS + sc, 1]]);
	const q = [[sr, sc]];
	while (q.length) {
		const [r, c] = q.shift();
		if (r === er && c === ec) return d.get(r * COLS + c);
		for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
			const R = r + a, C = c + b;
			if (R < 0 || R >= ROWS || C < 0 || C >= COLS || d.has(R * COLS + C) || classes[R * COLS + C].endsWith('_wall')) continue;
			d.set(R * COLS + C, d.get(r * COLS + c) + 1);
			q.push([R, C]);
		}
	}
	return 0;
}
const isPath = (classes, path) =>
	path.every((id, i) => {
		const [r, c] = key(id);
		if (classes[r * COLS + c].endsWith('_wall')) return false;
		if (i === 0) return true;
		const [pr, pc] = key(path[i - 1]);
		return Math.abs(r - pr) + Math.abs(c - pc) === 1;
	});

describe('classic Dijkstra helper on the full 35 x 80 board', () => {
	test('open board: the known shortest path, Arrow to Quack', () => {
		const classes = blank();
		const path = run(classes, '17-15', '17-64');
		expect(path[0]).toBe('17-15');
		expect(path.at(-1)).toBe('17-64');
		expect(path).toHaveLength(50); // 49 steps
		expect(isPath(classes, path)).toBe(true);
		const far = run(classes, '0-0', '34-79');
		expect(far).toHaveLength(34 + 79 + 1); // corner to corner, the whole board considered
		expect(isPath(classes, far)).toBe(true);
	});
	test('Quack walled in on all sides: no path', () => {
		const classes = blank();
		for (const [a, b] of RING) classes[(17 + a) * COLS + 64 + b] = 'light_wall';
		expect(run(classes, '17-15', '17-64')).toEqual(['17-15']);
	});
	test('a wall across the way: the path routes around it, still shortest', () => {
		const classes = blank();
		for (let r = 5; r < 30; r++) classes[r * COLS + 40] = 'light_wall';
		const path = run(classes, '17-15', '17-64');
		expect(path.at(-1)).toBe('17-64');
		expect(isPath(classes, path)).toBe(true);
		expect(path).toHaveLength(bfsCells(classes, '17-15', '17-64'));
		expect(path.length).toBeGreaterThan(50);
	});
});

const Shell = ({ children }) => (
	<TableContextProvider>
		<AppShell />
		{children}
	</TableContextProvider>
);
const at = (r, c) => ({ clientX: c * 20 + 10, clientY: r * 20 + 10, button: 0, pointerId: 1, pointerType: 'mouse' });
const click = (canvas, r, c) => {
	act(() => void fireEvent.pointerDown(canvas, at(r, c)));
	act(() => void fireEvent.pointerUp(canvas, at(r, c)));
};
const cls = (id) => document.getElementById(id).className;

beforeEach(() => {
	T.useFakeTimers();
	localStorage.clear();
});
afterEach(() => T.useRealTimers());

test('in the app: after a found run, walls painted around Quack (across the old path) close it in', () => {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name: /^Dijkstra/ })[0]));
	const canvas = document.querySelector('canvas');
	const [er, ec] = key(ref.ctx.ending);
	act(() => fireEvent.click(screen.getByTestId('go')));
	drain(ref);
	act(() => T.runOnlyPendingTimers());
	expect(ref.ctx.running).toBe(false);
	expect(cls(`${er}-${ec - 1}`)).toMatch(/_visited\b/); // the drawn path ends next to Quack
	// a drag stroke across the old path paints the path cell too
	act(() => void fireEvent.pointerDown(canvas, at(er - 1, 30)));
	act(() => void fireEvent.pointerMove(canvas, at(er + 1, 30)));
	act(() => void fireEvent.pointerUp(canvas, at(er + 1, 30)));
	expect(cls(`${er}-30`)).toMatch(/_wall\b/);
	for (const [a, b] of RING) click(canvas, er + a, ec + b);
	act(() => T.advanceTimersByTime(32));
	for (const [a, b] of RING) expect(cls(`${er + a}-${ec + b}`)).toMatch(/_wall\b/); // the old path cell too
	act(() => fireEvent.click(screen.getByTestId('go')));
	const { toastSeen } = drain(ref);
	act(() => T.runOnlyPendingTimers());
	expect(toastSeen).toBe(true); // "Cannot find Quack!"
	expect(cls(`${er}-${ec - 1}`)).toMatch(/_wall\b/);
});
