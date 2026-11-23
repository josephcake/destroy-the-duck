// Plain-language narration for each trace event (Learn mode).
import { parseId } from '../model/cell';
import { AlgoId, TraceEvent, isTraced } from './trace';

const at = (id: string) => {
	const { r, c } = parseId(id);
	return `(${r}, ${c})`;
};
const dirName: Record<string, string> = { N: 'north', E: 'east', S: 'south', W: 'west', J: 'through the teleporter' };
const look = (e: TraceEvent) => (e.via === 'jump' ? 'Jump through the teleporter (cost 0)' : `Look ${dirName[String(e.params?.dir)] ?? ''}`);
const sideName = (e: TraceEvent) => (e.side === 'bwd' ? 'Quack side: ' : e.side === 'fwd' ? 'Arrow side: ' : '');

const who = (e: TraceEvent) => (e.side === 'bwd' ? `Quack ${e.duck ?? 1}` : e.leg ? 'the last stop' : 'the Arrow');

export function narrate(e: TraceEvent, algo: AlgoId): string {
	const withH = isTraced(algo) && algo !== 'dijkstraW' && algo !== 'dfsStack' && algo !== 'bellmanFord';
	const s = sideName(e);
	switch (e.reason) {
		case 'PUSH_NEW':
			if (e.action === 'init')
				return withH
					? `Start at ${who(e)} ${at(e.node)}. g = 0 (cost so far), h = ${e.h} (a guess that never overestimates). Add it to the frontier.`
					: `Start at ${who(e)} ${at(e.node)} with cost g = 0. Add it to the frontier.`;
			if (algo === 'dfsStack') return `${look(e)}: push ${at(e.node)} on the stack. The last one pushed comes off first.`;
			return withH
				? `${s}${look(e)}: discover ${at(e.node)} with g = ${e.g}, h = ${e.h}, key = ${e.f}.`
				: `${s}${look(e)}: discover ${at(e.node)} at cost g = ${e.g}.`;
		case 'POP_MIN_G':
			return `Pop ${at(e.node)}: it has the smallest cost in the heap (g = ${e.g}). Its cost is now final.`;
		case 'POP_MIN_F':
			return `${s}Pop ${at(e.node)}: smallest f = g + h = ${e.g} + ${e.h} = ${e.f}. Ties go to the smaller h, then the oldest entry.`;
		case 'POP_MIN_H':
			return `Pop ${at(e.node)}: it looks closest to Quack (h = ${e.h}). Greedy ignores the cost so far (g = ${e.g}).`;
		case 'POP_STACK':
			return algo === 'idaStar'
				? `Dive into ${at(e.node)}: f = ${e.f} is within the bound ${e.params?.bound}.`
				: `Pop ${at(e.node)} off the top of the stack and go deeper from here.`;
		case 'POP_SCAN':
			return `Round ${e.params?.round}: ${at(e.node)} (g = ${e.g}) relaxes its edges.`;
		case 'JUMP_POINT':
			return `Run ${dirName[String(e.params?.dir)]} for ${e.params?.run} cells to the jump point ${at(e.node)} (g = ${e.g}, f = ${e.f}).`;
		case 'RELAX_IMPROVED':
			return `${s}Found a cheaper way into ${at(e.node)}: g ${e.params?.oldG} → ${e.params?.newG}.`;
		case 'SKIP_STALE':
			return `${s}Pop ${at(e.node)} again, but a cheaper copy was already handled. Skip it.`;
		case 'SKIP_SEEN':
			return `${at(e.node)} was already explored. Skip it.`;
		case 'PRUNE_F':
			return `${at(e.node)} has f = ${e.f}, over the bound ${e.params?.bound}. Prune it and remember ${e.f} for the next bound.`;
		case 'MEET':
			return `The two searches meet at ${at(e.node)}: best total so far μ = ${e.params?.mu}. Keep going until neither side can beat it.`;
		case 'ROUND':
			return `Round ${e.params?.round}: scan every reached cell in reading order and relax its edges.`;
		case 'ITER_BOUND':
			return `New dive from the Arrow with f bound ${e.params?.bound}.`;
		case 'LEG':
			if (e.params?.checkpoint) return `Leg ${(e.leg ?? 0) + 1}: search from ${at(e.node)} to checkpoint ${e.params.checkpoint}.`;
			return e.duck ? `Leg ${(e.leg ?? 0) + 1}: search from ${at(e.node)} to Quack ${e.duck}.` : `Leg ${(e.leg ?? 0) + 1}: every checkpoint done, search from ${at(e.node)} to Quack.`;
		case 'FOUND_DUCK':
			if (e.action === 'done') return 'Done. Each path is the chain of parents from a Quack back to its start.';
			if (e.duck === 0) return `Reached the checkpoint at ${at(e.node)} (cost ${e.g} for this leg).`;
			return `Reached Quack ${e.duck ?? 1} at ${at(e.node)} with total cost ${e.g}.${e.params?.left ? ` ${e.params.left} more to find.` : ''}`;
		case 'PATH':
			return `Path: ${at(e.node)}${e.duck ? ` (to Quack ${e.duck})` : ''}.`;
		case 'NOT_FOUND':
			return 'Nothing left to explore. Quack cannot be reached.';
		case 'BUDGET_EXHAUSTED':
			return 'Stopped: the search hit its visit budget before reaching Quack.';
		case 'CLASSIC_VISIT':
			return `${s}Paint ${at(e.node)}, the next cell in the classic queue.`;
		case 'CLASSIC_FALLBACK':
			return `No path for Dijkstra, so the classic player falls back to Breadth First Search: paint ${at(e.node)}.`;
		case 'CLASSIC_DONE':
			return 'The classic run is over.';
		default:
			return '';
	}
}
