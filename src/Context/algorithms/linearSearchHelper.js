import { checkValidCells } from './checkValidCellsHelper';
export const linearSearchHelper = (starting) => {
	let queue = [starting];
	let current = starting.split('-');
	let path = {};
	path[starting] = true;
	const helper = () => {
		let currentID = `${current[0]}-${current[1]}`;
		let validCells = checkValidCells(currentID);
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

		if (currentCell && currentCell.className.includes(`ending`)) {
			queue.push(currentID);
			return;
		}
		if (leftCell && leftCell.className.includes(`ending`)) {
			queue.push(leftNext);
			return;
		}
		if (rightCell && rightCell.className.includes(`ending`)) {
			queue.push(rightNext);
			return;
		}
		if (downCell && downCell.className.includes(`ending`)) {
			queue.push(downNext);
			return;
		}
		if (upCell && upCell.className.includes(`ending`)) {
			queue.push(upNext);
			return;
		}
		if (
			leftCell &&
			leftCell.className.includes(`unvisited`) &&
			!path[leftNext]
		) {
			current = leftNext.split('-');
			path[leftNext] = true;
			queue.push(leftNext);
			return helper();
		} else if (
			!leftCell ||
			leftCell.className.includes(`wall`) ||
			leftCell.className.includes(`visited`) ||
			leftCell.className.includes(`starting`) ||
			path[leftNext]
		) {
			if (upCell && upCell.className.includes(`unvisited`) && !path[upNext]) {
				current = upNext.split('-');
				path[upNext] = true;
				queue.push(upNext);
				return helper();
			} else if (
				downCell &&
				downCell.className.includes(`unvisited`) &&
				!path[downNext]
			) {
				current = downNext.split('-');
				path[downNext] = true;
				queue.push(downNext);
				return helper();
			} else if (
				rightCell &&
				rightCell.className.includes(`unvisited`) &&
				!path[rightNext]
			) {
				current = rightNext.split('-');
				path[rightNext] = true;
				queue.push(rightNext);
				return helper();
			} else {
				const potentialPaths = Object.keys(path);
				for (let i = potentialPaths.length - 1; i !== 0; i--) {
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
						upCell &&
						upCell.className.includes(`unvisited`) &&
						!path[upNext]
					) {
						current = upNext.split('-');
						path[upNext] = true;
						queue.push(upNext);
						return helper();
					} else if (
						downCell &&
						downCell.className.includes(`unvisited`) &&
						!path[downNext]
					) {
						current = downNext.split('-');
						path[downNext] = true;
						queue.push(downNext);
						return helper();
					} else if (
						leftCell &&
						leftCell.className.includes(`unvisited`) &&
						!path[leftNext]
					) {
						current = leftNext.split('-');
						path[leftNext] = true;
						queue.push(leftNext);
						return helper();
					} else if (
						rightCell &&
						rightCell.className.includes(`unvisited`) &&
						!path[rightNext]
					) {
						current = rightNext.split('-');
						path[rightNext] = true;
						queue.push(rightNext);
						return helper();
					}
				}
			}
		}
	};
	helper();
	return queue;
};
