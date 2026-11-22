import { parseLevel } from '../model/level';
import { runSearch } from '../engine/search';
import { narrate } from '../engine/narrate';
import { snapshotOf } from '../testing/levelSnapshot';
import { TraceState } from './player';

const trace = runSearch('astar', snapshotOf(parseLevel(['S5555D', '......'])));

test('seeking forward and back gives the same state as a fresh replay', () => {
	const s = new TraceState(trace);
	s.seek(trace.events.length);
	expect(s.path).toEqual(trace.result.path);
	s.seek(5);
	const fresh = new TraceState(trace).seek(5);
	expect([...s.visited]).toEqual([...fresh.visited]);
	expect([...s.frontier]).toEqual([...fresh.frontier]);
});

test('Sandbox playback unit = one pop step', () => {
	const s = new TraceState(trace);
	s.seek(s.nextStepEnd()); // init
	s.seek(s.nextStepEnd()); // first pop + its pushes
	expect(s.visited.size).toBe(1);
	expect(s.lastEvent!.step).toBe(1);
});

test('every event has narration', () => {
	for (const e of trace.events) expect(narrate(e, 'astar').length).toBeGreaterThan(10);
	expect(narrate(trace.events[0], 'astar')).toMatch(/Start at the Arrow \(0, 0\)/);
});
