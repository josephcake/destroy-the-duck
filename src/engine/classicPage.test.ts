// classicPage.ts: a classic leg on the main thread gives exactly runWide's result,
// and works where a browser window won't let globalThis.document be redefined.
import { runClassicTour, TourJob } from './classicTour';
import { runWideOnPage } from './classicPage';
import { runWide } from '../classic/wide';

const rows = 35, cols = 80;
const classes = Array.from({ length: rows * cols }, (_, i) => ([5 * cols + 29, 5 * cols + 31, 4 * cols + 30].includes(i) || (i % cols === 47 && Math.floor(i / cols) < 30) ? 'light_wall' : 'light_unvisited'));
const job = (algo: TourJob['algo'], seed?: number): TourJob => ({ algo, classes, cols, starting: '17-15', ending: '17-64', origin: { r: 3, c: 7 }, seed, checkpoints: ['5-30', '28-40', '8-55'] });
const strip = (r: ReturnType<typeof runWide>) => JSON.parse(JSON.stringify(r, (k, v) => (k === 'ms' || k === 'engineMs' ? undefined : v)));

test.each([
	['randomSearch', 1], ['randomSearch', 7], ['randomSearch', 133], ['linearSearch', undefined], ['breadthFirstSearch', undefined], ['depthFirstSearch', undefined], ['bidirectionalSearch', undefined],
] as const)('%s (seed %s): the main-thread tour equals the worker tour, event for event', (algo, seed) => {
	const a = runClassicTour(job(algo, seed));
	const b = runClassicTour(job(algo, seed), runWideOnPage);
	expect(strip(b)).toEqual(strip(a));
	expect(Object.getOwnPropertyNames(document)).not.toContain('getElementById');
	expect(Object.getOwnPropertyNames(document)).not.toContain('querySelectorAll');
});

test('like a browser window (document not redefinable): runWide fails, runWideOnPage runs and puts the document back', () => {
	const d = document;
	Object.defineProperty(globalThis, 'document', { value: d, configurable: false, writable: false });
	const leg = { ...job('randomSearch', 133), starting: '17-15', ending: '5-30' };
	expect(runWide(leg)).toMatchObject({ ok: false, reason: expect.stringMatching(/Cannot redefine property: document/) });
	const res = runWideOnPage(leg);
	expect(res.ok && res.trace.result.found).toBe(true);
	expect(Object.getOwnPropertyNames(document)).not.toContain('getElementById');
	expect(typeof document.getElementById).toBe('function');
	const el = document.createElement('div');
	el.id = 'probe';
	document.body.appendChild(el);
	expect(document.getElementById('probe')).toBe(el); // the real method again
});
