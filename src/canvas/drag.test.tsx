// Fix 11: dragging the Arrow or the Duck never paints walls.
import { render, fireEvent, act } from '@testing-library/react';
// @ts-expect-error legacy JS module
import { TableContextProvider } from '../Context/TableContext';
import AppShell from '../shell/AppShell';
import { legacyDragAction } from './CanvasStage';

test('drag decision: endpoint drags never paint, wall drags paint outside Home', () => {
	for (const tool of ['wall', 'weight', 'erase', 'pan'] as const) {
		expect(legacyDragAction(true, tool, false)).toBe('none');
		expect(legacyDragAction(true, tool, true)).toBe('legacy');
	}
	expect(legacyDragAction(false, 'wall', false)).toBe('paint');
	expect(legacyDragAction(false, 'wall', true)).toBe('legacy');
});

const walls = () => document.querySelectorAll('.legacy-mirror td[class*="_wall"]').length;
const at = (r: number, c: number) => ({ clientX: c * 20 + 10, clientY: r * 20 + 10, button: 0, pointerId: 1, pointerType: 'mouse' });

test.each([
	['Arrow', 17, 15, /_starting/],
	['Duck', 17, 64, /_ending/],
])('dragging the %s across Home with the Wall tool moves it and paints no walls', (_n, r, c, cls) => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const canvas = document.querySelector('canvas')!;
	// one act() per event, so the classic table's drag state commits in between
	act(() => void fireEvent.pointerDown(canvas, at(r, c)));
	for (let k = 1; k <= 6; k++) act(() => void fireEvent.pointerMove(canvas, at(r - k, c + k)));
	act(() => void fireEvent.pointerMove(canvas, at(r - 6, -4))); // and out of Home
	act(() => void fireEvent.pointerMove(canvas, at(r - 6, c + 6)));
	act(() => void fireEvent.pointerUp(canvas, at(r - 6, c + 6)));
	act(() => void fireEvent.mouseUp(window));
	expect(document.getElementById(`${r - 6}-${c + 6}`)!.className).toMatch(cls);
	expect(walls()).toBe(0);
});

// Prism 2: a click paints the pressed cell; a 3-cell drag paints 3.
test('a single click with the Wall tool paints one wall; a 3-cell drag paints 3', () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const canvas = document.querySelector('canvas')!;
	act(() => void fireEvent.pointerDown(canvas, at(5, 5)));
	act(() => void fireEvent.pointerUp(canvas, at(5, 5)));
	act(() => void fireEvent.mouseUp(window));
	expect(document.getElementById('5-5')!.className).toMatch(/_wall/);
	expect(walls()).toBe(1);
	act(() => void fireEvent.pointerDown(canvas, at(8, 5)));
	act(() => void fireEvent.pointerMove(canvas, at(8, 6)));
	act(() => void fireEvent.pointerMove(canvas, at(8, 7)));
	act(() => void fireEvent.pointerUp(canvas, at(8, 7)));
	act(() => void fireEvent.mouseUp(window));
	expect(['8-5', '8-6', '8-7'].map((id) => /_wall/.test(document.getElementById(id)!.className))).toEqual([true, true, true]);
	expect(walls()).toBe(4);
});
