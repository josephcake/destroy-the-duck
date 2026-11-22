// Runs searches off the main thread when a Worker is available.
import { runSearch } from './search';
import { Snapshot } from './graph';
import { Trace, TracedAlgo } from './trace';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (t: Trace) => void>();

function getWorker(): Worker | null {
	if (typeof Worker === 'undefined') return null;
	if (!worker) {
		worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e) => {
			const resolve = pending.get(e.data.id);
			pending.delete(e.data.id);
			resolve?.(e.data.trace);
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
