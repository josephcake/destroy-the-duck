// Mochi check 3: a Weight click during a run was dropped silently and left
// only the hover ring (a "white outlined box"). Now it says why, and a click
// after the run paints the same tan tile as a drag.
import { fireEvent, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { mountLegacy, drain, act, T } from '../testing/legacyController';

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
const weightChip = () => screen.queryByText(/ignores weights \((\d+) cells\)/)?.textContent ?? null;

beforeEach(() => {
	T.useFakeTimers();
	localStorage.clear();
});
afterEach(() => T.useRealTimers());

test('Weight click while a search runs: refused out loud; after the run: one tile, same as a drag', () => {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name: /^Breadth First Search/ })[0]));
	const canvas = document.querySelector('canvas');
	act(() => fireEvent.click(screen.getByTitle('Weight (G)')));
	act(() => fireEvent.click(screen.getByTestId('go')));
	expect(ref.ctx.running).toBe(true);
	expect(canvas.style.cursor).toBe('not-allowed');
	click(canvas, 5, 5);
	expect(screen.getByTestId('locked-toast').textContent).toMatch(/locked while the search runs/);
	act(() => T.advanceTimersByTime(16));
	expect(weightChip()).toBeNull(); // nothing painted
	drain(ref);
	act(() => T.runOnlyPendingTimers());
	expect(ref.ctx.running).toBe(false);
	expect(canvas.style.cursor).toBe('crosshair');
	click(canvas, 5, 5); // single click
	act(() => void fireEvent.pointerDown(canvas, at(8, 5))); // drag over two cells
	act(() => void fireEvent.pointerMove(canvas, at(8, 6)));
	act(() => void fireEvent.pointerUp(canvas, at(8, 6)));
	act(() => T.advanceTimersByTime(32));
	expect(weightChip()).toBe('Breadth First Search ignores weights (3 cells)');
	// Reset keeps every weight, clicked or dragged
	act(() => fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true })));
	act(() => T.advanceTimersByTime(32));
	expect(weightChip()).toBe('Breadth First Search ignores weights (3 cells)');
});
