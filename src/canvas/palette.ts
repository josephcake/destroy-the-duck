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
	highlight: string; // wall top highlight
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
		homeLine: '#8e887a',
		wall: '#1c2230',
		visited: '#bfe3dc',
		front: '#2f9c8d',
		path: '#e0442a',
		ink: '#1c2230',
		wLo: '#efe2c8',
		wHi: '#a77a4c',
		water: '#3a8cc2',
		highlight: 'rgba(255,255,255,0.55)',
		shadow: 'rgba(0,0,0,0.18)',
		label: '#5f6676',
	},
	'pond-dark': {
		...BASE,
		name: 'Night Pond',
		paper: '#0f141b',
		home: '#151b24',
		grid: '#1b2230',
		outerGrid: '#161c26',
		homeLine: '#667085',
		wall: '#cfd6e2',
		visited: '#1d4743',
		front: '#3ed1b8',
		path: '#ff6347',
		ink: '#eef1f6',
		wLo: '#2a2a22',
		wHi: '#9a7650',
		water: '#3c86b8',
		highlight: 'rgba(255,255,255,0.22)',
		shadow: 'rgba(0,0,0,0.45)',
		label: '#8b94a3',
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
		front: '#EA00FF',
		path: '#FF6347',
		ink: '#1c2230',
		wLo: '#efe2c8',
		wHi: '#a77a4c',
		water: '#3a8cc2',
		highlight: 'rgba(255,255,255,0.55)',
		shadow: 'rgba(0,0,0,0.18)',
		label: '#5f6676',
	},
	'classic-dark': {
		...BASE,
		name: 'Classic Dark',
		paper: '#0f141b',
		home: '#373737',
		grid: '#1E1D1D',
		outerGrid: '#161c26',
		homeLine: '#667085',
		wall: '#04042C',
		visited: '#5E9178',
		front: '#00FFBB',
		path: '#FF6347',
		ink: '#eef1f6',
		wLo: '#2a2a22',
		wHi: '#9a7650',
		water: '#3c86b8',
		highlight: 'rgba(255,255,255,0.22)',
		shadow: 'rgba(0,0,0,0.45)',
		label: '#8b94a3',
	},
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Weight tint: log2(w)/log2(20) along wLo -> wHi; water (10) has its own colour. */
export function weightColor(p: Palette, w: number) {
	if (w === 10) return p.water;
	const t = Math.log2(w) / Math.log2(20);
	const a = hex(p.wLo);
	const b = hex(p.wHi);
	const m = a.map((x, i) => Math.round(x + (b[i] - x) * t));
	return `rgb(${m[0]},${m[1]},${m[2]})`;
}

export function mix(c1: string, c2: string, t: number) {
	const a = hex(c1);
	const b = hex(c2);
	const m = a.map((x, i) => Math.round(x + (b[i] - x) * t));
	return `rgb(${m[0]},${m[1]},${m[2]})`;
}
