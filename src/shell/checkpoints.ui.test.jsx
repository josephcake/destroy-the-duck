// Weights are checkpoints (Joseph, 2026-11-22): the tool says so, the run visits
// every one in the shortest order, the pill counts them and tells the story, and
// a checkpoint out of reach is a no-path. Classic runs chain per leg (classicTour.ts).
import { fireEvent, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { mountLegacy, drain, act, T } from '../testing/legacyController';
import { CHECKPOINT } from '../story';

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
const flush = async (ref) => {
	for (let i = 0; i < 400; i++) {
		await act(async () => {
			await Promise.resolve();
			T.advanceTimersByTime(50);
		});
		drain(ref);
		if (screen.queryByTestId('story-line')) return;
	}
};

beforeEach(() => {
	T.useFakeTimers();
	localStorage.clear();
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ chrome: 'light', cells: 'paper', speed: 'fast' }));
});
afterEach(() => T.useRealTimers());

const place = (cells) => {
	const canvas = document.querySelector('canvas');
	act(() => fireEvent.click(screen.getByTitle(/^Checkpoint \(G\)/)));
	for (const [r, c] of cells) click(canvas, r, c);
	act(() => T.advanceTimersByTime(32));
	return canvas;
};
const pick = (name) => {
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name })[0]));
};

test.each([
	['A*', /^A\*/],
	['classic Breadth First Search', /^Breadth First Search/],
	['classic Depth First Search', /^Depth First Search/],
])('%s visits all 3 checkpoints, then Quack', async (_, name) => {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	pick(name);
	place([[5, 30], [25, 40], [10, 55]]);
	expect(screen.getByTestId('checkpoint-chip').textContent).toBe('3 checkpoints before Quack, shortest order');
	act(() => fireEvent.click(screen.getByTestId('go')));
	await flush(ref);
	expect(screen.getByTestId('checkpoint-count').textContent).toBe('checkpoints 3/3');
	expect(CHECKPOINT.found).toContain(screen.getByTestId('story-line').textContent);
	expect(screen.getByTestId('story-line').closest('.pill').getAttribute('data-outcome')).toBe('found');
});

test.each([
	['A*', /^A\*/],
	['classic Breadth First Search', /^Breadth First Search/],
])('%s, a walled-off checkpoint: red no-path naming the checkpoint, no second toast', async (_, name) => {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	pick(name);
	const canvas = place([[5, 30]]);
	act(() => fireEvent.click(screen.getByTitle('Wall (W)')));
	for (const [r, c] of [[4, 30], [6, 30], [5, 29], [5, 31]]) {
		click(canvas, r, c);
		act(() => T.advanceTimersByTime(32));
		drain(ref);
	}
	for (const id of ['4-30', '6-30', '5-29', '5-31']) expect(document.getElementById(id).className).toMatch(/_wall/);
	await act(async () => {}); // the mirror reads table classes in a MutationObserver (a microtask)
	act(() => fireEvent.click(screen.getByTestId('go')));
	await flush(ref);
	expect(screen.getByTestId('checkpoint-count').textContent).toBe('checkpoints 0/1');
	expect(CHECKPOINT.blocked.map((l) => l.replace('{n}', '1'))).toContain(screen.getByTestId('story-line').textContent);
	expect(screen.getByTestId('story-line').closest('.pill').getAttribute('data-outcome')).toBe('escaped');
	await act(async () => void T.advanceTimersByTime(500));
	expect(screen.queryByText('Cannot find Quack!')).toBeNull(); // the pill already says it (gate nit)
});

test('first run: one yellow button at a time — Go is a plain tab until an algorithm is picked', () => {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	expect(screen.getByTestId('landing')).toBeTruthy();
	const yellow = () => [...document.querySelectorAll('button.go')].filter((b) => !b.classList.contains('go--quiet'));
	expect(yellow().map((b) => b.textContent)).toEqual(['Pick an algorithm']);
	pick(/^A\*/);
	expect(screen.getByTestId('go').classList.contains('go--quiet')).toBe(false);
});
