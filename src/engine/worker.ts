import { runSearch } from './search';
import { runWide } from '../classic/wide';
import { runClassicTour } from './classicTour';

self.onmessage = (e: MessageEvent) => {
	const { id, algo, snap, wide, tour } = e.data;
	if (tour) (self as unknown as Worker).postMessage({ id, wide: runClassicTour(tour) });
	else if (wide) (self as unknown as Worker).postMessage({ id, wide: runWide(wide) });
	else (self as unknown as Worker).postMessage({ id, trace: runSearch(algo, snap) });
};
