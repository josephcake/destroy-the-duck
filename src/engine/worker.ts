import { runSearch } from './search';
import { runWide } from '../classic/wide';

self.onmessage = (e: MessageEvent) => {
	const { id, algo, snap, wide } = e.data;
	if (wide) (self as unknown as Worker).postMessage({ id, wide: runWide(wide) });
	else (self as unknown as Worker).postMessage({ id, trace: runSearch(algo, snap) });
};
