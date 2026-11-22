// Derives what the board shows after the first n trace events.
// Forward steps are incremental; seeking backwards replays from 0.
import { Trace, TraceEvent } from '../engine/trace';

export type FrontierEntry = { node: string; g: number; h?: number; f?: number };

export class TraceState {
	applied = 0;
	visited = new Map<string, number>(); // node -> pop order
	frontier = new Map<string, FrontierEntry>();
	path: string[] = [];
	current: string | null = null;
	constructor(readonly trace: Trace) {}

	private apply(e: TraceEvent) {
		this.current = e.node;
		switch (e.action) {
			case 'init':
			case 'push':
			case 'relax':
				this.frontier.set(e.node, { node: e.node, g: e.g!, h: e.h, f: e.f });
				break;
			case 'pop':
				this.frontier.delete(e.node);
				this.visited.set(e.node, this.visited.size);
				break;
			case 'path':
				this.path.push(e.node);
				break;
		}
	}

	seek(n: number) {
		const target = Math.max(0, Math.min(n, this.trace.events.length));
		if (target < this.applied) {
			this.applied = 0;
			this.visited.clear();
			this.frontier.clear();
			this.path = [];
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
	nextStepEnd(): number {
		const ev = this.trace.events;
		let i = this.applied;
		if (i >= ev.length) return i;
		const step = ev[i].step;
		while (i < ev.length && ev[i].step === step && ev[i].action !== 'path' && ev[i].action !== 'done') i++;
		if (i === this.applied) i++; // path/done events advance one at a time
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
