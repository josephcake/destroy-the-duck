// Pins the exact output of the six classic helpers (unmodified files) on fixed boards.
import { spreadHelper } from '../Context/algorithms/spreadHelper';
import { dijkstraHelper } from '../Context/algorithms/dijkstraHelper';
import { bidirectionalSpreadHelper } from '../Context/algorithms/bidirectionalSpreadHelper';
import { linearSearchHelper } from '../Context/algorithms/linearSearchHelper';
import { randomHelper } from '../Context/algorithms/randomHelper';
import { buildLegacyDom, mulberry32 } from '../testing/legacyDom';
import { FIXTURES } from '../testing/boards';
import { expectGolden } from '../testing/golden';

const RUNS = {
	dijkstra: ({ starting, ending }) => dijkstraHelper(starting, ending),
	breadthFirstSearch: ({ starting, ending }) => spreadHelper(starting, ending),
	depthFirstSearch: ({ starting, ending }) => spreadHelper(ending, starting),
	bidirectionalSearch: ({ starting, ending }) => bidirectionalSpreadHelper(starting, ending),
	linearSearch: ({ starting }) => linearSearchHelper(starting),
	randomSearch: ({ starting, ending }) => {
		const original = Math.random;
		Math.random = mulberry32(42);
		try {
			return randomHelper(starting, ending);
		} finally {
			Math.random = original;
		}
	},
};

describe.each(Object.keys(RUNS))('classic helper %s', (algo) => {
	test.each(Object.keys(FIXTURES))('%s', (fixture) => {
		buildLegacyDom(FIXTURES[fixture]);
		expectGolden(`classic/${algo}/${fixture}`, RUNS[algo](FIXTURES[fixture]));
	});
});
