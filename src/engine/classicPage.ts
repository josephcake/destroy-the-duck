// A classic leg on the main thread, for the helpers that recurse once per step
// (Linear, Random Search). Chrome gives a worker well under half the main
// thread's stack (measured 2026-11-22: ~4,100 vs ~10,400 frames of a small
// function), and one leg of a 35 × 80 checkpoint tour can walk ~2,750 cells, so
// in the worker long legs threw RangeError and the run never finished.
//
// classic/wide.ts runWide can't run here: its withShim redefines
// globalThis.document, which a browser window doesn't allow. The helper files
// (unchanged) only call document.getElementById and querySelectorAll('td'), so
// for the length of the synchronous run those two answer from the shim as own
// properties on the real document; the prototype methods are back right after.
// The rest mirrors runWide (world ids, the Best Path at the end), and
// classicPage.test.ts pins it equal to runWide.
import { idOf, parseId } from '../model/cell';
import { WideJob, WideResult, wideBlock } from '../classic/wide';
import { runClassic } from '../classic/run';
import { classicTrace } from '../classic/replay';
import { ClassicDocument, makeDocument } from '../classic/shim';
import { Trace, TraceEvent } from './trace';

const LABEL: Record<WideJob['algo'], string> = {
	dijkstra: 'Dijkstra',
	linearSearch: 'Linear Search',
	breadthFirstSearch: 'Breadth First Search',
	depthFirstSearch: 'Depth First Search',
	bidirectionalSearch: 'Bidirectional Search',
	randomSearch: 'Random Search',
};

/** Runs fn with document.getElementById / querySelectorAll answered by the shim (main thread). */
export function withShimMethods<T>(shim: ClassicDocument, fn: () => T): T {
	const d = document as unknown as Record<string, unknown>;
	d.getElementById = shim.getElementById;
	d.querySelectorAll = shim.querySelectorAll;
	try {
		return fn();
	} finally {
		delete d.getElementById;
		delete d.querySelectorAll;
	}
}

/** Shortest Arrow → Duck path on the job's grid, walls only, neighbours up/down/left/right (as classic/wide.ts). */
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

/** runWide, on the main thread. */
export function runWideOnPage(job: WideJob): WideResult {
	const rows = job.classes.length / job.cols;
	const block = wideBlock(job.algo, rows, job.cols);
	if (block) return { ok: false, reason: block };
	const t0 = performance.now();
	const input = { classes: job.classes, cols: job.cols, starting: job.starting, ending: job.ending, seed: job.seed };
	let trace: Trace;
	try {
		const out = withShimMethods(makeDocument(job.classes, job.cols), () => runClassic(job.algo, input));
		trace = classicTrace(job.algo, out, input, performance.now() - t0);
	} catch (err) {
		if (err instanceof RangeError)
			return { ok: false, reason: `${LABEL[job.algo]} takes one nested call per step in the classic code, and ran out of stack on this ${rows} × ${job.cols} board. Try Depth First Search or A*.` };
		return { ok: false, reason: `${LABEL[job.algo]} failed on this ${rows} × ${job.cols} board: ${String((err as Error)?.message ?? err)}` };
	}
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
