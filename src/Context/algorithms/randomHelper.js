import { checkValidCells } from './checkValidCellsHelper';
export const randomHelper = (starting, ending) => {
	let path = {};
	let queue = [];
	const helper = (current) => {
		const direction = Math.floor(Math.random() * 4);
		let validCells = checkValidCells(current);
		let {
			currentCell,
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
			leftNext === ending ||
			rightNext === ending ||
			downNext === ending ||
			upNext === ending
		) {
			return queue;
		}

		if (direction === 0 && upCell && !path[upNext]) {
			path[upNext] = true;
			queue.push(upNext);
			return helper(upNext);
		} else if (direction === 1 && downCell && !path[downNext]) {
			path[downNext] = true;
			queue.push(downNext);
			return helper(downNext);
		} else if (direction === 2 && leftCell && !path[leftNext]) {
			path[leftNext] = true;
			queue.push(leftNext);
			return helper(leftNext);
		} else if (direction === 3 && rightCell && !path[rightNext]) {
			path[rightNext] = true;
			queue.push(rightNext);
			return helper(rightNext);
		} else {
			const potentialPaths = Object.keys(path);
			for (let i = potentialPaths.length - 1; i >= 0; i--) {
				let validCells = checkValidCells(potentialPaths[i]);
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
				if (rightCell && !path[rightNext]) {
					path[rightNext] = true;
					queue.push(rightNext);
					return helper(rightNext);
				}
				if (leftCell && !path[leftNext]) {
					path[leftNext] = true;
					queue.push(leftNext);
					return helper(leftNext);
				}
				if (upCell && !path[upNext]) {
					path[upNext] = true;
					queue.push(upNext);
					return helper(upNext);
				}
				if (downCell && !path[downNext]) {
					path[downNext] = true;
					queue.push(downNext);
					return helper(downNext);
				}
			}
		}
	};
	helper(starting);
	return queue;
};
