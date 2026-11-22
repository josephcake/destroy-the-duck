import { frontierAlpha } from './render';
test('frontier pulse breathes between 0.55 and 1 every 900 ms', () => {
	const xs = Array.from({ length: 90 }, (_, i) => frontierAlpha(i * 10));
	expect(Math.min(...xs)).toBeCloseTo(0.55, 2);
	expect(Math.max(...xs)).toBeCloseTo(1, 2);
	expect(frontierAlpha(123)).toBeCloseTo(frontierAlpha(123 + 900), 6);
});
