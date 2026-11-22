// Cell palettes (Prism design.md §2 / §4b). Classic values are today's colours.
export type Chrome = 'light' | 'dark';
export type CellSet = 'pond' | 'classic';

export type Palette = {
	name: string;
	paper: string; // canvas outside Home
	home: string; // Home dock fill
	grid: string; // grid lines inside Home
	outerGrid: string; // grid lines outside Home
	homeLine: string;
	wall: string;
	visited: string;
	front: string;
	path: string;
	start: string;
	duck: string;
	ink: string;
	wLo: string;
	wHi: string;
	water: string;
	/** Weight cell edges (2, 5, 10): >= 3:1 against `home` (WCAG 1.4.11). */
	wEdge: [string, string, string];
	highlight: string; // wall top highlight (1dp, up-facing edges)
	wallDown: string; // wall inner down edge (1dp)
	wallOutline?: string; // optional 1dp outline (Classic Dark)
	shadow: string;
	label: string;
};

const BASE = { start: '#e94c0e', duck: '#ffd000' };

export const PALETTES: Record<`${CellSet}-${Chrome}`, Palette> = {
	'pond-light': {
		...BASE,
		name: 'Pond',
		paper: '#f6f4ee',
		home: '#fffdf8',
		grid: '#e6e1d4',
		outerGrid: '#ebe7dc',
		homeLine: '#7d776a',
		wall: '#1c2230',
		visited: '#a6d7cd',
		front: '#2f9c8d',
		path: '#e0442a',
		ink: '#1c2230',
		wLo: '#efe2c8',
		wHi: '#a77a4c',
		water: '#3483b7',
		wEdge: ['#b08750', '#8a5a2b', '#2d73a8'],
		highlight: 'rgba(255,255,255,0.55)',
		wallDown: 'rgba(0,0,0,0.28)',
		shadow: 'rgba(28,34,48,0.30)',
		label: '#5f6676',
	},
	'pond-dark': {
		...BASE,
		name: 'Night Pond',
		paper: '#0f141b',
		home: '#151b24',
		grid: '#1b2230',
		outerGrid: '#161c26',
		homeLine: '#8b94a3',
		wall: '#b6c0cf',
		visited: '#235a54',
		front: '#3ed1b8',
		path: '#ff6347',
		ink: '#eef1f6',
		wLo: '#2a2a22',
		wHi: '#9a7650',
		water: '#3c86b8',
		wEdge: ['#c9b98f', '#d9a66a', '#7fc0ea'],
		highlight: 'rgba(255,255,255,0.22)',
		wallDown: 'rgba(0,0,0,0.35)',
		shadow: 'rgba(0,0,0,0.6)',
		label: '#a3acbb',
	},
	'classic-light': {
		...BASE,
		name: 'Classic Light',
		paper: '#f6f4ee',
		home: '#D3D3D3',
		grid: '#F6F6F6',
		outerGrid: '#ebe7dc',
		homeLine: '#8e887a',
		wall: '#04042C',
		visited: '#7C4DA2',
		front: '#b000c4',
		path: '#FF6347',
		ink: '#1c2230',
		wLo: '#efe2c8',
		wHi: '#a77a4c',
		water: '#3483b7',
		wEdge: ['#7a6a4a', '#5d3d1e', '#1f5e8c'],
		highlight: 'rgba(255,255,255,0.55)',
		wallDown: 'rgba(0,0,0,0.28)',
		shadow: 'rgba(0,0,0,0.30)',
		label: '#5f6676',
	},
	'classic-dark': {
		...BASE,
		name: 'Classic Dark',
		paper: '#0f141b',
		home: '#626262',
		grid: '#575757',
		outerGrid: '#161c26',
		homeLine: '#c4cad6',
		wall: '#04042C',
		visited: '#8fd3b2',
		front: '#00FFBB',
		path: '#FF6347',
		ink: '#eef1f6',
		wLo: '#6e6852',
		wHi: '#b08a55',
		water: '#3c86b8',
		wEdge: ['#e6e3c8', '#f0cf9a', '#a8daf7'],
		highlight: 'rgba(255,255,255,0.22)',
		wallOutline: 'rgba(255,255,255,0.14)',
		wallDown: 'rgba(0,0,0,0.35)',
		shadow: 'rgba(0,0,0,0.45)',
		label: '#a3acbb',
	},
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Weight tint: log2(w)/log2(20) along wLo -> wHi; water (10) has its own colour. */
export const weightEdge = (p: Palette, w: number) => p.wEdge[w === 2 ? 0 : w === 5 ? 1 : 2];

const EDGE_DARK: [string, string, string] = ['#6b5c3e', '#5d3d1e', '#1f5e8c'];
const EDGE_LIGHT: [string, string, string] = ['#e6e3c8', '#f0cf9a', '#a8daf7'];
/** Weight edge over a visited cell: dark or light set by the visited colour (>= 3:1). */
export const coveredEdge = (p: Palette, w: number) => (luminance(p.visited) > 0.3 ? EDGE_DARK : EDGE_LIGHT)[w === 2 ? 0 : w === 5 ? 1 : 2];

export function weightColor(p: Palette, w: number) {
	if (w === 10) return p.water;
	const t = Math.log2(w) / Math.log2(20);
	const a = hex(p.wLo);
	const b = hex(p.wHi);
	const m = a.map((x, i) => Math.round(x + (b[i] - x) * t));
	return `rgb(${m[0]},${m[1]},${m[2]})`;
}

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

export function mix(c1: string, c2: string, t: number) {
	const a = hex(c1);
	const b = hex(c2);
	const m = a.map((x, i) => Math.round(x + (b[i] - x) * t));
	return `rgb(${m[0]},${m[1]},${m[2]})`;
}
