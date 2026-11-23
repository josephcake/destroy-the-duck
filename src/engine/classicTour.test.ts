// The classic algorithms through checkpoints: each segment is an unchanged
// classic run on the shim, chained in the planned order (classicTour.ts).
import { idOf, parseId } from '../model/cell';
import { ClassicAlgo } from './trace';
import { TourJob, runClassicTour } from './classicTour';

/** A job from level text: '#' wall, 'S' Arrow, 'D' Quack, '*' checkpoint; padded to rows x cols with open cells. */
function job(algo: ClassicAlgo, text: string[], rows = text.length, cols = text[0].length): TourJob {
	const classes: string[] = [];
	const checkpoints: string[] = [];
	let starting = '';
	let ending = '';
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			const ch = text[r]?.[c] ?? '.';
			if (ch === 'S') starting = idOf(r, c);
			if (ch === 'D') ending = idOf(r, c);
			if (ch === '*') checkpoints.push(idOf(r, c));
			classes.push(ch === 'S' ? 'light_starting' : ch === 'D' ? 'light_ending' : ch === '#' ? 'light_wall' : 'light_unvisited');
		}
	return { algo, classes, cols, starting, ending, origin: { r: 10, c: 20 }, seed: 7, checkpoints };
}
const shift = (id: string) => {
	const q = parseId(id);
	return idOf(q.r + 10, q.c + 20);
};

const ORDER = ['.......*..', '*.S......D', '..........']; // (1,0) first: 13; reading order (0,7) first: 23
const ALGOS: ClassicAlgo[] = ['breadthFirstSearch', 'depthFirstSearch', 'bidirectionalSearch', 'linearSearch', 'randomSearch'];

describe.each(ALGOS)('%s through checkpoints', (algo) => {
	test('runs one classic search per segment, in the planned order, and one gold path', () => {
		const res = runClassicTour(job(algo, ORDER));
		if (!res.ok) throw new Error(res.reason);
		const { result, events } = res.trace;
		expect(result.checkpoints).toEqual({ order: [shift('1-0'), shift('0-7')], method: 'exact', reached: 2 });
		expect(result.found).toBe(true);
		const legs = events.filter((e) => e.action === 'leg');
		expect(legs.map((e) => e.params?.to)).toEqual([shift('1-0'), shift('0-7'), shift('1-9')]);
		expect(result.path[0]).toBe(shift('1-2'));
		expect(result.path.at(-1)).toBe(shift('1-9'));
		const at = (id: string) => result.path.indexOf(id);
		expect(at(shift('1-0'))).toBeGreaterThan(0);
		expect(at(shift('0-7'))).toBeGreaterThan(at(shift('1-0')));
		for (let i = 1; i < result.path.length; i++) {
			const a = parseId(result.path[i - 1]);
			const b = parseId(result.path[i]);
			expect(Math.abs(a.r - b.r) + Math.abs(a.c - b.c)).toBe(1);
		}
		expect(result.paths).toHaveLength(1);
		expect(events.at(-1)!.reason).toBe('CLASSIC_DONE');
		// steps never go backwards
		for (let i = 1; i < events.length; i++) expect(events[i].step).toBeGreaterThanOrEqual(events[i - 1].step);
	});
	test('an unreachable checkpoint is a no-path', () => {
		const res = runClassicTour(job(algo, ['S*..#*', '....##', '.....D']));
		if (!res.ok) throw new Error(res.reason);
		expect(res.trace.result.found).toBe(false);
		expect(res.trace.result.path).toEqual([]);
		expect(res.trace.result.checkpoints!.order.at(-1)).toBe(shift('0-5'));
		expect(res.trace.events.at(-1)!.reason).toBe('NOT_FOUND');
	});
});

test.each(['breadthFirstSearch', 'depthFirstSearch'] as ClassicAlgo[])('%s: the chained run finds Quack, BFS with the shortest route', (algo) => {
	const res = runClassicTour(job(algo, ORDER));
	if (!res.ok) throw new Error(res.reason);
	expect(res.trace.result.found).toBe(true);
	expect(res.trace.result.checkpoints!.reached).toBe(2);
	// the gold path is the shortest walk per segment (as Show Best Path draws it): 2 + 8 + 3
	expect(res.trace.result.pathCost).toBe(13);
});

test('classic Dijkstra chains on its 35 x 80 grid', () => {
	const res = runClassicTour(job('dijkstra', ORDER, 35, 80));
	if (!res.ok) throw new Error(res.reason);
	expect(res.trace.result.found).toBe(true);
	expect(res.trace.result.pathCost).toBe(13);
	expect(res.trace.events.filter((e) => e.action === 'leg')).toHaveLength(3);
});

test('classic Dijkstra off its 35 x 80 grid says why, as a plain wide run does', () => {
	const res = runClassicTour(job('dijkstra', ORDER));
	expect(res.ok).toBe(false);
});
