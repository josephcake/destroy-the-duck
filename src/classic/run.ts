// Runs one of the six classic helpers exactly as TableContext calls them.
// @ts-expect-error legacy JS module
import { spreadHelper } from '../Context/algorithms/spreadHelper';
// @ts-expect-error legacy JS module
import { dijkstraHelper } from '../Context/algorithms/dijkstraHelper';
// @ts-expect-error legacy JS module
import { bidirectionalSpreadHelper } from '../Context/algorithms/bidirectionalSpreadHelper';
// @ts-expect-error legacy JS module
import { linearSearchHelper } from '../Context/algorithms/linearSearchHelper';
// @ts-expect-error legacy JS module
import { randomHelper } from '../Context/algorithms/randomHelper';
import { ClassicAlgo } from '../engine/trace';
import { makeDocument, withDocument } from './shim';

export type ClassicInput = {
	classes: string[]; // Home, row-major, e.g. "dark_wall"
	cols?: number; // wider than Home's 80 (classic/wide.ts); rows = classes.length / cols
	starting: string;
	ending: string;
	seed?: number; // Random Search: seeds Math.random for this run only
};

export type ClassicOutput =
	| { kind: 'queue'; queue: string[] }
	| { kind: 'bidirectional'; startingQueue: string[]; endingQueue: string[]; lastQueueToRender?: string }
	| { kind: 'dijkstra'; path: string[]; fallback: string[] | null };

export function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** The raw helper output, as the golden files pin it. */
export function runHelper(algo: ClassicAlgo, { starting, ending, seed }: ClassicInput): unknown {
	switch (algo) {
		case 'dijkstra':
			return dijkstraHelper(starting, ending);
		case 'breadthFirstSearch':
			return spreadHelper(starting, ending);
		case 'depthFirstSearch':
			return spreadHelper(ending, starting); // the classic "DFS" spreads from the duck
		case 'bidirectionalSearch':
			return bidirectionalSpreadHelper(starting, ending);
		case 'linearSearch':
			return linearSearchHelper(starting);
		case 'randomSearch': {
			if (seed === undefined) return randomHelper(starting, ending);
			const original = Math.random;
			Math.random = mulberry32(seed);
			try {
				return randomHelper(starting, ending);
			} finally {
				Math.random = original;
			}
		}
	}
}

export function runClassic(algo: ClassicAlgo, input: ClassicInput): ClassicOutput {
	return withDocument(makeDocument(input.classes, input.cols), () => {
		const out = runHelper(algo, input);
		if (algo === 'bidirectionalSearch') return { kind: 'bidirectional', ...(out as Omit<Extract<ClassicOutput, { kind: 'bidirectional' }>, 'kind'>) };
		if (algo === 'dijkstra') {
			const path = out as string[];
			// TableContext falls back to a BFS run when the path misses the duck.
			const fallback = path.includes(input.ending) ? null : (spreadHelper(input.starting, input.ending) as string[]);
			return { kind: 'dijkstra', path, fallback };
		}
		return { kind: 'queue', queue: out as string[] };
	});
}
