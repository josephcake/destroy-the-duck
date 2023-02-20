import { checkValidCells } from './checkValidCellsHelper';
let lastQueueToRender;
const spreadHelper = (current, path, queue, otherPath) => {
	let validCells = checkValidCells(current);
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

	if (otherPath[current]) {
		lastQueueToRender = current;
		return;
	} else if (otherPath[rightNext]) {
		lastQueueToRender = rightNext;
		return;
	} else if (otherPath[leftNext]) {
		lastQueueToRender = leftNext;
		return;
	} else if (otherPath[upNext]) {
		lastQueueToRender = upNext;
		return;
	} else if (otherPath[downNext]) {
		lastQueueToRender = downNext;
		return;
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
};

export const bidirectionalSpreadHelper = (pointOne, pointTwo) => {
	let startingQueue = [pointOne];
	let endingQueue = [pointTwo];
	let startingPath = {};
	let endingPath = {};
	let counter = 0;

	while (
		!startingPath[endingQueue[counter]] &&
		!endingPath[startingQueue[counter]] &&
		!lastQueueToRender
	) {
		try {
			spreadHelper(
				startingQueue[counter],
				startingPath,
				startingQueue,
				endingPath,
			);
			spreadHelper(endingQueue[counter], endingPath, endingQueue, startingPath);
			counter++;
		} catch (err) {
			break;
		}
	}
	return { startingQueue, endingQueue, lastQueueToRender };
};
