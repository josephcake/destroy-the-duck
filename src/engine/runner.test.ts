// Classic checkpoint tours with the recursive helpers (Linear, Random Search) run on the
// main thread: Chrome's worker stack is too small for a long leg (RangeError, the run never
// finished: Random Search + 3 checkpoints at 1280, gate 2026-11-22). The rest stay off-thread.
import { tourAsync, tourOnMainThread } from './runner';
import type { TourJob } from './classicTour';

const rows = 35, cols = 80;
const job = (algo: TourJob['algo'], seed?: number): TourJob => ({
	algo, classes: Array.from({ length: rows * cols }, () => 'light_unvisited'), cols, starting: '17-15', ending: '17-64', origin: { r: 0, c: 0 }, seed, checkpoints: ['5-30', '28-40', '8-55'],
});

const posted: unknown[] = [];
class FakeWorker {
	onmessage: ((e: MessageEvent) => void) | null = null;
	postMessage(m: unknown) { posted.push(m); }
}
beforeAll(() => vi.stubGlobal('Worker', FakeWorker));
afterAll(() => vi.unstubAllGlobals());

test('Random and Linear Search tours on the table run on the main thread; the others go to the worker', () => {
	expect(tourOnMainThread(job('randomSearch'))).toBe(true);
	expect(tourOnMainThread(job('linearSearch'))).toBe(true);
	for (const a of ['breadthFirstSearch', 'depthFirstSearch', 'bidirectionalSearch', 'dijkstra'] as const) expect(tourOnMainThread(job(a))).toBe(false);
	// a wider-than-table tour stays where the wide limits apply
	expect(tourOnMainThread({ ...job('randomSearch'), classes: Array.from({ length: 40 * 90 }, () => 'light_unvisited'), cols: 90 })).toBe(false);
});

test('a long Random Search tour (seed 133: legs of 2,679 and 2,721 cells) finishes without the worker', async () => {
	posted.length = 0;
	const res = await tourAsync(job('randomSearch', 133));
	expect(posted).toEqual([]);
	expect(res.ok).toBe(true);
	if (!res.ok) return;
	expect(res.trace.result.found).toBe(true);
	expect(res.trace.result.checkpoints?.reached).toBe(3);
	const legs = [0, 0, 0, 0];
	for (const e of res.trace.events) if (e.action === 'visit' && e.leg != null) legs[e.leg]++;
	expect(Math.max(...legs)).toBeGreaterThan(2600);
	// BFS still posts to the worker
	void tourAsync(job('breadthFirstSearch'));
	expect(posted).toHaveLength(1);
});
