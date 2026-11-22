// Derives what the board shows after the first n trace events.
// Forward steps are incremental; seeking backwards replays from 0.
import { Trace, TraceEvent } from '../engine/trace';

export type FrontierEntry = { node: string; g: number; h?: number; f?: number };

export class TraceState {
	applied = 0;
	visited = new Map<string, number>(); // node -> pop order
	frontier = new Map<string, FrontierEntry>();
	path: string[] = [];
	/** Path events grouped per duck (All / Tour draw one line each). */
	paths: { duck: number; nodes: string[] }[] = [];
	current: string | null = null;
	/** stepEnds[s] = event index just past the last event of step s. */
	private readonly stepEnds: number[] = [];
	constructor(readonly trace: Trace) {
		trace.events.forEach((e, i) => {
			this.stepEnds[e.step] = i + 1;
		});
		for (let s = 1; s < this.stepEnds.length; s++) this.stepEnds[s] ??= this.stepEnds[s - 1];
	}

	/**
	 * The one step unit the step bar, its counter, the inspector header and
	 * the . / , keys share: position p = steps completed (0 = nothing yet;
	 * step 1 = the start, then one per expansion, then one for the path).
	 */
	get totalSteps() {
		return this.stepEnds.length;
	}
	get position() {
		return this.applied ? this.trace.events[this.applied - 1].step + 1 : 0;
	}
	/** Event index at the end of position p. */
	endOf(p: number) {
		const q = Math.max(0, Math.min(p, this.totalSteps));
		return q === 0 ? 0 : this.stepEnds[q - 1];
	}
	/** Events of the step most recently completed (for narration). */
	get stepEvents(): TraceEvent[] {
		if (!this.applied) return [];
		const s = this.trace.events[this.applied - 1].step;
		return this.trace.events.slice(this.endOf(s), this.applied);
	}

	private apply(e: TraceEvent) {
		this.current = e.node;
		switch (e.action) {
			case 'init':
			case 'push':
			case 'relax':
				this.frontier.set(e.node, { node: e.node, g: e.g!, h: e.h, f: e.f });
				break;
			case 'pop':
			case 'visit':
				this.frontier.delete(e.node);
				if (!this.visited.has(e.node)) this.visited.set(e.node, this.visited.size);
				break;
			case 'leg':
				this.frontier.clear(); // each leg is a fresh search
				break;
			case 'path': {
				this.path.push(e.node);
				const g = this.paths[this.paths.length - 1];
				const key = Number(e.params?.p ?? 0);
				if (!g || this.paths.length - 1 !== key) this.paths.push({ duck: e.duck ?? 1, nodes: [e.node] });
				else g.nodes.push(e.node);
				break;
			}
		}
	}

	seek(n: number) {
		const target = Math.max(0, Math.min(n, this.trace.events.length));
		if (target < this.applied) {
			this.applied = 0;
			this.visited.clear();
			this.frontier.clear();
			this.path = [];
			this.paths = [];
			this.current = null;
		}
		while (this.applied < target) this.apply(this.trace.events[this.applied++]);
		return this;
	}

	get done() {
		return this.applied >= this.trace.events.length;
	}
	get lastEvent(): TraceEvent | null {
		return this.applied ? this.trace.events[this.applied - 1] : null;
	}

	/** Index just past the end of the next pop step (Sandbox playback unit). */
	nextStepEnd(from = this.applied): number {
		const ev = this.trace.events;
		let i = from;
		if (i >= ev.length) return i;
		const step = ev[i].step;
		while (i < ev.length && ev[i].step === step && ev[i].action !== 'path' && ev[i].action !== 'done') i++;
		if (i === from) i++; // path/done events advance one at a time
		return i;
	}

	/** Frontier sorted the way the heap will pop it (smallest first). */
	frontierSorted(limit = 8): FrontierEntry[] {
		const astar = this.trace.algo === 'astar';
		return [...this.frontier.values()]
			.sort((a, b) => (astar ? a.f! - b.f! || a.h! - b.h! : a.g - b.g))
			.slice(0, limit);
	}
}
