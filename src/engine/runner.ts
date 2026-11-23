// Runs searches off the main thread when a Worker is available.
import { runSearch } from './search';
import { Snapshot } from './graph';
import { Trace, TracedAlgo } from './trace';
import { WideJob, WideResult, runWide } from '../classic/wide';
import { TourJob, runClassicTour } from './classicTour';
import { runWideOnPage } from './classicPage';

let worker: Worker | null = null;
let nextId = 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pending = new Map<number, (t: any) => void>();

function getWorker(): Worker | null {
	if (typeof Worker === 'undefined') return null;
	if (!worker) {
		worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e) => {
			const resolve = pending.get(e.data.id);
			pending.delete(e.data.id);
			resolve?.(e.data.wide ?? e.data.trace);
		};
	}
	return worker;
}

export function searchAsync(algo: TracedAlgo, snap: Snapshot): Promise<Trace> {
	const w = getWorker();
	if (!w) return Promise.resolve(runSearch(algo, snap));
	const id = nextId++;
	return new Promise((resolve) => {
		pending.set(id, resolve);
		w.postMessage({ id, algo, snap });
	});
}

/** A classic algorithm on a board wider than the table (classic/wide.ts), off the main thread when it can be. */
export function wideAsync(job: WideJob): Promise<WideResult> {
	const w = getWorker();
	if (!w) return Promise.resolve(runWide(job));
	const id = nextId++;
	return new Promise((resolve) => {
		pending.set(id, resolve);
		w.postMessage({ id, wide: job });
	});
}

/** Classic helpers that take one nested call per step (classic/wide.ts). */
const RECURSIVE = new Set(['linearSearch', 'randomSearch']);
/**
 * Where a classic checkpoint tour runs. Linear and Random Search recurse once per
 * step, and one leg of a 35 × 80 tour can walk ~2,750 cells. Chrome gives a worker
 * well under half the main thread's stack (measured: ~4,100 vs ~10,400 frames of a
 * small function), so long legs threw RangeError in the worker ("ran out of stack")
 * and the run never finished. The classic table runs these helpers on the main
 * thread; so does a tour that fits the table (classicPage.ts; worst case ~0.5 s
 * for Random Search).
 */
export function tourOnMainThread(job: TourJob): boolean {
	return RECURSIVE.has(job.algo) && job.classes.length / job.cols <= 35 && job.cols <= 80;
}

/** A classic algorithm through checkpoints (classicTour.ts), off the main thread when it can be. */
export function tourAsync(job: TourJob): Promise<WideResult> {
	// a macrotask first, so Go's "Pause" paints before the walk runs
	if (tourOnMainThread(job) && typeof document !== 'undefined') return new Promise((resolve) => setTimeout(() => resolve(runClassicTour(job, runWideOnPage)), 0));
	const w = getWorker();
	if (!w) return Promise.resolve(runClassicTour(job));
	const id = nextId++;
	return new Promise((resolve) => {
		pending.set(id, resolve);
		w.postMessage({ id, tour: job });
	});
}
