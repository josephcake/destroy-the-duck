// Mochi fix 4 / check 3: Fast paints FAST_CELLS (12) a tick (Light 40). Visit order is the
// Norm golden's; only the tick grouping changes. Classic runs fill the ms stat.
import { fireEvent, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from '../shell/AppShell';
import { FAST_CELLS } from '../lib/speed';
import { mountLegacy, drain, act, T } from '../testing/legacyController';

const Shell = ({ children }) => (
	<TableContextProvider>
		<AppShell />
		{children}
	</TableContextProvider>
);
const golden = (name) => JSON.parse(fs.readFileSync(path.resolve(process.cwd(), `src/__tests__/golden/controller/${name}.json`), 'utf8'));
// Visited writes only: no-op rewrites of the Arrow's class collapse within a tick.
const flat = (ticks) => ticks.flatMap((t) => t.split(' ')).filter((c) => c.endsWith('_visited'));
const stat = (name) => [...screen.getByTestId('stats').querySelectorAll('.stat')].find((s) => s.textContent.endsWith(name)).querySelector('b').textContent;

beforeEach(() => T.useFakeTimers());
afterEach(() => T.useRealTimers());

test.each([
	['fast', FAST_CELLS, 'breadthFirstSearch', /^Breadth First Search/],
	['fast', FAST_CELLS, 'dijkstra', /^Dijkstra/],
	['light', 40, 'breadthFirstSearch', /^Breadth First Search/],
])('%s: %s cells a tick, same visit order as the Norm golden (%s)', (speed, perTick, algo, re) => {
	localStorage.clear();
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ speed }));
	const { ref } = mountLegacy(Shell);
	drain(ref);
	expect(ref.ctx.speedText).toBe(speed);
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name: re })[0]));
	act(() => fireEvent.click(screen.getByTestId('go')));
	const run = drain(ref);
	act(() => T.runOnlyPendingTimers());
	const norm = golden(`${algo}/open`);
	expect(flat(run.ticks)).toEqual(flat(norm.ticks));
	expect(run.ticks.length).toBeLessThanOrEqual(Math.ceil(norm.ticks.length / perTick) + 2);
	// BFS on the open 35x80 board: ~1,970 cells; 10 ms ticks -> under 2 s of ticks.
	if (speed === 'fast') expect(run.ticks.length * 10).toBeLessThan(2000);
	expect(stat('ms')).toMatch(/^\d+$/);
});

test('Fast: BFS on the classic Basic maze stays in Norm golden order and needs ~1.3 s of 10 ms ticks', () => {
	expect(FAST_CELLS).toBe(12);
	localStorage.clear();
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ speed: 'fast' }));
	const { ref } = mountLegacy(Shell);
	drain(ref);
	act(() => fireEvent.change(screen.getByLabelText('Maze'), { target: { value: 'basic' } }));
	act(() => fireEvent.click(screen.getByTestId('generate')));
	drain(ref);
	act(() => T.runOnlyPendingTimers());
	act(() => fireEvent.click(screen.getByTestId('algo-picker')));
	act(() => fireEvent.click(screen.getAllByRole('option', { name: /^Breadth First Search/ })[0]));
	act(() => fireEvent.click(screen.getByTestId('go')));
	const run = drain(ref);
	const norm = golden('breadthFirstSearch/basic');
	expect(flat(run.ticks)).toEqual(flat(norm.ticks));
	const ticks = run.ticks.length;
	expect(ticks).toBeLessThanOrEqual(Math.ceil(norm.ticks.length / FAST_CELLS) + 2);
	expect(ticks * 10).toBeLessThan(2000);
});
