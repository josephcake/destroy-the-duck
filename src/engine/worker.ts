import { runSearch } from './search';

self.onmessage = (e: MessageEvent) => {
	const { id, algo, snap } = e.data;
	(self as unknown as Worker).postMessage({ id, trace: runSearch(algo, snap) });
};
