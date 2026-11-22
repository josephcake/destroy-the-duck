// Quack Hunt's story (Joseph 2026-11-22). All the copy lives here so it is easy to edit.
// The tone is playful and warm: "hunt" as in find, never hurt. Keep every line short
// (60 characters or fewer) so it reads in the status pill on a phone. No 'pond' (Paper v2.1 copy rule).
import type { AlgoId } from './engine/trace';

/** The premise, for the record (and anywhere a longer telling fits). */
export const PREMISE =
	'Quack, the boldest duck around, swiped the last loaf of bread and waddled off into the maze. ' +
	"You're the Arrow, a little compass that thinks in algorithms. Pick a way of thinking and go find her. " +
	'Nobody gets a fright: when you catch Quack, she shares the crumbs.';

/** First-run card: one or two lines (desktop, landscape). */
export const INTRO = "Quack swiped the last loaf of bread and waddled into the maze. You're the Arrow, a little compass that thinks in algorithms.";
/** First-run card on portrait phones: one short line. */
export const INTRO_SHORT = 'Quack took the last loaf. Go find her!';

export type Outcome = 'found' | 'escaped';
type Lines = Record<Outcome, string[]>;

/** Two lines per algorithm and outcome; a shared line joins each set (so 3 per outcome). */
export const LINES: Record<AlgoId, Lines> = {
	// classic six
	dijkstra: {
		found: ['Dijkstra counted every step. Bread recovered!', 'Step by careful step, straight to Quack.'],
		escaped: ['Dijkstra counted every step: no way through.', 'Every step counted, and no road to Quack.'],
	},
	linearSearch: {
		found: ['One waddle at a time, and there she is!', 'Left first, always. It worked: hi, Quack!'],
		escaped: ['Walked every way it knows. No Quack.', 'One waddle at a time, into a dead end.'],
	},
	breadthFirstSearch: {
		found: ['BFS checked every puddle in order. Found her!', 'Ring by ring, puddle by puddle: Quack!'],
		escaped: ['Every puddle checked. Quack is out of reach.', 'Ring after ring, and no way to Quack.'],
	},
	depthFirstSearch: {
		found: ['DFS chased one hunch all the way. Got her!', 'One long hunch, and it paid off. Hi, Quack!'],
		escaped: ['DFS chased every hunch. Quack is walled in.', 'Hunch after hunch, all dead ends.'],
	},
	bidirectionalSearch: {
		found: ["Two waves met in the middle. Quack's caught!", 'From both ends at once: found her!'],
		escaped: ['Two waves, no meeting. Quack wins this one.', 'Both sides searched. The walls kept them apart.'],
	},
	randomSearch: {
		found: ['Bumbled about and bumped into Quack!', 'Pure luck and a happy waddle: found!'],
		escaped: ['Wandered everywhere. Quack stays hidden.', 'Lucky guesses ran out. No Quack this time.'],
	},
	// the new nine
	dijkstraW: {
		found: ['Dijkstra weighed every puddle. Found Quack!', 'Mud and water priced in. Quack is caught!'],
		escaped: ['Every puddle weighed. No way to Quack.', 'The cheapest road to Quack does not exist.'],
	},
	astar: {
		found: ['A* smelled the bread. Found Quack!', 'A* followed the crumbs right to Quack.'],
		escaped: ['A* smelled the bread, but the walls said no.', 'Crumbs on the far side of a wall. So close!'],
	},
	weightedAstar: {
		found: ['Weighted A* sniffed hard and dashed. Got her!', 'In a hurry, nearly the best way: found!'],
		escaped: ['Sniffed hard, hit walls. Quack keeps the loaf.', 'Dashed everywhere. No way in.'],
	},
	greedy: {
		found: ['Greedy ran straight at the bread. Gotcha!', 'Not the short way, the eager way. Found!'],
		escaped: ['Greedy charged ahead and ran out of maze.', 'Straight at the bread, straight into walls.'],
	},
	bidirectionalAstar: {
		found: ["Two noses met in the middle. Quack's caught!", "Arrow and Quack's trail met halfway. Found!"],
		escaped: ['Two searches, no meeting. Quack is sealed in.', 'Both noses sniffed. The walls won.'],
	},
	jps4: {
		found: ['Jumped the straight runs, landed on Quack.', "Hop, skip, jump: there's Quack!"],
		escaped: ['Jumped everywhere. No way to Quack.', 'Every jump landed short of Quack.'],
	},
	dfsStack: {
		found: ['DFS chased one hunch all the way. Got her!', 'Down one corridor and out pops Quack!'],
		escaped: ['Every corridor tried. Quack is walled in.', 'Dived deep, came up empty-handed.'],
	},
	bellmanFord: {
		found: ['Bellman-Ford checked every road. Found her!', 'Round after round, the trail led to Quack.'],
		escaped: ['Every road relaxed. None reach Quack.', 'Round after round, still no road in.'],
	},
	idaStar: {
		found: ['IDA* dug a little deeper each time. Found!', 'Patient dives, growing budget: hi, Quack!'],
		escaped: ["IDA* dug deep. Quack's burrow is sealed.", 'Deeper and deeper, and no way through.'],
	},
};

/** Shared lines, mixed into every algorithm's set. */
export const SHARED: Lines = {
	found: ['Found Quack! She shares the crumbs.'],
	escaped: ['Quack waddled off with the bread. Fewer walls?'],
};

/** All the lines for an algorithm and outcome, in round-robin order. */
export const linesFor = (algo: AlgoId, outcome: Outcome) => [...LINES[algo][outcome], ...SHARED[outcome]];

const turns = new Map<string, number>();
/** The next line for this algorithm and outcome, round-robin (so repeat runs vary). */
export function storyLine(algo: AlgoId, outcome: Outcome): string {
	const all = linesFor(algo, outcome);
	const key = `${algo}:${outcome}`;
	const i = turns.get(key) ?? 0;
	turns.set(key, i + 1);
	return all[i % all.length];
}
