// The best path for a classic run: the same classic Dijkstra helper the Show
// Best Path button calls, read-only against the live (hidden) table.
// @ts-expect-error legacy JS module
import { dijkstraHelper } from '../Context/algorithms/dijkstraHelper';

/** Arrow → Duck cell ids, or null when the duck cannot be reached. */
export function classicBestPath(starting: string, ending: string): string[] | null {
	const path: string[] = dijkstraHelper(starting, ending);
	return path.includes(ending) ? path : null;
}
