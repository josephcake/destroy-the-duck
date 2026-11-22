// Phase C UI: placing one-way lanes, teleporter pairs and extra ducks, find modes, JPS refusal.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { badgeGeometry } from '../canvas/render';

const at = (r, c) => ({ clientX: c * 20 + 10, clientY: r * 20 + 10, button: 0, pointerId: 1, pointerType: 'mouse' });
const mount = () =>
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
const frame = () => act(() => new Promise((r) => requestAnimationFrame(() => r())));
const click = async (canvas, r, c) => {
	act(() => void fireEvent.pointerDown(canvas, at(r, c)));
	act(() => void fireEvent.pointerUp(canvas, at(r, c)));
	await frame(); // board changes re-render on the next frame
};

test('teleporter tool: two clicks make pair a, a lone pad is called out, a click removes it', async () => {
	mount();
	const canvas = document.querySelector('canvas');
	fireEvent.click(screen.getByTitle('Teleport (T)'));
	await click(canvas, 5, 5);
	expect(screen.getByTestId('lone-pad').textContent).toMatch(/Pad A has no partner/);
	await click(canvas, 5, 30);
	expect(screen.queryByTestId('lone-pad')).toBeNull();
	await click(canvas, 8, 8);
	expect(screen.getByTestId('lone-pad').textContent).toMatch(/Pad B/);
	await click(canvas, 8, 8); // remove it again
	expect(screen.queryByTestId('lone-pad')).toBeNull();
});

test('duck tool adds duck 2 and shows Nearest / All / Tour', async () => {
	mount();
	expect(screen.queryByTestId('find-all')).toBeNull();
	const canvas = document.querySelector('canvas');
	fireEvent.click(screen.getByTitle('Duck (D)'));
	await click(canvas, 30, 10);
	expect(screen.getByTestId('find-all')).toHaveAttribute('aria-pressed', 'true');
	fireEvent.click(screen.getByTestId('find-tour'));
	expect(screen.getByTestId('find-tour')).toHaveAttribute('aria-pressed', 'true');
});

test('a dragged one-way lane makes JPS unavailable, and the UI says why', async () => {
	mount();
	const canvas = document.querySelector('canvas');
	fireEvent.click(screen.getByTitle(/^One-way \(O\)/));
	act(() => void fireEvent.pointerDown(canvas, at(5, 5)));
	for (let c = 6; c <= 9; c++) act(() => void fireEvent.pointerMove(canvas, at(5, c)));
	act(() => void fireEvent.pointerUp(canvas, at(5, 9)));
	await frame();
	fireEvent.click(screen.getByTestId('algo-picker'));
	const jps = screen.getByRole('option', { name: /Jump point/i });
	expect(jps).toBeDisabled();
	expect(jps.getAttribute('title')).toMatch(/one-way lanes/);
});

test('Mochi check 3 + §4.5: duck numbers are legible at every zoom, on the sticker\'s top-right', () => {
	for (const s of [6, 10, 14, 20, 30, 40, 60, 80]) {
		const u = Math.max(1.3 * s, 16);
		const { cx, cy, rad } = badgeGeometry(100, 200, s);
		expect(rad).toBeGreaterThanOrEqual(7); // 9 px digits
		expect(rad).toBeCloseTo(Math.max(7, 0.17 * u));
		expect(cx - 100).toBeCloseTo(0.36 * u);
		expect(cy - 200).toBeCloseTo(-0.38 * u);
	}
});

test('Tour mode spells out the duck order', async () => {
	mount();
	const canvas = document.querySelector('canvas');
	fireEvent.click(screen.getByTitle('Duck (D)'));
	await click(canvas, 30, 10);
	await click(canvas, 5, 40);
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getByRole('option', { name: /^A\*/ }));
	fireEvent.click(screen.getByTestId('find-tour'));
	expect(screen.getByTestId('tour-order').textContent).toBe('Tour: Arrow → 1 → 2 → 3');
	fireEvent.click(screen.getByTestId('find-all'));
	expect(screen.queryByTestId('tour-order')).toBeNull();
});
