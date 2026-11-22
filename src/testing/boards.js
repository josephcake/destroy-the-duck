import { BASIC_WALL } from '../Wall/BasicWall';
import { SPIRAL_WALL } from '../Wall/SpiralWall';
import { STAIR_WALL } from '../Wall/StairWall';
import { TARGET_WALL } from '../Wall/TargetWall';
import { CHECKER_WALL } from '../Wall/CheckerWall';
import { FOREST_WALL } from '../Wall/ForestWall';

const ring = (r, c, radius) => {
	const out = [];
	for (let i = r - radius; i <= r + radius; i++)
		for (let j = c - radius; j <= c + radius; j++)
			if (
				(Math.abs(i - r) === radius || Math.abs(j - c) === radius) &&
				i >= 0 && i < 35 && j >= 0 && j < 80
			)
				out.push(`${i}-${j}`);
	return out;
};

const verticalWallWithGap = (col, gapRow) => {
	const out = [];
	for (let r = 0; r < 35; r++) if (r !== gapRow) out.push(`${r}-${col}`);
	return out;
};

const D = { starting: '17-15', ending: '17-64' };

// Each fixture: { starting, ending, walls }. Names are golden file names.
export const FIXTURES = {
	open: { ...D, walls: [] },
	adjacent: { starting: '10-10', ending: '10-11', walls: [] },
	corners: { starting: '0-0', ending: '34-79', walls: [] },
	detour: { ...D, walls: verticalWallWithGap(40, 3) },
	enclosedArrow: { ...D, walls: ring(17, 15, 2) },
	enclosedDuck: { ...D, walls: ring(17, 64, 1) },
	dragged: { starting: '5-70', ending: '30-3', walls: verticalWallWithGap(40, 20) },
	basic: { ...D, walls: BASIC_WALL },
	spiral: { ...D, walls: SPIRAL_WALL },
	stair: { ...D, walls: STAIR_WALL },
	target: { ...D, walls: TARGET_WALL },
	checker: { ...D, walls: CHECKER_WALL },
	forest: { ...D, walls: FOREST_WALL },
};
