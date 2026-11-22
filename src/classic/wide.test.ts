// @vitest-environment node
// Classic algorithms on boards wider than the 35x80 table (classic/wide.ts):
// Duck 1 about 500 cells away is reached, or the run says plainly why not.
import { CLASSIC_MAX_CELLS, runWide, wideBlock } from './wide';
import { classicFrame, wideJob } from '../shell/window';
import { Board } from '../model/board';
import { LegacyMirror } from '../canvas/mirror';
import { ClassicAlgo } from '../engine/trace';
import { parseId } from '../model/cell';

/** A mirror with no table attached, in free mode (the Arrow and Duck 1 too far apart for one table). */
function freeMirror(start: { r: number; c: number }, end: { r: number; c: number }) {
	const m = new LegacyMirror();
	m.free = { start, end };
	return m;
}
function job(algo: ClassicAlgo, board: Board, m: LegacyMirror) {
	const f = classicFrame(board, m);
	if (f.kind !== 'wide') throw new Error('expected a wide frame');
	return { f, job: wideJob(algo, board, m, f.bounds) };
}

describe('Duck 1 500 cells east of the Arrow (43 x 533 cells: content + 16)', () => {
	const board = new Board();
	for (let r = -5; r <= 5; r++) board.set(r, 250, { kind: 'wall' }); // a wall across the middle to go round
	const m = freeMirror({ r: 0, c: 0 }, { r: 0, c: 500 });
	test.each(['breadthFirstSearch', 'depthFirstSearch', 'bidirectionalSearch'] as ClassicAlgo[])('%s reaches it', (algo) => {
		const { f, job: j } = job(algo, board, m);
		expect([f.rows, f.cols]).toEqual([43, 533]);
		const res = runWide(j);
		if (!res.ok) throw new Error(res.reason);
		expect(res.trace.result.found).toBe(true);
		expect(res.trace.result.path[0]).toBe('0-0');
		expect(res.trace.result.path.at(-1)).toBe('0-500'); // world ids
		expect(res.trace.result.pathCost).toBe(512); // 500 east + round the wall: 6 up and 6 back down
		// no visit lands on a wall
		const visited = res.trace.events.filter((e) => e.action === 'visit').map((e) => parseId(e.node));
		expect(visited.some((q) => board.get(q.r, q.c)?.kind === 'wall')).toBe(false);
	});
	test.each(['linearSearch', 'randomSearch'] as ClassicAlgo[])('%s reaches it, or says it ran out of stack', (algo) => {
		const res = runWide({ ...job(algo, board, m).job, seed: 7 });
		if (res.ok) expect(res.trace.result.found).toBe(true);
		else expect(res.reason).toMatch(/one nested call per step in the classic code, and ran out of stack on this 43 × 533 board\. Try Depth First Search or A\*/);
	});
	test('dijkstra says its helper is fixed to 35 x 80', () => {
		const res = runWide(job('dijkstra', board, m).job);
		expect(res.ok).toBe(false);
		expect(!res.ok && res.reason).toBe('Classic Dijkstra is written for a 35 × 80 grid, and this board needs 43 × 533. Try Dijkstra · weighted or A*.');
	});
});

test('Duck 1 500 cells away on the diagonal (533 x 533 = 284,089 cells) is under the limit: BFS reaches it', () => {
	const m = freeMirror({ r: 0, c: 0 }, { r: 500, c: 500 });
	const { f, job: j } = job('breadthFirstSearch', new Board(), m);
	expect(f.rows * f.cols).toBe(284_089);
	expect(f.rows * f.cols).toBeLessThanOrEqual(CLASSIC_MAX_CELLS);
	const res = runWide(j);
	if (!res.ok) throw new Error(res.reason);
	expect(res.trace.result.found).toBe(true);
	expect(res.trace.result.pathCost).toBe(1000);
});

test('past the limit every classic algorithm gets the same plain message, before anything runs', () => {
	const m = freeMirror({ r: 0, c: 0 }, { r: 600, c: 600 });
	const { f, job: j } = job('breadthFirstSearch', new Board(), m);
	expect(f.rows * f.cols).toBe(633 * 633);
	const msg = 'Board too large for the classic algorithms: 633 × 633 = 400,689 cells (limit 300,000). Try A*.';
	expect(wideBlock('breadthFirstSearch', f.rows, f.cols)).toBe(msg);
	const res = runWide(j);
	expect(!res.ok && res.reason).toBe(msg);
	expect(wideBlock('linearSearch', 633, 633)).toBe(msg);
});

describe('classicFrame: the table and its framing stay exactly as before whenever everything fits 35 x 80', () => {
	const tableMirror = () => {
		const m = new LegacyMirror();
		m.start = 17 * 80 + 15;
		m.end = 17 * 80 + 64;
		return m;
	};
	test('the default board runs on the table at origin (0, 0)', () => {
		expect(classicFrame(new Board(), tableMirror())).toEqual({ kind: 'table', origin: { r: 0, c: 0 } });
	});
	test('a wall just below the old window: the 35x80 window moves to cover it', () => {
		const b = new Board();
		b.set(40, 20, { kind: 'wall' });
		expect(classicFrame(b, tableMirror())).toEqual({ kind: 'table', origin: { r: 12, c: 0 } });
	});
	test('a weight 100 rows down: too tall for 35 rows, so the run goes wide (content + 16)', () => {
		const b = new Board();
		b.set(117, 20, { kind: 'weight', cost: 5 });
		expect(classicFrame(b, tableMirror())).toEqual({ kind: 'wide', bounds: { r0: 1, c0: -1, r1: 133, c1: 80 }, rows: 133, cols: 82 });
	});
});

test('wideJob writes table walls, board walls, the Arrow and Duck 1 at their local cells', () => {
	const m = new LegacyMirror();
	m.start = 17 * 80 + 15;
	m.end = 17 * 80 + 64;
	m.kind[3 * 80 + 4] = 1; // a table wall at world (3, 4)
	const b = new Board();
	b.set(-50, 4, { kind: 'wall' });
	const f = classicFrame(b, m);
	if (f.kind !== 'wide') throw new Error('expected wide');
	const j = wideJob('breadthFirstSearch', b, m, f.bounds);
	const at = (r: number, c: number) => j.classes[(r - f.bounds.r0) * j.cols + (c - f.bounds.c0)];
	expect(at(3, 4)).toBe('light_wall');
	expect(at(-50, 4)).toBe('light_wall');
	expect(at(17, 15)).toBe('light_starting');
	expect(at(17, 64)).toBe('light_ending');
	expect(j.starting).toBe(`${17 - f.bounds.r0}-${15 - f.bounds.c0}`);
	expect(j.origin).toEqual({ r: f.bounds.r0, c: f.bounds.c0 });
});
