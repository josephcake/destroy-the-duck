// @vitest-environment node
// Phase B: the classic helpers run against the document stand-in (no DOM at
// all here) and must reproduce every helper golden recorded from the real
// table, and their replay traces must tick exactly like the classic player.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES } from '../testing/boards';
import { expectGolden } from '../testing/golden';
import { runClassic, runHelper } from '../classic/run';
import { classicTrace } from '../classic/replay';
import { makeDocument, withDocument, ROWS, COLS } from '../classic/shim';

const ALGOS = ['dijkstra', 'breadthFirstSearch', 'depthFirstSearch', 'bidirectionalSearch', 'linearSearch', 'randomSearch'];

function classesOf({ starting, ending, walls }, theme) {
	const wallSet = new Set(walls);
	const out = [];
	for (let r = 0; r < ROWS; r++)
		for (let c = 0; c < COLS; c++) {
			const id = `${r}-${c}`;
			const s = id === ending ? 'ending' : id === starting ? 'starting' : wallSet.has(id) ? 'wall' : 'unvisited';
			out.push(`${theme}_${s}`);
		}
	return out;
}
const inputOf = (f, theme, seed) => ({ classes: classesOf(f, theme), starting: f.starting, ending: f.ending, seed });

test('there is no DOM in this file', () => {
	expect(typeof globalThis.document).toBe('undefined');
});

test('the shim answers getElementById like the browser (exact ids, null outside Home)', () => {
	const doc = makeDocument(classesOf(FIXTURES.open, 'light'));
	expect(doc.getElementById('17-15').className).toBe('light_starting');
	for (const bad of ['-1-0', '0--1', '35-0', '0-80', '03-4', 'undefined']) expect(doc.getElementById(bad)).toBeNull();
	expect(doc.querySelectorAll('td')).toHaveLength(2800);
	expect(() => doc.querySelectorAll('div')).toThrow();
});

describe.each(ALGOS)('classic helper %s through the document stand-in', (algo) => {
	test.each(Object.keys(FIXTURES))('%s matches the real-table golden', (name) => {
		const input = inputOf(FIXTURES[name], 'light', algo === 'randomSearch' ? 42 : undefined);
		const out = withDocument(makeDocument(input.classes), () => runHelper(algo, input));
		expectGolden(`classic/${algo}/${name}`, out);
	});
});

// The controller goldens record every class write per tick ("id>dark_visited").
function ticksOf(algo, f, seed) {
	const input = inputOf(f, 'dark', seed);
	const trace = classicTrace(algo, runClassic(algo, input), input);
	const cls = new Map(input.classes.map((c, i) => [`${Math.floor(i / COLS)}-${i % COLS}`, c]));
	const ticks = [];
	for (let s = 1; s <= trace.steps; s++) {
		const seen = [];
		for (const e of trace.events) {
			if (e.step !== s || e.action !== 'visit' || seen.includes(e.node)) continue;
			seen.push(e.node);
			cls.set(e.node, cls.get(e.node).replace('unvisited', 'visited'));
		}
		if (seen.length) ticks.push(seen.map((id) => `${id}>${cls.get(id)}`).join(' '));
	}
	return { ticks, found: trace.result.found };
}

describe.each(ALGOS)('classic %s replay trace ticks like the classic player', (algo) => {
	test.each(['open', 'detour', 'enclosedDuck', 'basic'])('%s', (name) => {
		const golden = JSON.parse(readFileSync(path.resolve(`src/__tests__/golden/controller/${algo}/${name}.json`), 'utf8'));
		const { ticks, found } = ticksOf(algo, FIXTURES[name], algo === 'randomSearch' ? 7 : undefined);
		expect(ticks).toEqual(golden.ticks);
		expect(found).toBe(!golden.toastSeen);
	});
});

// Phase B promise: the classic algorithm files are byte-identical to fea19c8.
const PINNED = {
	bidirectionalSpreadHelper: '49e41481eae761627c1f6fcce30f5b10adb28947a05b242cbc3c84cbb83717c5',
	checkValidCellsHelper: 'c482db49a6232fc9a6affafc9fd828c1931241cca6926c6d3aa0beda173e3bac',
	dijkstraHelper: '18f166f01b45438f4801c6e0a441407c72188c14c2e4cd82bca99cf194bd6b84',
	linearSearchHelper: 'ae942c9836ac32e566a7b76b63e5bcaf8a97f5f44a06b39e36af3e26534e1e6f',
	randomHelper: '92d2a4f2f8d038e16000df3c7391e4d57a7eeb703e126dcd3ce0526a277ddeff',
	spreadHelper: '293bb296745789351fd2c9125e0fb295d9450d466c35b0facc7d42b08d88f897',
};
test.each(Object.entries(PINNED))('%s.js is byte-identical to fea19c8', (name, sha) => {
	const bytes = readFileSync(path.resolve(`src/Context/algorithms/${name}.js`));
	expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha);
});
