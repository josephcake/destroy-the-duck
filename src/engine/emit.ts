// Shared plumbing for the traced cores: the event log, step counter, budget,
// and the goal / reach types every core speaks.
import { Cell, cellOfKey, idOf } from '../model/cell';
import { TraceEvent } from './trace';
import { Graph } from './graph';

export type Goal = { cell: Cell; key: number; duck: number };
export type Reach = { duck: number; keys: number[]; cost: number };
export type CoreOut = { reached: Reach[]; budgetHit: boolean };
export type CoreMode = 'nearest' | 'all';
/** A search from `start` to `goals`; 'all' keeps going until every goal is reached. */
export type Core = (E: Emitter, G: Graph, start: Cell, goals: Goal[], mode: CoreMode) => CoreOut;

export class Emitter {
	events: TraceEvent[] = [];
	step = 0;
	leg: number | undefined;
	size = 0; // current frontier size, stamped on each event
	maxFrontier = 0;
	expanded = 0;
	constructor(readonly budget: number) {}
	emit(e: Omit<TraceEvent, 'i' | 'step' | 'dsSize'>) {
		if (this.size > this.maxFrontier) this.maxFrontier = this.size;
		const ev: TraceEvent = { i: this.events.length, step: this.step, dsSize: this.size, ...e };
		if (this.leg !== undefined) ev.leg = this.leg;
		this.events.push(ev);
	}
	/** Starts a new step (one expansion, round, bound or leg). */
	next() {
		this.step++;
	}
	/** Counts one expansion; false when the budget is spent. */
	expand() {
		if (this.expanded >= this.budget) return false;
		this.expanded++;
		return true;
	}
}

export const idOfKey = (k: number) => {
	const c = cellOfKey(k);
	return idOf(c.r, c.c);
};

/** Follows parent links from k back to the root; returns root → k. */
export function chain(parent: Map<number, number>, k: number): number[] {
	const keys: number[] = [];
	for (let x: number | undefined = k; x !== undefined; x = parent.get(x)) keys.push(x);
	return keys.reverse();
}
