// Fix 2: WCAG contrast for what the board needs you to see.
// Non-text (1.4.11) >= 3:1, text (1.4.3) >= 4.5:1.
import { PALETTES, weightEdge } from './palette';

const lum = (h: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = parseInt(h.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};

describe.each(Object.entries(PALETTES))('%s', (_name, p) => {
	test('walls stand out from unvisited and visited cells (3:1)', () => {
		expect(contrast(p.wall, p.home)).toBeGreaterThanOrEqual(3);
		expect(contrast(p.wall, p.visited)).toBeGreaterThanOrEqual(3);
	});
	test.each([2, 5, 10])('weight %i edge reads against the board (3:1)', (w) => {
		expect(contrast(weightEdge(p, w), p.home)).toBeGreaterThanOrEqual(3);
	});
	test('HOME outline (3:1) and label (4.5:1) read against the paper', () => {
		expect(contrast(p.homeLine, p.paper)).toBeGreaterThanOrEqual(3);
		expect(contrast(p.label, p.paper)).toBeGreaterThanOrEqual(4.5);
	});
	test('the frontier ring reads against the board (3:1)', () => {
		expect(contrast(p.front, p.home)).toBeGreaterThanOrEqual(3);
	});
});

test('Prism P4: the visited wave stays visible against the board (>= 1.5:1 at full, pond presets)', () => {
	expect(contrast(PALETTES['pond-light'].visited, PALETTES['pond-light'].home)).toBeGreaterThanOrEqual(1.5);
	expect(contrast(PALETTES['pond-dark'].visited, PALETTES['pond-dark'].home)).toBeGreaterThanOrEqual(2);
});

// Prism P3: the cost label picks ink or white by fill luminance.
import { labelOn, weightColor } from './palette';
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const parse = (c: string) => (c.startsWith('#') ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g)!.map(Number));
const over = (rgba: string, bg: string) => {
	const [r, g, b, a] = parse(rgba);
	const B = parse(bg);
	return toHex([r, g, b].map((v, i) => v * a + B[i] * (1 - a)));
};
describe.each(Object.entries(PALETTES))('%s weight labels', (_n, p) => {
	test.each([2, 5, 10])('label on weight %i reads at >= 3:1', (w) => {
		const fill = toHex(parse(weightColor(p, w)));
		expect(contrast(over(labelOn(fill), fill), fill)).toBeGreaterThanOrEqual(3);
	});
});
