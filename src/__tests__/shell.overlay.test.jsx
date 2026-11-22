// Mochi re-test fixes 1 and 2, at the new UI's default speed (Fast).
// Root cause for both: the shell's first setSpeed copied a stale state that
// rolled the legacy theme back, so clearBoard('visited') matched no cells.
import { fireEvent, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from '../shell/AppShell';
import { mountLegacy, drain, act, T } from '../testing/legacyController';

const Shell = ({ children }) => (
	<TableContextProvider>
		<AppShell />
		{children}
	</TableContextProvider>
);
const stat = (name) => {
	const el = [...screen.getByTestId('stats').querySelectorAll('.stat')].find((s) => s.textContent.endsWith(name));
	return el.querySelector('b').textContent;
};
const visitedCells = () => document.querySelectorAll('.legacy-mirror td[class*="_visited"]').length;

beforeEach(() => {
	T.useFakeTimers();
	localStorage.clear(); // default prefs: Fast, so the shell calls setSpeed on mount
});
afterEach(() => T.useRealTimers());

function runBfs() {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	expect(ref.ctx.speedText).toBe('fast');
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name: /^Breadth First Search/ })[0]));
	act(() => fireEvent.click(screen.getByTestId('go')));
	drain(ref);
	act(() => T.runOnlyPendingTimers());
	expect(visitedCells()).toBeGreaterThan(1000);
	return ref;
}

test('setSpeed keeps the theme the cells were painted with', () => {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	const theme = document.getElementById('17-15').className.match(/(\w+)_starting/)[1];
	act(() => ref.ctx.setSpeed({ currentTarget: { attributes: { name: { value: 'slow' } } } }));
	act(() => ref.ctx.setSpeed({ currentTarget: { attributes: { name: { value: 'fast' } } } }));
	expect(ref.ctx.theme).toBe(theme);
});

test('fix 1: starting a step-through clears the previous classic run', async () => {
	runBfs();
	act(() => fireEvent.click(screen.getByRole('tab', { name: 'Learn' })));
	T.useRealTimers();
	await act(async () => fireEvent.click(screen.getByTestId('learn-start')));
	await act(() => new Promise((r) => setTimeout(r, 50)));
	expect(visitedCells()).toBe(0);
	expect(screen.getByTestId('step-count').textContent).toMatch(/^0 \//);
});

test('fix 2: Reset clears visited cells, the path and the Visited count, and keeps walls and weights', () => {
	const ref = runBfs();
	expect(stat('Path')).not.toBe('–');
	const wall = document.getElementById('3-3');
	act(() => void (wall.className = wall.className.replace('visited', 'wall').replace('unvisited', 'wall')));
	act(() => fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true })));
	drain(ref);
	act(() => T.runOnlyPendingTimers());
	expect(visitedCells()).toBe(0);
	expect(stat('Visited')).toBe('0');
	expect(stat('Path')).toBe('–');
	expect(stat('Cost')).toBe('–');
	expect(wall.className).toMatch(/_wall/);
});
