// Turns a classic helper's output into a Trace whose steps are the classic
// player's ticks (TableContext.jsx), so step-through shows exactly what Play
// paints, cell by cell.
import { ClassicAlgo, Trace, TraceEvent } from '../engine/trace';
import { ClassicInput, ClassicOutput } from './run';

const neighbours = (id: string) => {
	const [r, c] = id.split('-').map(Number);
	return [`${r - 1}-${c}`, `${r + 1}-${c}`, `${r}-${c - 1}`, `${r}-${c + 1}`];
};

export function classicTrace(algo: ClassicAlgo, out: ClassicOutput, input: ClassicInput, engineMs = 0): Trace {
	const events: TraceEvent[] = [];
	let step = 0;
	const visit = (node: string | undefined, reason: TraceEvent['reason'] = 'CLASSIC_VISIT', side?: 'fwd' | 'bwd') => {
		if (node === undefined) return;
		events.push({ i: events.length, step, action: 'visit', node, reason, dsSize: 0, ...(side ? { side } : {}) });
	};
	let found = false;
	const { starting, ending } = input;
	if (out.kind === 'queue') {
		const target = algo === 'depthFirstSearch' ? starting : ending;
		for (const id of out.queue) {
			step++;
			visit(id);
			// Linear Search's player stops as soon as it stands on or next to the duck.
			if (algo === 'linearSearch' && (id === ending || neighbours(id).includes(ending))) break;
		}
		found = out.queue.includes(target);
	} else if (out.kind === 'bidirectional') {
		const n = Math.max(out.startingQueue.length, out.endingQueue.length);
		for (let k = 0; k < n; k++) {
			step++;
			visit(out.startingQueue[k], 'CLASSIC_VISIT', 'fwd');
			visit(out.endingQueue[k], 'CLASSIC_VISIT', 'bwd');
		}
		found = !!out.lastQueueToRender;
	} else {
		for (const id of out.path) {
			step++;
			visit(id);
		}
		found = out.path.includes(ending);
		if (out.fallback) {
			for (const id of out.fallback) {
				step++;
				visit(id, 'CLASSIC_FALLBACK');
			}
			found = out.fallback.includes(ending);
		}
	}
	events.push({ i: events.length, step, action: 'done', node: ending, reason: found ? 'CLASSIC_DONE' : 'NOT_FOUND', dsSize: 0 });
	const visited = new Set(events.filter((e) => e.action === 'visit').map((e) => e.node));
	const path = out.kind === 'dijkstra' && !out.fallback ? out.path : [];
	return {
		v: 1,
		algo,
		findMode: 'nearest',
		neighbourOrder: 'classic',
		tieBreak: 'classic player order',
		steps: step,
		events,
		result: {
			found,
			path,
			pathCost: path.length ? path.length - 1 : 0,
			pathLen: path.length,
			paths: path.length ? [{ duck: 1, path, cost: path.length - 1 }] : [],
			missing: found ? [] : [1],
			expanded: visited.size,
			maxFrontier: 0,
			engineMs,
		},
	};
}
