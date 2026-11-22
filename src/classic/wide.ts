// The classic algorithms on boards that don't fit the 35x80 table. The same
// helper files (byte-identical) run against a shim document of R x C cells
// built from the world, off the main thread, and the result plays back as a
// trace on the canvas (replay.ts turns helper output into the classic
// player's ticks; the shim tests pin that against the controller goldens).
//
// Limits, all said on screen, never a silent stop:
// - Dijkstra: its helper builds a fixed 35x80 grid, so it can't run wider.
// - Linear Search and Random Search recurse once per step; on long walks the
//   classic code runs out of stack (RangeError), which is caught and reported.
// - CLASSIC_MAX_CELLS: the shim, the helper's queue and the trace grow with the
//   board. 300,000 cells is about 0.5 s of BFS in Node on the box (532 x 532,
//   a Duck 500 cells away on the diagonal), and keeps the trace to ~300k events.
import { Cell, idOf, parseId } from '../model/cell';
import { ClassicAlgo, Trace, TraceEvent } from '../engine/trace';
import { runClassic } from './run';
import { classicTrace } from './replay';
import { makeDocument, withShim } from './shim';

export const CLASSIC_MAX_CELLS = 300_000;

const LABEL: Record<ClassicAlgo, string> = {
	dijkstra: 'Dijkstra',
	linearSearch: 'Linear Search',
	breadthFirstSearch: 'Breadth First Search',
	depthFirstSearch: 'Depth First Search',
	bidirectionalSearch: 'Bidirectional Search',
	randomSearch: 'Random Search',
};

export type WideJob = {
	algo: ClassicAlgo;
	classes: string[]; // row-major, rows * cols, local ids "r-c"
	cols: number;
	starting: string; // local id
	ending: string; // local id
	origin: Cell; // world cell of local "0-0"
	seed?: number;
};
export type WideResult = { ok: true; trace: Trace } | { ok: false; reason: string };

/** Why a classic algorithm can't run on a rows x cols board, or null when it can. */
export function wideBlock(algo: ClassicAlgo, rows: number, cols: number): string | null {
	if (algo === 'dijkstra' && (rows !== 35 || cols !== 80)) return `Classic Dijkstra is written for a 35 × 80 grid, and this board needs ${rows} × ${cols}. Try Dijkstra · weighted or A*.`;
	if (rows * cols > CLASSIC_MAX_CELLS)
		return `Board too large for the classic algorithms: ${rows} × ${cols} = ${(rows * cols).toLocaleString('en-US')} cells (limit ${CLASSIC_MAX_CELLS.toLocaleString('en-US')}). Try A*.`;
	return null;
}

/** Shortest Arrow → Duck path on the job's grid (walls only, like the classic Best Path), or null. */
function bestPath(job: WideJob): string[] | null {
	const rows = job.classes.length / job.cols;
	const s = parseId(job.starting);
	const e = parseId(job.ending);
	const idx = (r: number, c: number) => r * job.cols + c;
	const prev = new Int32Array(job.classes.length).fill(-2);
	const q = new Int32Array(job.classes.length);
	let head = 0;
	let tail = 0;
	prev[idx(s.r, s.c)] = -1;
	q[tail++] = idx(s.r, s.c);
	const goal = idx(e.r, e.c);
	while (head < tail) {
		const i = q[head++];
		if (i === goal) break;
		const r = Math.floor(i / job.cols);
		const c = i % job.cols;
		for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
			if (nr < 0 || nc < 0 || nr >= rows || nc >= job.cols) continue;
			const j = idx(nr, nc);
			if (prev[j] !== -2 || job.classes[j].includes('_wall')) continue;
			prev[j] = i;
			q[tail++] = j;
		}
	}
	if (prev[goal] === -2) return null;
	const path: string[] = [];
	for (let i = goal; i !== -1; i = prev[i]) path.push(idOf(Math.floor(i / job.cols), i % job.cols));
	return path.reverse();
}

export function runWide(job: WideJob): WideResult {
	const rows = job.classes.length / job.cols;
	const block = wideBlock(job.algo, rows, job.cols);
	if (block) return { ok: false, reason: block };
	const t0 = performance.now();
	const input = { classes: job.classes, cols: job.cols, starting: job.starting, ending: job.ending, seed: job.seed };
	let trace: Trace;
	try {
		const out = withShim(makeDocument(job.classes, job.cols), () => runClassic(job.algo, input));
		trace = classicTrace(job.algo, out, input, performance.now() - t0);
	} catch (err) {
		if (err instanceof RangeError)
			return { ok: false, reason: `${LABEL[job.algo]} takes one nested call per step in the classic code, and ran out of stack on this ${rows} × ${job.cols} board. Try Depth First Search or A*.` };
		return { ok: false, reason: `${LABEL[job.algo]} failed on this ${rows} × ${job.cols} board: ${String((err as Error)?.message ?? err)}` };
	}
	// local ids -> world ids, and the best path drawn at the end (as Show Best Path does)
	const world = (id: string) => {
		const q = parseId(id);
		return idOf(q.r + job.origin.r, q.c + job.origin.c);
	};
	const events: TraceEvent[] = trace.events.filter((ev) => ev.action !== 'done').map((ev) => ({ ...ev, node: world(ev.node) }));
	const done = trace.events[trace.events.length - 1];
	const best = trace.result.found ? bestPath(job) : null;
	let step = trace.steps;
	if (best) {
		step++;
		for (const id of best) events.push({ i: events.length, step, action: 'path', node: world(id), reason: 'PATH', dsSize: 0, duck: 1, params: { p: 0 } });
	}
	events.push({ ...done, i: events.length, step, node: world(done.node) });
	const path = best ? best.map(world) : [];
	return {
		ok: true,
		trace: {
			...trace,
			steps: step,
			events,
			result: { ...trace.result, path, pathLen: path.length, pathCost: path.length ? path.length - 1 : 0, paths: path.length ? [{ duck: 1, path, cost: path.length - 1 }] : [] },
		},
	};
}
