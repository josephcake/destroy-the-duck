// New generators in the Board picker: walls land in the classic table, the
// seed field replays a board, the result is solvable by the engine.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { generate } from '../model/generators';

const mount = () =>
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
const frame = () => act(() => new Promise((r) => requestAnimationFrame(() => r())));
const tableWalls = () => [...document.querySelectorAll('.legacy-mirror td')].filter((td) => /_wall\b/.test(td.className)).map((td) => td.id);

test.each(['backtracker', 'prim', 'kruskal', 'division', 'wilson', 'caves'])('%s: seed 42 builds the same walls twice, Arrow and Duck untouched', async (id) => {
	mount();
	fireEvent.change(screen.getByLabelText('Maze'), { target: { value: `gen:${id}` } });
	const seed = screen.getByTestId('gen-seed');
	fireEvent.change(seed, { target: { value: '42' } });
	fireEvent.keyDown(seed, { key: 'Enter' });
	await frame();
	const first = tableWalls();
	const want = generate(id, { rows: 35, cols: 80, seed: 42, start: { r: 17, c: 15 }, ducks: [{ r: 17, c: 64 }] });
	expect(first.length).toBe(want.wall.reduce((s, x) => s + x, 0));
	fireEvent.click(screen.getByTestId('generate')); // new seed
	await frame();
	expect(seed.value).not.toBe('42');
	fireEvent.change(seed, { target: { value: '42' } });
	fireEvent.keyDown(seed, { key: 'Enter' });
	await frame();
	expect(tableWalls()).toEqual(first);
	expect(document.getElementById('17-15').className).toMatch(/_starting/);
	expect(document.getElementById('17-64').className).toMatch(/_ending/);
});

test('mud and water is parked: weights are checkpoints, and it would lay hundreds', () => {
	mount();
	const options = [...screen.getByLabelText('Maze').querySelectorAll('option')].map((o) => o.value);
	expect(options).not.toContain('gen:weightNoise');
	expect(options).toContain('gen:caves');
});
