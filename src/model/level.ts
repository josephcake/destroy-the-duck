// Warp's level text grid (spec §7.2), MVP subset:
// '.' empty  '#' wall  'S' Arrow  'D' duck  '2' '5' 'X'(=10) weight.
import { Cell } from './cell';
import { Weight } from './board';

export type Level = {
	rows: number;
	cols: number;
	arrow: Cell;
	ducks: Cell[];
	walls: Cell[];
	weights: { cell: Cell; cost: Weight }[];
};

const WEIGHT_CHARS: Record<string, Weight> = { '2': 2, '5': 5, X: 10 };

export function parseLevel(text: string | string[], origin: Cell = { r: 0, c: 0 }): Level {
	const lines = (Array.isArray(text) ? text : text.trim().split('\n')).map((l) => l.trim());
	const level: Level = { rows: lines.length, cols: 0, arrow: { r: 0, c: 0 }, ducks: [], walls: [], weights: [] };
	let arrows = 0;
	lines.forEach((line, i) => {
		level.cols = Math.max(level.cols, line.length);
		[...line].forEach((ch, j) => {
			const cell = { r: origin.r + i, c: origin.c + j };
			if (ch === '.') return;
			if (ch === '#') level.walls.push(cell);
			else if (ch === 'S') {
				level.arrow = cell;
				arrows++;
			} else if (ch === 'D') level.ducks.push(cell);
			else if (ch in WEIGHT_CHARS) level.weights.push({ cell, cost: WEIGHT_CHARS[ch] });
			else throw new Error(`unknown level char '${ch}' at ${i},${j}`);
		});
	});
	if (arrows !== 1) throw new Error(`level needs exactly one S, found ${arrows}`);
	if (level.ducks.length < 1) throw new Error('level needs at least one D');
	return level;
}
