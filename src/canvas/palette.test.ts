// Paper v2.1 (style.md §2.1, §7): every contrast figure the spec gives, computed
// with the WCAG formula. Non-text (1.4.11) >= 3:1, text (1.4.3) >= 4.5:1.
import { PALETTES, migrateCellSet, weightColor, weightEdge, weightUnder } from './palette';
import { FLOW_WAVE_ALPHA, PATH_DOT, VISITED_ALPHA, settleRamp, visitedAlphaOf } from './render';

const lum = (h: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = parseInt(h.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** fg over bg at alpha a, as a #rrggbb */
const blend = (fg: string, bg: string, a: number) =>
	'#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
export const contrast = (a: string, b: string) => {
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};
const P = PALETTES['paper-light'], NP = PALETTES['paper-dark'], CL = PALETTES['classic-light'], CD = PALETTES['classic-dark'];

// [what, fg, bg, the spec's figure]
const SPEC: [string, string, string, number][] = [
	['Paper wall', P.wall, P.home, 9.93], ['Night wall', NP.wall, NP.home, 9.16], ['Classic Light wall', CL.wall, CL.home, 13.25], ['Classic Dark wall', CD.wall, CD.home, 9.65],
	['Paper wEdge', P.wEdge, P.home, 4.23], ['Night wEdge', NP.wEdge, NP.home, 5.85], ['Classic Light wEdge', CL.wEdge, CL.home, 3.3], ['Classic Dark wEdge', CD.wEdge, CD.home, 11.89],
	['Paper stamp on w10', P.stamp, P.w[2], 5.6], ['Paper stamp on w2', P.stamp, P.w[0], 9.0], ['Paper stamp on w>=20', P.stamp, P.w[3], 4.9],
	['Night stamp on w10', NP.stamp, NP.w[2], 5.1], ['Night stamp on w2', NP.stamp, NP.w[0], 7.9], ['Night stamp on w>=20', NP.stamp, NP.w[3], 5.81],
	['Classic Light stamp on w10', CL.stamp, CL.w[2], 5.2], ['Classic Light stamp on w2', CL.stamp, CL.w[0], 11.6],
	['Classic Dark stamp on w10', CD.stamp, CD.w[2], 6.0], ['Classic Dark stamp on w2', CD.stamp, CD.w[0], 6.3],
	['Paper visited (single-tint option)', P.vis[1], P.home, 3.31],
	['Classic Light visited', CL.visited, CL.home, 4.08], ['Classic Dark visited', CD.visited, CD.home, 4.49],
	['Paper frontEdge', P.frontEdge, P.home, 3.36], ['Night frontEdge', NP.frontEdge, NP.home, 11.6], ['Classic Light front', CL.front, CL.home, 3.85], ['Classic Dark frontEdge', CD.frontEdge, CD.home, 13.6],
	['Paper thread', P.path, P.home, 5.81], ['Night thread', NP.path, NP.home, 6.39], ['Classic Light thread', CL.path, CL.home, 3.58], ['Classic Dark thread', CD.path, CD.home, 5.24],
	['Paper start', P.start, P.home, 3.5], ['Night start', NP.start, NP.home, 5.23], ['Classic Light start (fill)', CL.start, CL.home, 2.55], ['Classic Dark start', CD.start, CD.home, 5.42],
	['Paper duck edge', P.duckEdge, P.home, 4.85], ['Night duck (body)', NP.duck, NP.home, 8.77], ['Night duck edge (v2.2)', NP.duckEdge, NP.home, 3.77], ['Classic Light duck edge', CL.duckEdge, CL.home, 3.59], ['Classic Dark duck', CD.duck, CD.home, 10.49],
	['Paper onewayEdge', P.onewayFg, P.home, 3.36], ['Night onewayEdge', NP.onewayFg, NP.home, 7.02], ['Classic Light onewayEdge', CL.onewayFg, CL.home, 5.95], ['Classic Dark onewayEdge', CD.onewayFg, CD.home, 9.65],
	['Paper holeDeep', P.hole, P.home, 3.65], ['pair letter (white) on Paper holeDeep', '#ffffff', P.hole, 4.04],
	['Paper tele A', P.pads[0], P.home, 3.52], ['Paper tele B', P.pads[1], P.home, 5.13], ['Night tele A', NP.pads[0], NP.home, 6.76], ['Night tele B', NP.pads[1], NP.home, 5.69],
	['Classic Light tele A', CL.pads[0], CL.home, 3.55], ['Classic Light tele B', CL.pads[1], CL.home, 4.7], ['Classic Dark tele A', CD.pads[0], CD.home, 11.77], ['Classic Dark tele B', CD.pads[1], CD.home, 6.64],
];
test.each(SPEC)('§2.1 %s is %s on %s at the spec figure %s:1', (_w, fg, bg, want) => {
	expect(contrast(fg, bg)).toBeCloseTo(want, 1);
});

describe.each(Object.entries(PALETTES))('%s', (_name, p) => {
	test('walls read against the board (3:1, §2.1)', () => {
		expect(contrast(p.wall, p.home)).toBeGreaterThanOrEqual(3);
	});
	test('visited tints: >= 3:1 except Paper, which is deliberately soft (2.4 to 3.3:1, §2.1)', () => {
		for (const v of p.vis) expect(contrast(v, p.home), v).toBeGreaterThanOrEqual(p.name === 'Paper' ? 2.3 : 3);
	});
	test('every interactive or state mark is >= 3:1 on the board (§7)', () => {
		expect(contrast(p.wEdge, p.home)).toBeGreaterThanOrEqual(3);
		expect(contrast(p.frontEdge, p.home)).toBeGreaterThanOrEqual(3);
		expect(contrast(p.onewayFg, p.home)).toBeGreaterThanOrEqual(3);
		expect(contrast(p.path, p.home)).toBeGreaterThanOrEqual(3);
		expect(Math.max(contrast(p.duck, p.home), contrast(p.duckEdge, p.home))).toBeGreaterThanOrEqual(3);
		// start tab: the fill, or (Classic Light) its 1dp outline
		expect(Math.max(contrast(p.start, p.home), p.startOutline ? contrast(p.startOutline, p.home) : 0)).toBeGreaterThanOrEqual(3);
	});
	test('teleporter pairs: >= 3:1 each, all distinct, pad = pads[0]', () => {
		expect(p.pads[0]).toBe(p.pad);
		for (const c of p.pads) expect(contrast(c, p.home), c).toBeGreaterThanOrEqual(3);
		expect(new Set(p.pads).size).toBe(p.pads.length);
	});
	test('weight stamps are >= 4.5:1 on every sheet they can land on (text)', () => {
		for (const w of p.w) expect(contrast(p.stamp, w), w).toBeGreaterThanOrEqual(4.5);
	});
	test('weights: one sheet colour per tier, stack edge 3:1, under sheets darker than tops', () => {
		expect(weightEdge(p, 5)).toBe(p.wEdge);
		expect(new Set([2, 5, 10].map((w) => weightColor(p, w))).size).toBe(3);
		for (const w of [2, 5, 10]) expect(lum(weightUnder(p, w))).toBeLessThan(lum(weightColor(p, w)));
	});
	test("the opt-in classic window outline (3:1) and labels (4.5:1) read on the sheet", () => {
		expect(contrast(p.label, p.home)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(p.homeLine, p.home)).toBeGreaterThanOrEqual(3);
	});
	test('minimal (2026-11-22): the grid is a quiet hairline, under 1.35:1 on the board', () => {
		expect(contrast(p.grid, p.home)).toBeLessThan(1.35);
		expect(contrast(p.grid, p.home)).toBeGreaterThan(1.05);
	});
	test('minimal: the visited dash (blended at VISITED_ALPHA) reads (>= 3:1, WCAG 1.4.11) but stays quieter than walls and the path', () => {
		const dash = contrast(blend(p.visited, p.home, visitedAlphaOf(p)), p.home);
		// every palette >= 3:1 (Mochi, qa batch): Classic Light keeps its pinned colour and
		// draws the dash at .85 (3.23; was 2.98 at .8), still quieter than its path (3.58)
		expect(dash).toBeGreaterThanOrEqual(3);
		expect(dash).toBeLessThan(contrast(p.wall, p.home));
		expect(dash).toBeLessThan(contrast(p.path, p.home));
	});
	test('minimal: the frontier tick (frontEdge) is non-text readable, >= 3:1', () => {
		expect(contrast(p.frontEdge, p.home)).toBeGreaterThanOrEqual(3);
	});
});

test('§9 #3: stored Pond prefs migrate to Paper', () => {
	expect(migrateCellSet('pond')).toBe('paper');
	expect(migrateCellSet('paper')).toBe('paper');
	expect(migrateCellSet('classic')).toBe('classic');
	expect(migrateCellSet(undefined)).toBe('paper');
});
test('Classic Dark retires the #626262 board for #24242a / #c9cbe3 walls', () => {
	expect(CD.home).toBe('#24242a');
	expect(CD.wall).toBe('#c9cbe3');
});

test('Prism review must-fix 3 (spec v2.2): the Night Paper duck edge carries 3:1 on its own, not just via the body', () => {
	expect(PALETTES['paper-dark'].duckEdge).toBe('#a37a18');
	expect(contrast(PALETTES['paper-dark'].duckEdge, PALETTES['paper-dark'].home)).toBeGreaterThanOrEqual(3);
});

// Prism search-motion spec §2: cost bands and the settle ramp, blended over home
describe.each([['Paper', P], ['Night Paper', NP]] as const)('search motion: %s', (_n, p) => {
	test('both band tints read at .8 (>= 3:1), at the spec figures', () => {
		expect(contrast(blend(p.visited, p.home, VISITED_ALPHA), p.home)).toBeGreaterThanOrEqual(3);
		expect(contrast(blend(p.visitedBand, p.home, VISITED_ALPHA), p.home)).toBeGreaterThanOrEqual(3);
		expect(contrast(blend(p.visitedBand, p.home, VISITED_ALPHA), p.home)).toBeCloseTo(p === P ? 3.85 : 4.35, 1);
	});
	test('every step of the settle ramp (frontEdge -> visited, alpha 1 -> .8) is >= 3:1', () => {
		const ramp = settleRamp(p);
		expect(ramp).toHaveLength(8);
		const min = Math.min(...ramp.map((c, b) => contrast(blend(c, p.home, 1 - (1 - VISITED_ALPHA) * ((b + 0.5) / 8)), p.home)));
		expect(min).toBeGreaterThanOrEqual(3);
	});
});

// Prism one-way spec §2: the chevrons carry the cue on the board and on the .45 tile
describe.each([['Paper', P, 4.91, 4.42], ['Night Paper', NP, 8.81, 6.91]] as const)('one-way flow: %s', (_n, p, onHome, onTile) => {
	test('flow chevrons are >= 3:1 on home and on the tile, at the spec figures', () => {
		const tile = blend(p.oneway, p.home, 0.45);
		expect(contrast(p.flow, p.home)).toBeCloseTo(onHome, 1);
		expect(contrast(p.flow, tile)).toBeCloseTo(onTile, 1);
		expect(Math.min(contrast(p.flow, p.home), contrast(p.flow, tile))).toBeGreaterThanOrEqual(3);
	});
	test('during a wave the chevrons step back to FLOW_WAVE_ALPHA and still hold 3:1 on the tile and on home', () => {
		const tile = blend(p.oneway, p.home, 0.45);
		expect(contrast(blend(p.flow, tile, FLOW_WAVE_ALPHA), tile)).toBeGreaterThanOrEqual(3);
		expect(contrast(blend(p.flow, p.home, FLOW_WAVE_ALPHA), p.home)).toBeGreaterThanOrEqual(3);
	});
});
test('Paper wave chevrons at the gate figures: 3.11 on the tile, 3.35 on home (Prism gate must-fix 3)', () => {
	const tile = blend(P.oneway, P.home, 0.45);
	expect(contrast(blend(P.flow, tile, FLOW_WAVE_ALPHA), tile)).toBeCloseTo(3.11, 1);
	expect(contrast(blend(P.flow, P.home, FLOW_WAVE_ALPHA), P.home)).toBeCloseTo(3.35, 1);
});
test('Classic palettes: no band tint (= visited), flow = the existing onewayFg', () => {
	for (const p of [CL, CD]) {
		expect(p.visitedBand).toBe(p.visited);
		expect(p.flow).toBe(p.onewayFg);
	}
});

// Path dots (Joseph 2026-11-22): a path-colour dot in a home-colour halo, over the visited dashes.
// The dot reads against its halo (= the board) and the halo edge reads against the dash it sits on;
// path vs dash directly is a hue difference (listed, not gated), carried by the halo and the size.
describe.each([['Paper', P, 5.81, 3.45], ['Night', NP, 6.39, 3.33], ['Classic Light', CL, 3.58, 3.23], ['Classic Dark', CD, 5.24, 3.37]] as const)('path dots: %s', (_n, p, dotOnBoard, haloOnDash) => {
	const dash = blend(p.visited, p.home, visitedAlphaOf(p));
	test('dot vs board (its halo) and halo vs the visited dash are both >= 3:1', () => {
		expect(contrast(p.path, p.home)).toBeCloseTo(dotOnBoard, 1);
		expect(contrast(p.home, dash)).toBeCloseTo(haloOnDash, 1);
		expect(Math.min(contrast(p.path, p.home), contrast(p.home, dash))).toBeGreaterThanOrEqual(3);
	});
});
test('path dots stay clearly bigger than the visited dash width, at desktop 56 % and phone 75 %', () => {
	for (const s of [20 * 0.56, 20 * 0.75, 20]) {
		const dotD = 2 * Math.max(PATH_DOT.rMin, PATH_DOT.r * s);
		const dashW = Math.max(1.5, 0.1 * s);
		expect(dotD).toBeGreaterThanOrEqual(2.3 * dashW);
	}
});

test('Prism PD1: the dark themes light the pulse core near-white, a clear step over the settled dot; light themes keep the derived core', () => {
	// the specified near-white cores: 2.13 / 2.64 (pure white would give Prism's 2.31 / 2.95 ceiling)
	expect(contrast(NP.pulse!.hi, NP.path)).toBeGreaterThanOrEqual(2.1);
	expect(contrast(CD.pulse!.hi, CD.path)).toBeGreaterThanOrEqual(2.6);
	for (const q of [NP, CD]) expect(q.pulse).toMatchObject({ core: 0.8, grow: 0.5, glowA: 0.35, glowR: 0.27 });
	expect(P.pulse).toBeUndefined();
	expect(CL.pulse).toBeUndefined();
});
