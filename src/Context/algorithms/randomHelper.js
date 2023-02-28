import { checkValidCells } from './checkValidCellsHelper';
export const randomHelper = (starting, ending) => {
	let path = { [starting]: true };
	let queue = [starting];
	const helper = (current) => {
		const direction = Math.floor(Math.random() * 4);
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

		if (
			leftNext === ending ||
			rightNext === ending ||
			downNext === ending ||
			upNext === ending
		) {
			queue.push(ending);
			return queue;
		}

		if (
			direction === 0 &&
			upCell &&
			!upCell.className.includes('_wall') &&
			!path[upNext]
		) {
			path[upNext] = true;
			queue.push(upNext);
			return helper(upNext);
		} else if (
			direction === 1 &&
			downCell &&
			!downCell.className.includes('_wall') &&
			!path[downNext]
		) {
			path[downNext] = true;
			queue.push(downNext);
			return helper(downNext);
		} else if (
			direction === 2 &&
			leftCell &&
			!leftCell.className.includes('_wall') &&
			!path[leftNext]
		) {
			path[leftNext] = true;
			queue.push(leftNext);
			return helper(leftNext);
		} else if (
			direction === 3 &&
			rightCell &&
			!rightCell.className.includes('_wall') &&
			!path[rightNext]
		) {
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
				if (
					rightCell &&
					!rightCell.className.includes('_wall') &&
					!path[rightNext]
				) {
					path[rightNext] = true;
					queue.push(rightNext);
					return helper(rightNext);
				}
				if (
					leftCell &&
					!leftCell.className.includes('_wall') &&
					!path[leftNext]
				) {
					path[leftNext] = true;
					queue.push(leftNext);
					return helper(leftNext);
				}
				if (upCell && !upCell.className.includes('_wall') && !path[upNext]) {
					path[upNext] = true;
					queue.push(upNext);
					return helper(upNext);
				}
				if (
					downCell &&
					!downCell.className.includes('_wall') &&
					!path[downNext]
				) {
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
