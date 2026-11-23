// A classic run that can't reach Quack (the table falls back to a spread and shows
// "Cannot find Quack!") tells its no-path story in the pill, in the theme's fail
// red with a ✕, as traced runs do (2026-11-22, with the classic Dijkstra fix).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { linesFor } from '../story';

let getCtx;
beforeEach(() => {
	const noop = () => new Proxy({}, {
		get(t, k) {
			if (k in t) return t[k];
			if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
			if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
			if (k === 'createPattern') return () => ({ setTransform() {} });
			if (k === 'getLineDash') return () => [];
			if (k === 'getImageData' || k === 'createImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(4 * (w ?? x) * (h ?? y)) });
			return () => {};
		},
		set(t, k, v) { t[k] = v; return true; },
	});
	getCtx = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function () { return (this.__ctx ??= noop()); };
});
afterEach(() => {
	HTMLCanvasElement.prototype.getContext = getCtx;
	localStorage.clear();
});
const wait = (ms) => act(() => new Promise((r) => setTimeout(r, ms)));

test('classic Dijkstra with Quack walled in: red no-path story in the pill', async () => {
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ chrome: 'light', cells: 'paper', speed: 'light' }));
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	await wait(50);
	const end = document.querySelector('.legacy-mirror td[class*="_ending"]');
	const [r, c] = end.id.split('-').map(Number);
	for (const [a, b] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
		const td = document.getElementById(`${r + a}-${c + b}`);
		td.className = td.className.replace('unvisited', 'wall');
	}
	await wait(20);
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getAllByRole('option', { name: /^Dijkstra/ })[0]);
	fireEvent.click(screen.getByTestId('go'));
	for (let i = 0; i < 600 && !document.querySelector('.legacy-mirror td[class*="_visited"]'); i++) await wait(10);
	for (let i = 0; i < 1500 && /Pause|Resume/.test(screen.getByTestId('go').textContent); i++) await wait(20);
	await wait(100);
	expect(screen.getByText('Cannot find Quack!')).toBeTruthy();
	const story = screen.getByTestId('story-line');
	expect(linesFor('dijkstra', 'escaped')).toContain(story.textContent);
	expect(story.closest('.pill').getAttribute('data-outcome')).toBe('escaped');
	// open the ring and run again while that toast is still up: a found run stays found
	for (const td of document.querySelectorAll('.legacy-mirror td')) td.className = td.className.replace(/_(wall|visited)\b/, '_unvisited');
	await wait(20);
	expect(screen.getByText('Cannot find Quack!')).toBeTruthy(); // the 6 s toast from the first run
	fireEvent.click(screen.getByTestId('go'));
	for (let i = 0; i < 600 && !document.querySelector('.legacy-mirror td[class*="_visited"]'); i++) await wait(10);
	for (let i = 0; i < 1500 && /Pause|Resume/.test(screen.getByTestId('go').textContent); i++) await wait(20);
	await wait(100);
	const again = screen.getByTestId('story-line');
	expect(linesFor('dijkstra', 'found')).toContain(again.textContent);
	expect(again.closest('.pill').getAttribute('data-outcome')).toBe('found');
}, 60000);
