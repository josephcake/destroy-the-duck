// Prism re-gate G5: a classic run on a portrait phone eases the camera to its path
// before the thread pulls, so the Duck is in view (and her chip gone) at the end.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { linesFor } from '../story';

const size = { width: 390, height: 844 };
let getCtx;
beforeEach(() => {
	HTMLElement.prototype.getBoundingClientRect = function () {
		return { x: 0, y: 0, left: 0, top: 0, right: size.width, bottom: size.height, ...size };
	};
	// a no-op 2D context so the frame loop (and its camera) runs in jsdom
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
	delete HTMLElement.prototype.getBoundingClientRect;
	HTMLCanvasElement.prototype.getContext = getCtx;
	localStorage.clear();
});
const pct = () => parseInt(screen.getByLabelText('Zoom to 100%').textContent, 10);
const wait = (ms) => act(() => new Promise((r) => setTimeout(r, ms)));

test('390 x 844, classic BFS at Fast: ends zoomed out below 75% with the Duck in view and no chip', async () => {
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ chrome: 'light', cells: 'paper', speed: 'fast' }));
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	await wait(50);
	expect(pct()).toBe(75); // the start view
	expect(screen.getAllByTestId('duck-chip')).toHaveLength(1); // Duck 1 is off to the right
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getAllByRole('option', { name: /^Breadth First Search/ })[0]);
	fireEvent.click(screen.getByTestId('go'));
	for (let i = 0; i < 600 && !document.querySelector('.legacy-mirror td[class*="_visited"]'); i++) await wait(10);
	for (let i = 0; i < 1500 && /Pause|Resume/.test(screen.getByTestId('go').textContent); i++) await wait(20);
	await wait(800); // the 420 ms ease
	expect(pct()).toBeLessThan(75);
	expect(screen.queryAllByTestId('duck-chip')).toHaveLength(0);
	// the story line for the classic run, in the pill
	expect(linesFor('breadthFirstSearch', 'found')).toContain(screen.getByTestId('story-line').textContent);
}, 60000);
