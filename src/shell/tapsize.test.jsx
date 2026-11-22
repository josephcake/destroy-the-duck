// Prism deploy gate (must-fix): phone tap targets >= 44px (WCAG 2.5.5, design §6).
// jsdom has no layout, so this pins the phone media rules and the markup; the
// real 390px measurement is /tmp/pw/tap.mjs (shots/c3).
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/shell/shell.css'), 'utf8');
const phone = (() => {
	const i = css.indexOf('@media (max-width: 599px)');
	let depth = 0;
	for (let j = css.indexOf('{', i); j < css.length; j++) {
		if (css[j] === '{') depth++;
		if (css[j] === '}' && --depth === 0) return css.slice(i, j + 1);
	}
	return '';
})();
const rule = (sel) => (phone.match(new RegExp(`(^|\\n)\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)) ?? [])[2] ?? '';
const px = (decl, prop) => Number((decl.match(new RegExp(`${prop}:\\s*(\\d+)px`)) ?? [])[1] ?? 0);

test('phone: buttons and selects (Clear Board/Wall/Path, Generate, Maze) are at least 44px tall', () => {
	expect(px(rule('.btn, .select'), 'min-height')).toBeGreaterThanOrEqual(44);
	expect(px(rule('.icon-btn, .mini .go'), 'height')).toBeGreaterThanOrEqual(44); // Pin is an icon-btn
});

test('phone: footer links get 12px above and below (20px line + 24 = 44px), centred with the name', () => {
	expect(rule('.panel__foot a')).toMatch(/padding:\s*12px 0/);
	expect(rule('.panel__foot')).toMatch(/align-items:\s*center/);
});

test('Pin has no inline size, so the phone 44px icon-btn rule applies', () => {
	localStorage.clear();
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const pin = screen.getByLabelText('Pin legend to canvas');
	expect(pin.getAttribute('style')).toBeNull();
	expect(pin).toHaveClass('icon-btn');
	for (const name of ['Board', 'Wall', 'Path']) expect(screen.getAllByRole('button', { name }).some((b) => b.classList.contains('btn'))).toBe(true);
	expect(screen.getByTestId('generate')).toHaveClass('btn');
	expect(screen.getByLabelText('Maze')).toHaveClass('select');
});
