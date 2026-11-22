// Pins the legacy controller: one cell per tick, Dijkstra->BFS fallback, toast,
// maze builds, and Show Best Path, exactly as TableContext.js plays them today.
import { mountLegacy, drain, withSeededRandom, paintWalls, semantic, act, T } from '../testing/legacyController';
import { FIXTURES } from '../testing/boards';
import { expectGolden } from '../testing/golden';

const ALGOS = ['dijkstra', 'linearSearch', 'breadthFirstSearch', 'depthFirstSearch', 'bidirectionalSearch', 'randomSearch'];
const BOARDS = ['open', 'detour', 'enclosedDuck', 'basic'];

beforeEach(() => {
	T.useFakeTimers();
	localStorage.clear();
});
afterEach(() => {
	T.useRealTimers();
});

describe.each(ALGOS)('legacy controller %s', (algo) => {
	test.each(BOARDS)('%s', (board) => {
		withSeededRandom(7, () => {
			const { ref } = mountLegacy();
			drain(ref); // settle mount-time timers
			paintWalls(FIXTURES[board].walls);
			act(() => ref.ctx.selectAlgorithm({ target: { value: algo } }));
			act(() => ref.ctx.go());
			expectGolden(`controller/${algo}/${board}`, drain(ref));
		});
	});
});

const MAZES = ['basic', 'spiral', 'target', 'stair', 'checker', 'forest', 'horizontal', 'vertical', 'horizontalNarrow', 'verticalNarrow', 'random'];
test.each(MAZES)('legacy maze build %s', (maze) => {
	withSeededRandom(11, () => {
		const { ref } = mountLegacy();
		drain(ref);
		act(() => ref.ctx.buildMaze(maze));
		const { ticks, running } = drain(ref, 5000);
		// walls only: store the ordered wall list (one or more per tick)
		expectGolden(`controller/maze/${maze}`, { ticks: ticks.length, walls: ticks.join(' ').split(' '), running });
	});
});

test('legacy show best path on detour', () => {
	const { ref } = mountLegacy();
	drain(ref);
	paintWalls(FIXTURES.detour.walls);
	act(() => ref.ctx.showBestPath());
	expectGolden('controller/preview/detour', drain(ref));
});

test('legacy theme always starts dark (quirk Q7)', () => {
	localStorage.setItem('dtdTheme', 'light');
	const { ref } = mountLegacy();
	expect(ref.ctx.theme).toBe('dark');
	expect(semantic(document.getElementById('17-15').className)).toBe('dark_starting');
});
