import { checkValidCells } from './checkValidCellsHelper';
export const spreadHelper = (starting, ending) => {
	let queue = [starting];
	let path = {};
	let counter = 0;

	while (queue[counter] !== ending) {
		try {
			helper(queue[counter]);
			counter++;
		} catch (err) {
			counter = 0;
			break;
		}
	}
	function helper(currentID) {
		let validCells = checkValidCells(currentID);
		let {
			upCell,
			downCell,
			leftCell,
			rightCell,
			upNext,
			downNext,
			leftNext,
			rightNext,
		} = validCells;
		if (
			upNext === ending ||
			downNext === ending ||
			leftNext === ending ||
			rightNext === ending
		) {
			queue.push(ending);
			return queue;
		}
		if (leftCell) {
			if (!path[leftNext]) {
				path[leftNext] = true;
				if (!leftCell.className.includes(`_wall`)) {
					queue.push(leftNext);
				}
			}
		}
		if (rightCell) {
			if (!path[rightNext]) {
				path[rightNext] = true;
				if (!rightCell.className.includes(`_wall`)) {
					queue.push(rightNext);
				}
			}
		}

		if (downCell) {
			if (!path[downNext]) {
				path[downNext] = true;
				if (!downCell.className.includes(`_wall`)) {
					queue.push(downNext);
				}
			}
		}
		if (upCell) {
			if (!path[upNext]) {
				path[upNext] = true;
				if (!upCell.className.includes(`_wall`)) {
					queue.push(upNext);
				}
			}
		}
	}
	return queue;
};
