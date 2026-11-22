// Mochi fix 6: a resize redoes the last Home/Fit framing unless the user has
// zoomed or panned since; then the zoom is kept (and the centre stays put).
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';

let size = { width: 1200, height: 800 };
const observers = [];
beforeEach(() => {
	size = { width: 1200, height: 800 };
	globalThis.ResizeObserver = class {
		constructor(cb) { this.cb = cb; observers.push(this); }
		observe() {}
		disconnect() {}
	};
	HTMLElement.prototype.getBoundingClientRect = function () {
		return { x: 0, y: 0, left: 0, top: 0, right: size.width, bottom: size.height, ...size };
	};
});
afterEach(() => {
	delete globalThis.ResizeObserver;
	delete HTMLElement.prototype.getBoundingClientRect;
	observers.length = 0;
});
const resize = (width, height) => {
	size = { width, height };
	act(() => observers.forEach((o) => o.cb([])));
};
const pct = () => parseInt(screen.getByLabelText('Zoom to 100%').textContent, 10);

test('resize refits Home until the user zooms; Home re-arms it', () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const big = pct();
	resize(600, 400);
	const small = pct();
	expect(small).toBeLessThan(big); // refit to the smaller stage
	resize(1200, 800);
	expect(pct()).toBe(big); // and back: no stuck 12-20 %
	fireEvent.click(screen.getByLabelText('Zoom in'));
	const manual = pct();
	resize(600, 400);
	expect(pct()).toBe(manual); // manual zoom respected
	fireEvent.click(screen.getByLabelText('Home'));
	expect(pct()).toBe(small);
	resize(1200, 800);
	expect(pct()).toBe(big); // Home re-armed auto-fit
});
