// Portrait phones are a real layout (2026-11-22): no "turn your phone" prompt, and
// the thumb bar carries Go and the four draw tools (Wall, Checkpoint, Erase, Pan).
import { render, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';
import fs from 'fs';
import path from 'path';

const orig = window.matchMedia;
const width = window.innerWidth;
beforeEach(() => {
	localStorage.clear();
	window.innerWidth = 390; // the panel starts closed below 1024 px
	window.matchMedia = (q) => ({
		matches: q === '(max-width: 599px)' || q.includes('pointer: coarse') || (q.includes('orientation: portrait') && !q.includes('landscape')),
		media: q,
		addEventListener: () => {},
		removeEventListener: () => {},
	});
});
afterEach(() => {
	window.matchMedia = orig;
	window.innerWidth = width;
});

test('portrait phone: no rotate prompt, and the bar has Go and Wall, Checkpoint, Erase, Pan', () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	expect(screen.queryByTestId('rotate-prompt')).toBeNull();
	expect(screen.queryByText(/Turn your phone/)).toBeNull();
	const bar = document.querySelector('.mini');
	const labels = [...bar.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label'));
	expect(labels).toEqual(['Open panel', 'Wall', 'Checkpoint', 'Erase', 'Pan']);
	expect(bar.querySelector('[data-testid="go"]')).toBeTruthy();
});

test('shell.css: portrait puts the bar at the bottom, clear of the home bar, and keeps 44 px taps', () => {
	const css = fs.readFileSync(path.join(__dirname, 'shell.css'), 'utf8');
	const phone = css.slice(css.indexOf('/* Safe areas'));
	expect(phone).toMatch(/\.mini \{[^}]*bottom: calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
	expect(phone).toMatch(/\.pill, \.inspector, \.landing \{ top: calc\(8px \+ env\(safe-area-inset-top\)\)/);
	expect(css).toMatch(/\.icon-btn, \.mini \.go \{ min-width: 44px; height: 44px; \}/);
	expect(css).not.toMatch(/\.rotate/);
	expect(fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8')).toMatch(/viewport-fit=cover/);
});
