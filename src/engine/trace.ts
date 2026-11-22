// Trace format (Warp spec §7.1). Every algorithm, classic or new, is played
// back from one of these. One "step" is the unit the step bar, the Step
// button, the inspector label and Sandbox playback all count:
//  - new algorithms: one expansion (a pop with its pushes/relaxes), one
//    Bellman-Ford round header, one IDA* bound change, one Tour leg header,
//    and one final step that traces the path(s);
//  - classic six: one tick of the classic player (one cell; two for
//    Bidirectional), so stepping matches what Play paints.
import { LegacyId } from '../model/cell';

export type ClassicAlgo =
	| 'dijkstra'
	| 'linearSearch'
	| 'breadthFirstSearch'
	| 'depthFirstSearch'
	| 'bidirectionalSearch'
	| 'randomSearch';

export type TracedAlgo =
	| 'dijkstraW'
	| 'astar'
	| 'weightedAstar'
	| 'greedy'
	| 'bidirectionalAstar'
	| 'jps4'
	| 'dfsStack'
	| 'bellmanFord'
	| 'idaStar';

export type AlgoId = ClassicAlgo | TracedAlgo;
export type FindMode = 'nearest' | 'all' | 'tour';
export type Side = 'fwd' | 'bwd';

export const TRACED: readonly TracedAlgo[] = [
	'dijkstraW',
	'astar',
	'weightedAstar',
	'greedy',
	'bidirectionalAstar',
	'jps4',
	'dfsStack',
	'bellmanFord',
	'idaStar',
];
export const isTraced = (a: AlgoId | null | undefined): a is TracedAlgo => !!a && (TRACED as readonly string[]).includes(a);

export type Action =
	| 'init'
	| 'push'
	| 'pop'
	| 'relax'
	| 'skip'
	| 'prune'
	| 'meet'
	| 'round'
	| 'iter'
	| 'leg'
	| 'found'
	| 'visit'
	| 'path'
	| 'done';

export type ReasonCode =
	| 'PUSH_NEW'
	| 'POP_MIN_G'
	| 'POP_MIN_F'
	| 'POP_MIN_H'
	| 'POP_STACK'
	| 'POP_SCAN'
	| 'JUMP_POINT'
	| 'RELAX_IMPROVED'
	| 'SKIP_STALE'
	| 'SKIP_SEEN'
	| 'PRUNE_F'
	| 'MEET'
	| 'ROUND'
	| 'ITER_BOUND'
	| 'LEG'
	| 'FOUND_DUCK'
	| 'PATH'
	| 'NOT_FOUND'
	| 'BUDGET_EXHAUSTED'
	| 'CLASSIC_VISIT'
	| 'CLASSIC_FALLBACK'
	| 'CLASSIC_DONE';

export interface TraceEvent {
	i: number; // event index
	step: number; // see the header comment
	action: Action;
	node: LegacyId;
	from?: LegacyId;
	via?: 'step' | 'jump';
	side?: Side;
	duck?: number; // 1-based duck number
	leg?: number; // Tour / All leg index (0-based)
	g?: number;
	h?: number;
	f?: number;
	dsSize: number; // frontier size after this event
	reason: ReasonCode;
	params?: Record<string, number | string>;
}

export type DuckPath = { duck: number; path: LegacyId[]; cost: number };

export interface TraceResult {
	found: boolean; // every requested duck reached
	path: LegacyId[]; // flat display path (Tour: legs joined)
	pathCost: number; // Nearest: its cost; All: sum; Tour: total
	pathLen: number;
	paths: DuckPath[];
	missing: number[]; // duck numbers not reached
	expanded: number;
	maxFrontier: number;
	engineMs: number;
}

export interface Trace {
	v: 1;
	algo: AlgoId;
	findMode: FindMode;
	neighbourOrder: 'NESW' | 'classic';
	tieBreak: string;
	steps: number; // last step number
	events: TraceEvent[];
	result: TraceResult;
}

export type AlgoInfo = { label: string; family: string; blurb: string; tags: string; tieBreak: string };

export const ALGO_INFO: Record<TracedAlgo, AlgoInfo> = {
	dijkstraW: { label: 'Dijkstra · weighted', family: 'Shortest path', blurb: 'An even wave that slows down in mud and water.', tags: 'W ★', tieBreak: 'g, then oldest' },
	astar: { label: 'A*', family: 'Heuristic', blurb: 'A wave that leans toward Quack.', tags: 'W ★ h', tieBreak: 'f, then h, then oldest' },
	weightedAstar: { label: 'Weighted A* (ε = 2)', family: 'Heuristic', blurb: 'Leans harder: fast, at most 2× the best cost.', tags: 'W h', tieBreak: 'g + 2h, then h, then oldest' },
	greedy: { label: 'Greedy best-first', family: 'Heuristic', blurb: 'Always steps toward Quack. Fast, not shortest.', tags: 'h', tieBreak: 'h, then oldest' },
	bidirectionalAstar: { label: 'Bidirectional A*', family: 'Two-way', blurb: 'Two A* waves, from the Arrow and from Quack.', tags: 'W ★ h', tieBreak: 'f per side, then h, then oldest' },
	jps4: { label: 'Jump point search', family: 'Plain grid', blurb: 'Skips straight runs and stops only where a turn matters.', tags: '★ h', tieBreak: 'f, then h, then oldest' },
	dfsStack: { label: 'Depth-first', family: 'Uninformed', blurb: 'A true stack: dives down one corridor until stuck.', tags: '', tieBreak: 'last in, first out' },
	bellmanFord: { label: 'Bellman-Ford', family: 'Shortest path', blurb: 'Relaxes every edge, round after round.', tags: 'W ★', tieBreak: 'row-major scan' },
	idaStar: { label: 'IDA*', family: 'Heuristic', blurb: 'Depth-first dives with a growing f budget.', tags: 'W ★ h', tieBreak: 'N, E, S, W order' },
};
