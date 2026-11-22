// Trace format for traced algorithms (Warp spec §7.1, MVP subset).
import { LegacyId } from '../model/cell';

export type TracedAlgo = 'dijkstraW' | 'astar';

export type Action = 'init' | 'push' | 'pop' | 'relax' | 'skip' | 'found' | 'path' | 'done';

export type ReasonCode =
	| 'PUSH_NEW'
	| 'POP_MIN_G'
	| 'POP_MIN_F'
	| 'RELAX_IMPROVED'
	| 'SKIP_STALE'
	| 'FOUND_DUCK'
	| 'PATH'
	| 'NOT_FOUND'
	| 'BUDGET_EXHAUSTED';

export interface TraceEvent {
	i: number; // event index (micro step)
	step: number; // pop index (macro step); pushes share their pop's step
	action: Action;
	node: LegacyId;
	from?: LegacyId;
	g?: number;
	h?: number;
	f?: number;
	dsSize: number; // heap size after this event
	reason: ReasonCode;
	params?: Record<string, number | string>;
}

export interface TraceResult {
	found: boolean;
	path: LegacyId[];
	pathCost: number;
	pathLen: number;
	expanded: number;
	maxFrontier: number;
	engineMs: number;
}

export interface Trace {
	v: 1;
	algo: TracedAlgo;
	neighbourOrder: 'NESW';
	tieBreak: 'g-then-fifo' | 'f-then-h-then-fifo';
	events: TraceEvent[];
	result: TraceResult;
}

export const ALGO_INFO: Record<TracedAlgo, { label: string; family: string; blurb: string; tags: string }> = {
	dijkstraW: {
		label: 'Dijkstra · weighted',
		family: 'Shortest path',
		blurb: 'An even wave that slows down in mud and water.',
		tags: 'W ★',
	},
	astar: {
		label: 'A*',
		family: 'Heuristic',
		blurb: 'A wave that leans toward the duck.',
		tags: 'W ★ h',
	},
};
