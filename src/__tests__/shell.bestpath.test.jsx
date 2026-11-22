// Fix 5 + 9: after a classic run the new UI fills Path / Cost and draws the
// best path as an overlay (no table writes, so visit order is unchanged);
// Reset clears both that overlay and a Show Best Path preview.
import { fireEvent, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from '../shell/AppShell';
import { mountLegacy, drain, act, T } from '../testing/legacyController';
import { expectGolden } from '../testing/golden';
import fs from 'fs';

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

beforeEach(() => {
	T.useFakeTimers();
	localStorage.clear();
	// The goldens were recorded at the classic default speed (Norm); tick
	// grouping under fake timers depends on it. Visit order does not (see
	// shell.bestpath 'default speed' test).
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ speed: 'norm' }));
});
afterEach(() => T.useRealTimers());

function runBfs() {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name: /^Breadth First Search/ })[0]));
	act(() => fireEvent.click(screen.getByTestId('go')));
	const run = drain(ref);
	act(() => T.runOnlyPendingTimers()); // let React flush the effect
	return { ref, run };
}

test('classic BFS: same ticks as before, then Path / Cost filled from the best path', () => {
	const { run } = runBfs();
	expectGolden('controller/breadthFirstSearch/open', run); // visit order unchanged
	expect(stat('Path')).toBe('50');
	expect(stat('Cost')).toBe('49');
	expect(document.querySelectorAll('.legacy-mirror td.preview')).toHaveLength(0); // overlay only
});

test('Reset clears the overlay and a Show Best Path preview', () => {
	const { ref } = runBfs();
	act(() => fireEvent.click(screen.getByRole('button', { name: 'Show Best Path' })));
	drain(ref);
	expect(document.querySelectorAll('.legacy-mirror td.preview').length).toBeGreaterThan(0);
	act(() => fireEvent.click(screen.getByRole('button', { name: 'Reset' })));
	drain(ref);
	expect(document.querySelectorAll('.legacy-mirror td.preview')).toHaveLength(0);
	expect(document.querySelectorAll('.legacy-mirror td[class*="_visited"]')).toHaveLength(0);
	expect(stat('Path')).toBe('–');
	expect(stat('Cost')).toBe('–');
});

test('no best path (and no stats) when the duck cannot be reached', () => {
	const { ref } = mountLegacy(Shell);
	drain(ref);
	for (const id of ['16-64', '18-64', '17-63', '17-65']) document.getElementById(id).className = 'dark_wall';
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name: /^Breadth First Search/ })[0]));
	act(() => fireEvent.click(screen.getByTestId('go')));
	drain(ref);
	act(() => T.runOnlyPendingTimers());
	expect(stat('Path')).toBe('–');
});

test('at the new default speed (Fast) the visit order is the same as the golden', () => {
	localStorage.clear();
	const { run } = runBfs();
	const golden = JSON.parse(fs.readFileSync('src/__tests__/golden/controller/breadthFirstSearch/open.json', 'utf8'));
	const flat = (ticks) => ticks.join(' ').split(' ');
	expect(flat(run.ticks)).toEqual(flat(golden.ticks));
	expect(screen.getByRole('group', { name: 'Speed' }).querySelector('[aria-pressed="true"]').textContent).toBe('Fast');
});
