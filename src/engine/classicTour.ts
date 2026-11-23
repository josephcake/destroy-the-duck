// Checkpoints for the classic algorithms, without touching the classic files:
// each segment (Arrow → checkpoint 1 → … → Quack) is its own classic run of the
// unchanged helpers on the shim (classic/wide.ts), with the Arrow and Quack
// classes moved to the segment's two ends. The segment traces are joined with a
// 'leg' event between them, like the traced Tour, and one gold path at the end.
// The order comes from planTour on the walls-only grid (the classic helpers
// ignore everything else).
import { Cell, idOf, keyOf, parseId } from '../model/cell';
import { WideJob, WideResult, runWide } from '../classic/wide';
import { Graph } from './graph';
import { planTour } from './checkpoints';
import { Trace, TraceEvent } from './trace';

/** A wide job plus its checkpoints (local ids, in board order). */
export type TourJob = WideJob & { checkpoints: string[] };

const UNVISITED = 'light_unvisited';

export function runClassicTour(job: TourJob): WideResult {
	const rows = job.classes.length / job.cols;
	const local = (id: string) => parseId(id);
	const world = (q: Cell) => idOf(q.r + job.origin.r, q.c + job.origin.c);
	const walls: number[] = [];
	job.classes.forEach((cls, i) => cls.includes('_wall') && walls.push(keyOf(Math.floor(i / job.cols), i % job.cols)));
	const cps = job.checkpoints.map(local);
	const start = local(job.starting);
	const end = local(job.ending);
	const G = new Graph({ bounds: { r0: 0, c0: 0, r1: rows - 1, c1: job.cols - 1 }, walls, weights: [], start, goals: [end], budget: Infinity });
	const plan = planTour(G, start, cps, [end]);
	const stops = [start, ...plan.order.map((i) => cps[i]), end];
	const base = job.classes.map((cls, i) => (i === start.r * job.cols + start.c || i === end.r * job.cols + end.c ? UNVISITED : cls));

	const events: TraceEvent[] = [];
	const path: string[] = [];
	const seen = new Set<string>();
	let step = 0;
	let reached = 0;
	let found = false;
	let last: Trace | null = null;
	for (let k = 0; k + 1 < stops.length; k++) {
		const from = stops[k];
		const to = stops[k + 1];
		const classes = base.slice();
		classes[from.r * job.cols + from.c] = 'light_starting';
		classes[to.r * job.cols + to.c] = 'light_ending';
		const res = runWide({ ...job, classes, starting: idOf(from.r, from.c), ending: idOf(to.r, to.c) });
		if (!res.ok) return res;
		const t = res.trace;
		last = t;
		step++;
		const toCheckpoint = k < plan.order.length;
		events.push({ i: events.length, step, action: 'leg', node: world(from), reason: 'LEG', dsSize: 0, leg: k, ...(toCheckpoint ? {} : { duck: 1 }), params: { to: world(to), ...(toCheckpoint ? { checkpoint: k + 1 } : {}) } });
		const offset = step;
		for (const ev of t.events) {
			if (ev.action === 'path' || ev.action === 'done') continue;
			events.push({ ...ev, i: events.length, step: ev.step + offset, leg: k });
			if (ev.action === 'visit') seen.add(ev.node);
		}
		let segSteps = 0;
		for (const ev of t.events) if (ev.action !== 'path' && ev.action !== 'done') segSteps = Math.max(segSteps, ev.step);
		step += segSteps;
		if (!t.result.found) break;
		path.push(...(path.length ? t.result.path.slice(1) : t.result.path));
		if (toCheckpoint) reached++;
		else found = true;
	}
	if (found) {
		step++;
		for (const id of path) events.push({ i: events.length, step, action: 'path', node: id, reason: 'PATH', dsSize: 0, duck: 1, params: { p: 0 } });
	}
	events.push({ i: events.length, step, action: 'done', node: world(end), reason: found ? 'CLASSIC_DONE' : 'NOT_FOUND', dsSize: 0 });
	const result = last!.result;
	return {
		ok: true,
		trace: {
			...last!,
			steps: step,
			events,
			result: {
				...result,
				found,
				path: found ? path : [],
				pathLen: found ? path.length : 0,
				pathCost: found ? path.length - 1 : 0,
				paths: found ? [{ duck: 1, path, cost: path.length - 1 }] : [],
				missing: found ? [] : [1],
				expanded: seen.size,
				checkpoints: { order: plan.order.map((i) => world(cps[i])), method: plan.method, reached },
			},
		},
	};
}
