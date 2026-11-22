// Cell palettes: Prism "Paper Cutout" v2.1 colours (style.md §2.1), drawn
// minimal since 2026-11-22 (Joseph: "turn the dots to dashes … more minimal"):
// flat board, hairline grid, flat walls, one thin dash per visited cell.
// Classic Light/Dark keep the classic colours.
export type Chrome = 'light' | 'dark';
export type CellSet = 'paper' | 'classic';

export type Palette = {
	name: string;
	classic: boolean;
	paper: string; // "table": canvas outside Home
	home: string; // the Home sheet (board)
	grid: string; // crisp grid (Classic) / table grid
	outerGrid: string; // grid lines outside Home
	/** grid dash pattern in cells ([on, off]), or null for solid hairlines */
	gridDash: number[] | null;
	sheetShadow: string;
	homeLine: string; // dashed Home outline (Classic only)
	label: string; // HOME label
	ink: string;
	wall: string; // top ply
	cut: string;
	cutTL: string;
	shadow: string; // cast
	contact: string;
	/** Weight top sheets for cost 2 / 5 / 10 (/ >= 20), under sheets, 1dp edge, stamp. */
	w: string[];
	wUnder: string[];
	wEdge: string;
	stamp: string;
	vis: [string, string, string]; // visited confetti tints
	visited: string; // = vis[1], for legends and contrast checks
	/** alpha of the settled dash (default .8); Classic Light draws at .85 so its pinned colour reaches 3:1 (3.23) and stays under the path (3.58) */
	visitedAlpha?: number;
	visitedBand: string; // cost band 1 (motion spec §2): every other 8 cost units, >= 3:1 at .8
	flow: string; // one-way chevrons (one-way spec §2): >= 3:1 on home and on the .45 tile
	front: string;
	frontEdge: string;
	path: string; // the thread
	pulse?: { hi: string; core: number; grow: number; glowA: number; glowR: number }; // dark themes: lit core colour, core share of r, swell, glow alpha, glow reach (cells)
	start: string;
	arrowBack: string;
	startOutline: string | null; // Classic Light: 1dp outline (fill is 2.55:1)
	duck: string;
	duckWing: string;
	duckEdge: string;
	beak: string;
	beak2: string;
	eye: string;
	oneway: string;
	onewayFg: string; // onewayEdge: chevron hole edge, >= 3:1
	hole: string; // holeDeep
	holeShadow: string;
	pad: string; // = pads[0]
	pads: string[]; // teleporter pair colours (A, B, then extra pairs), each >= 3:1
	sticker: string;
	stickerEdge: string;
};

export const PALETTES: Record<`${CellSet}-${Chrome}`, Palette> = {
	'paper-light': {
		name: 'Paper', classic: false,
		paper: '#e6dbc4', home: '#f8f3e6', grid: '#e4d9c3', outerGrid: '#ddd0b4',
		gridDash: null,
		sheetShadow: 'rgba(92,66,28,0.22)', homeLine: '#7d6f57', label: '#4f4536', ink: '#2b2620',
		wall: '#2f3b5e', cut: '#8c9bc4', cutTL: '#b3c0e2',
		shadow: 'rgba(84,58,22,0.30)', contact: 'rgba(84,58,22,0.38)',
		w: ['#f2d9a6', '#e9b673', '#e3a066', '#dc9258'], wUnder: ['#d9b97f', '#c8964f', '#b67836', '#b8743c'], wEdge: '#9a6a33', stamp: '#5a2410',
		vis: ['#4fa092', '#3f9384', '#62ad9f'], visited: '#2a7366', visitedBand: '#3d5f8a', flow: '#4f6b94',
		front: '#f6cd78', frontEdge: '#b07a1c', path: '#b02e22',
		start: '#e0522a', arrowBack: '#f39a76', startOutline: null,
		duck: '#f5c02c', duckWing: '#e2a412', duckEdge: '#8a6410', beak: '#e8701c', beak2: '#c4541a', eye: '#1f1b16',
		oneway: '#cfdbe8', onewayFg: '#6f86a6', hole: '#8f7c58', holeShadow: 'rgba(40,24,6,0.6)',
		pad: '#2f8f83', pads: ['#2f8f83', '#8a4f9e', '#b4410c', '#b91c1c', '#1d4ed8', '#a21caf'],
		sticker: '#fffaf0', stickerEdge: '#d6c8aa',
	},
	'paper-dark': {
		name: 'Night Paper', classic: false,
		paper: '#10172d', home: '#1c2648', grid: '#2b3866', outerGrid: '#1a2240',
		gridDash: null,
		sheetShadow: 'rgba(0,0,0,0.45)', homeLine: '#8b94b8', label: '#c9cfe6', ink: '#f3ecdc',
		wall: '#dccaa2', cut: '#fff4d8', cutTL: '#fffaf0',
		shadow: 'rgba(2,5,16,0.55)', contact: 'rgba(2,5,16,0.60)',
		w: ['#4a4766', '#7a5a52', '#93583a', '#8a4f33'], wUnder: ['#36344f', '#5c433d', '#6f412a', '#6a3a24'], wEdge: '#c99a6a', stamp: '#fff1dc',
		vis: ['#4aa89c', '#3f9a8f', '#56b5a8'], visited: '#3f9a8f', visitedBand: '#7fa6e0', flow: '#b8c8ec',
		front: '#d9a24a', frontEdge: '#ffe0a0', path: '#ff8a66',
		pulse: { hi: '#fff3f0', core: 0.8, grow: 0.5, glowA: 0.35, glowR: 0.27 },
		start: '#ff6b3d', arrowBack: '#ffb092', startOutline: null,
		duck: '#f5c02c', duckWing: '#e2a412', duckEdge: '#a37a18', beak: '#ff8a3d', beak2: '#d9631f', eye: '#1f1b16',
		oneway: '#3b4c7a', onewayFg: '#9fb3dd', hole: '#070b1c', holeShadow: 'rgba(0,0,0,0.85)',
		pad: '#4fc1b2', pads: ['#4fc1b2', '#c58ae0', '#fdba74', '#fca5a5', '#93c5fd', '#f0abfc'],
		sticker: '#fff6e6', stickerEdge: '#c9b993',
	},
	'classic-light': {
		name: 'Classic Light', classic: true,
		paper: '#f6f4ee', home: '#D3D3D3', grid: '#bdbdbd', outerGrid: '#ebe7dc',
		gridDash: null,
		sheetShadow: 'rgba(0,0,0,0.18)', homeLine: '#5e5a50', label: '#3a4152', ink: '#1c2230',
		wall: '#04042C', cut: '#ffffff', cutTL: '#ffffff',
		shadow: 'rgba(0,0,0,0.28)', contact: 'rgba(0,0,0,0.30)',
		w: ['#e8dcc0', '#d4b483', '#c08a4a'], wUnder: ['#cfc2a4', '#b8955f', '#9c6c34'], wEdge: '#8e6a2e', stamp: '#3a1a08',
		vis: ['#7C4DA2', '#7C4DA2', '#7C4DA2'], visited: '#7C4DA2', visitedAlpha: 0.85, visitedBand: '#7C4DA2', flow: '#3b4a66',
		front: '#b000c4', frontEdge: '#b000c4', path: '#c23a1e',
		start: '#e94c0e', arrowBack: '#f6a07e', startOutline: '#7a2406',
		duck: '#ffd000', duckWing: '#e6b800', duckEdge: '#8a6410', beak: '#e8701c', beak2: '#c4541a', eye: '#1f1b16',
		oneway: '#e3e8f0', onewayFg: '#3b4a66', hole: '#a9a9a9', holeShadow: 'rgba(0,0,0,0.35)',
		pad: '#00796b', pads: ['#00796b', '#8e24aa', '#8a3410', '#8f1b1b', '#1e3a8a', '#7a1782'],
		sticker: '#ffffff', stickerEdge: '#9e9e9e',
	},
	'classic-dark': {
		name: 'Classic Dark', classic: true,
		paper: '#141418', home: '#24242a', grid: '#34343c', outerGrid: '#1c1c22',
		gridDash: null,
		sheetShadow: 'rgba(0,0,0,0.5)', homeLine: '#9a9cb4', label: '#c9cbe3', ink: '#eef1f6',
		wall: '#c9cbe3', cut: '#ffffff', cutTL: '#ffffff',
		shadow: 'rgba(0,0,0,0.55)', contact: 'rgba(0,0,0,0.60)',
		w: ['#5d5848', '#7a6a4c', '#2f5f80'], wUnder: ['#4a463a', '#5f523b', '#244a64'], wEdge: '#e6e3c8', stamp: '#f4f1e2',
		vis: ['#3f9a7a', '#3f9a7a', '#3f9a7a'], visited: '#3f9a7a', visitedBand: '#3f9a7a', flow: '#c9cbe3',
		front: '#00FFBB', frontEdge: '#b8ffe9', path: '#FF6347',
		pulse: { hi: '#ffefed', core: 0.8, grow: 0.5, glowA: 0.35, glowR: 0.27 },
		start: '#ff6a3d', arrowBack: '#ffb092', startOutline: null,
		duck: '#ffd000', duckWing: '#e6b800', duckEdge: '#ffd000', beak: '#ff8a3d', beak2: '#d9631f', eye: '#1f1b16',
		oneway: '#4a4a55', onewayFg: '#c9cbe3', hole: '#141418', holeShadow: 'rgba(0,0,0,0.6)',
		pad: '#00FFBB', pads: ['#00FFBB', '#ff7ad9', '#fed7aa', '#fecaca', '#bfdbfe', '#f5d0fe'],
		sticker: '#f4f4f6', stickerEdge: '#9a9cb4',
	},
};

/** Stored prefs from the Pond era said cells: 'pond'; that is Paper now. */
export const migrateCellSet = (v: unknown): CellSet => (v === 'classic' ? 'classic' : 'paper');

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Weight tier: 2 -> 0, 5 -> 1, 10 -> 2, >= 20 -> 3 (sheet count - 1). */
export const weightTier = (w: number) => (w >= 20 ? 3 : w >= 10 ? 2 : w >= 5 ? 1 : 0);
/** Top-sheet colour for a cost (Classic has three tiers; >= 20 uses the top one). */
export const weightColor = (p: Palette, w: number) => p.w[Math.min(weightTier(w), p.w.length - 1)];
export const weightUnder = (p: Palette, w: number) => p.wUnder[Math.min(weightTier(w), p.wUnder.length - 1)];
export const weightEdge = (p: Palette, _w?: number) => p.wEdge;

/** WCAG relative luminance of '#rrggbb' or 'rgb(r,g,b)'. */
export function luminance(color: string) {
	const m = color.startsWith('#') ? hex(color) : (color.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
	const [r, g, b] = m.map((v) => {
		const x = v / 255;
		return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cost label: ink 72% on light fills, white 80% on dark ones (design §4b). */
export const labelOn = (fill: string) => (luminance(fill) > 0.35 ? 'rgba(28,34,48,0.72)' : 'rgba(255,255,255,0.8)');

const rgb = (c: string) => (c.startsWith('#') ? hex(c) : (c.match(/\d+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number));
export function mix(c1: string, c2: string, t: number) {
	const a = rgb(c1);
	const b = rgb(c2);
	const m = a.map((x, i) => Math.round(x + (b[i] - x) * t));
	return `rgb(${m[0]},${m[1]},${m[2]})`;
}
