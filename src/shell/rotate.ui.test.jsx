// "Turn your phone sideways": portrait touch phones only, gone in landscape,
// and "Continue anyway" is remembered.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import { PORTRAIT_PHONE, ROTATE_KEY, shouldPromptRotate } from './RotatePrompt';

let portrait = true;
const listeners = new Set();
const orig = window.matchMedia;
beforeEach(() => {
	localStorage.clear();
	portrait = true;
	listeners.clear();
	window.matchMedia = (q) => ({
		get matches() {
			if (q === PORTRAIT_PHONE) return portrait;
			if (q === '(max-width: 599px)') return portrait;
			if (q.includes('orientation: landscape')) return !portrait;
			return false;
		},
		media: q,
		addEventListener: (_t, f) => listeners.add(f),
		removeEventListener: (_t, f) => listeners.delete(f),
	});
});
afterEach(() => {
	window.matchMedia = orig;
});
const mount = () =>
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
const turn = (isPortrait) => {
	portrait = isPortrait;
	act(() => listeners.forEach((f) => f()));
};

test('the rule: a portrait touch phone, until dismissed', () => {
	expect(shouldPromptRotate(true, false)).toBe(true);
	expect(shouldPromptRotate(false, false)).toBe(false);
	expect(shouldPromptRotate(true, true)).toBe(false);
	expect(PORTRAIT_PHONE).toBe('(pointer: coarse) and (max-width: 599px) and (orientation: portrait)');
});

test('shows in portrait, with a rotate icon and a Continue anyway button', () => {
	mount();
	const dlg = screen.getByTestId('rotate-prompt');
	expect(dlg.textContent).toMatch(/Turn your phone sideways/);
	expect(dlg.querySelector('svg.rotate__icon')).toBeTruthy();
	expect(screen.getByRole('button', { name: 'Continue anyway' })).toBeTruthy();
});

test('hides by itself when the phone turns to landscape, and comes back upright', () => {
	mount();
	expect(screen.queryByTestId('rotate-prompt')).toBeTruthy();
	turn(false);
	expect(screen.queryByTestId('rotate-prompt')).toBeNull();
	turn(true);
	expect(screen.queryByTestId('rotate-prompt')).toBeTruthy();
});

test('never shows in landscape', () => {
	portrait = false;
	mount();
	expect(screen.queryByTestId('rotate-prompt')).toBeNull();
});

test('Continue anyway hides it and the dismissal persists across reloads', () => {
	const first = mount();
	fireEvent.click(screen.getByTestId('rotate-continue'));
	expect(screen.queryByTestId('rotate-prompt')).toBeNull();
	expect(localStorage.getItem(ROTATE_KEY)).toBe('1');
	first.unmount();
	mount(); // a fresh visit, still portrait
	expect(screen.queryByTestId('rotate-prompt')).toBeNull();
	turn(false);
	turn(true);
	expect(screen.queryByTestId('rotate-prompt')).toBeNull();
});
