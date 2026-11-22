// Plain-language narration for each trace event (Learn mode).
import { parseId } from '../model/cell';
import { TraceEvent, TracedAlgo } from './trace';

const at = (id: string) => {
	const { r, c } = parseId(id);
	return `(${r}, ${c})`;
};
const dirName: Record<string, string> = { N: 'north', E: 'east', S: 'south', W: 'west' };

export function narrate(e: TraceEvent, algo: TracedAlgo): string {
	const astar = algo === 'astar';
	switch (e.reason) {
		case 'PUSH_NEW':
			if (e.action === 'init')
				return astar
					? `Start at the Arrow ${at(e.node)}. g = 0 (cost so far), h = ${e.h} (straight-line guess to the duck). Put it in the heap.`
					: `Start at the Arrow ${at(e.node)} with cost g = 0. Put it in the heap.`;
			return astar
				? `Look ${dirName[String(e.params?.dir)]}: discover ${at(e.node)} with g = ${e.g}, h = ${e.h}, so f = ${e.f}. Add it to the heap.`
				: `Look ${dirName[String(e.params?.dir)]}: discover ${at(e.node)} at cost g = ${e.g}. Add it to the heap.`;
		case 'POP_MIN_G':
			return `Pop ${at(e.node)}: it has the smallest cost in the heap (g = ${e.g}). Its cost is now final.`;
		case 'POP_MIN_F':
			return `Pop ${at(e.node)}: it has the smallest f = g + h = ${e.g} + ${e.h} = ${e.f}. Ties go to the smaller h, then the oldest entry.`;
		case 'RELAX_IMPROVED':
			return `Found a cheaper way into ${at(e.node)}: g ${e.params?.oldG} → ${e.params?.newG}. Push the better entry; the old one goes stale.`;
		case 'SKIP_STALE':
			return `Pop ${at(e.node)} again, but a cheaper entry was already handled. Skip this stale copy.`;
		case 'FOUND_DUCK':
			return e.action === 'done'
				? 'Done. The path is the chain of parents from the duck back to the Arrow.'
				: `Reached the duck at ${at(e.node)} with total cost ${e.g}.`;
		case 'PATH':
			return `Path: ${at(e.node)} (cost so far ${e.g}).`;
		case 'NOT_FOUND':
			return 'The heap is empty: every reachable cell was checked. The duck cannot be reached.';
		case 'BUDGET_EXHAUSTED':
			return 'Stopped: the search hit its visit budget before reaching the duck.';
	}
}
