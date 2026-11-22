// Rules that live in CSS and that jsdom cannot hit-test: read them from the sheet.
import { readFileSync } from 'node:fs';

const css = readFileSync(`${process.cwd()}/src/shell/shell.css`, 'utf8');
const rule = (sel) => {
	const i = css.indexOf(`${sel} {`);
	expect(i, sel).toBeGreaterThanOrEqual(0);
	return css.slice(i, css.indexOf('}', i));
};

test('Prism gate: the landing card lets clicks through to the board except on its buttons', () => {
	expect(rule('.landing')).toMatch(/pointer-events: none/);
	expect(rule('.landing button, .landing a')).toMatch(/pointer-events: auto/);
});

test('§2.2: the shell aliases resolve to kit tokens', () => {
	const app = rule('.app');
	for (const [a, b] of [['--paper', '--pk-table'], ['--panel', '--pk-card-ui'], ['--raised', '--pk-card-ui-2'], ['--line', '--pk-edge'], ['--ink', '--pk-ink'], ['--sel', '--pk-sel'], ['--duck', '--pk-accent']])
		expect(app).toContain(`${a}: var(${b})`);
});

test('§6: buttons press by the kit depth (3 px, Go! 4 px); no Bricolage / Instrument Sans left', () => {
	expect(css).toMatch(/translateY\(var\(--pk-press\)\)/);
	expect(rule('.go:active:not(:disabled)')).toMatch(/translateY\(var\(--pk-press-action\)\)/);
	expect(css).not.toMatch(/Bricolage|Instrument Sans/);
});
