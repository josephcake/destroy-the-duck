// Runs searches off the main thread when a Worker is available.
import { runSearch } from './search';
import { Snapshot } from './graph';
import { Trace, TracedAlgo } from './trace';
import { WideJob, WideResult, runWide } from '../classic/wide';

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
