// Generate fills the cells in view, wherever the view is.
import { render, screen, fireEvent, act } from '@testing-library/react';
// @ts-expect-error legacy JS module
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { Board } from '../model/board';
import { LegacyMirror } from '../canvas/mirror';
import { applyGenerator } from './generate';
import { inBounds } from '../model/cell';

test.each(['backtracker', 'prim', 'kruskal', 'division', 'wilson', 'caves'] as const)('%s fills exactly the region it is given, far from the old Home', (id) => {
	const board = new Board();
	const mirror = new LegacyMirror(); // window at (0, 0); this region is far outside it
	const region = { r0: -300, c0: 500, r1: -260, c1: 563 };
	const out = applyGenerator(id, 9, board, mirror, region);
	const walls = [...board.entries()].filter(([, , t]) => t.kind === 'wall');
	expect(walls.length).toBe(out.wall.reduce((s, x) => s + x, 0));
	expect(walls.length).toBeGreaterThan(200);
	expect(walls.every(([r, c]) => inBounds(region, r, c))).toBe(true);
	// a second region (the view moved): the new walls follow it; the old ones stay
	const next = { r0: 1000, c0: -40, r1: 1030, c1: 10 };
	applyGenerator(id, 9, board, mirror, next);
	const now = [...board.entries()].filter(([, , t]) => t.kind === 'wall');
	expect(now.some(([r, c]) => inBounds(next, r, c))).toBe(true);
	expect(now.filter(([r, c]) => inBounds(region, r, c)).length).toBe(walls.length);
});

test('mud and water fill the region with weights', () => {
	const board = new Board();
	const region = { r0: 400, c0: 400, r1: 450, c1: 480 };
	applyGenerator('weightNoise', 3, board, new LegacyMirror(), region);
	const w = [...board.entries()];
	expect(w.length).toBeGreaterThan(100);
	expect(w.every(([r, c, t]) => t.kind === 'weight' && inBounds(region, r, c))).toBe(true);
});

let size = { width: 1200, height: 800 };
beforeEach(() => {
	size = { width: 1200, height: 800 };
	HTMLElement.prototype.getBoundingClientRect = function () {
		return { x: 0, y: 0, left: 0, top: 0, right: size.width, bottom: size.height, ...size } as DOMRect;
	};
});
afterEach(() => {
	// @ts-expect-error test cleanup
	delete HTMLElement.prototype.getBoundingClientRect;
});
const frame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
const tableWalls = () => document.querySelectorAll('.legacy-mirror td[class*="_wall"]').length;

test('the Generate button builds in the current view: panned far away, the classic table stays empty', async () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	await frame();
	const canvas = document.querySelector('canvas')!;
	fireEvent.change(screen.getByLabelText('Maze'), { target: { value: 'gen:backtracker' } });
	// pan 6000 px down-right with the hand tool: the view is now hundreds of cells from the classic window
	act(() => void fireEvent.keyDown(window, { key: 'p' }));
	act(() => void fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, button: 0, pointerId: 1, pointerType: 'mouse' }));
	act(() => void fireEvent.pointerMove(canvas, { clientX: -5900, clientY: -5900, button: 0, pointerId: 1, pointerType: 'mouse' }));
	act(() => void fireEvent.pointerUp(canvas, { clientX: -5900, clientY: -5900, button: 0, pointerId: 1, pointerType: 'mouse' }));
	fireEvent.click(screen.getByTestId('generate'));
	await frame();
	expect(tableWalls()).toBe(0); // nothing landed in the classic window
	fireEvent.click(screen.getByLabelText('Home')); // back to the Arrow and Duck
	fireEvent.click(screen.getByTestId('generate'));
	await frame();
	expect(tableWalls()).toBeGreaterThan(300); // the view covers the window now
});
