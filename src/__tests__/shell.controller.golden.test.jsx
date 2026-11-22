// The new shell must drive the classic six exactly as before: same goldens,
// triggered through the shell's own controls instead of the context directly.
import { fireEvent, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from '../shell/AppShell';
import { mountLegacy, drain, withSeededRandom, paintWalls, act, T } from '../testing/legacyController';
import { FIXTURES } from '../testing/boards';
import { expectGolden } from '../testing/golden';
import { CLASSIC } from '../shell/legacy';

const Shell = ({ children }) => (
	<TableContextProvider>
		<AppShell />
		{children}
	</TableContextProvider>
);
const BOARDS = ['open', 'detour', 'enclosedDuck', 'basic'];

beforeEach(() => {
	T.useFakeTimers();
	localStorage.clear();
	// The goldens were recorded at the classic default speed (Norm); tick
	// grouping under fake timers depends on it. Visit order does not (see
	// shell.bestpath 'default speed' test).
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ speed: 'norm' }));
});
afterEach(() => T.useRealTimers());

describe.each(CLASSIC.map((a) => [a.id, a.label]))('shell drives classic %s', (algo, label) => {
	test.each(BOARDS)('%s', (board) => {
		withSeededRandom(7, () => {
			const { ref } = mountLegacy(Shell);
			drain(ref);
			paintWalls(FIXTURES[board].walls);
			act(() => fireEvent.click(screen.getByTestId('algo-picker')));
			act(() => fireEvent.click(screen.getAllByRole('option', { name: new RegExp(`^${label}`) })[0]));
			act(() => fireEvent.click(screen.getByTestId('go')));
			expectGolden(`controller/${algo}/${board}`, drain(ref));
		});
	});
});

test('shell Generate builds the same maze as the classic select', () => {
	withSeededRandom(11, () => {
		const { ref } = mountLegacy(Shell);
		drain(ref);
		act(() => fireEvent.change(screen.getByLabelText('Maze'), { target: { value: 'spiral' } }));
		act(() => fireEvent.click(screen.getByTestId('generate')));
		const { ticks, running } = drain(ref, 5000);
		expectGolden('controller/maze/spiral', { ticks: ticks.length, walls: ticks.join(' ').split(' '), running });
	});
});
