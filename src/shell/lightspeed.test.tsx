// Prism gate must-fix 1: a traced run at Light speed records its cells (dashes and
// frontier), not only the path. The Light loop used to advance the trace itself
// and then seek() to where it already was, so recordEvents never ran.
import { linesFor } from '../story';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
// @ts-expect-error legacy JS module
import { TableContextProvider } from '../Context/TableContext';
import type { CellAnim } from '../canvas/cellAnim';
import AppShell from './AppShell';

const made: CellAnim[] = [];
vi.mock('../canvas/cellAnim', async (orig) => {
	const m = await orig<typeof import('../canvas/cellAnim')>();
	class Recorded extends m.CellAnim {
		constructor() {
			super();
			made.push(this);
		}
	}
	return { ...m, CellAnim: Recorded };
});

test('Light speed: a traced A* run ends with settled cells in the motion layer', async () => {
	localStorage.clear();
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ chrome: 'light', cells: 'paper', speed: 'light' }));
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	await act(() => new Promise((r) => setTimeout(r, 20)));
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getByRole('option', { name: /^A\*/ }));
	fireEvent.click(screen.getByTestId('go'));
	const tick = () => act(() => new Promise((r) => setTimeout(r, 20)));
	for (let i = 0; i < 50 && /Go!/.test(screen.getByTestId('go').textContent ?? ''); i++) await tick();
	for (let i = 0; i < 400 && !/Go!/.test(screen.getByTestId('go').textContent ?? ''); i++) await act(() => new Promise((r) => setTimeout(r, 20)));
	await act(() => new Promise((r) => setTimeout(r, 50)));
	expect(screen.getByTestId('go').textContent).toMatch(/Go!/);
	// the traced run's layer (the mirror owns another one, for classic runs)
	const most = Math.max(...made.map((a) => a.settledCount + a.liveCount));
	expect(most).toBeGreaterThan(40); // Arrow and Duck are 49 columns apart: the visited cells are in the layer
	// the story: the pill tells how A* found Quack (story.ts), without blocking play
	expect(linesFor('astar', 'found')).toContain(screen.getByTestId('story-line').textContent);
	expect(screen.getByTestId('story-line').closest('.pill')!.getAttribute('data-outcome')).toBe('found'); // not red
	expect((screen.getByTestId('go') as HTMLButtonElement).disabled).toBe(false);
	localStorage.clear();
});
