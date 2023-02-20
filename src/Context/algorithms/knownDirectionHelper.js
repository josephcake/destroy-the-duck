import { checkValidCells } from './checkValidCellsHelper';

export const knownDirectionHelper = (starting, ending) => {
	let path = {};
	let queue = [];
	let eR = ending.split('-')[0];
	let eC = ending.split('-')[1];
	const helper = (current) => {
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
			cR,
			cC,
		} = validCells;

		if (
			leftNext === ending ||
			rightNext === ending ||
			downNext === ending ||
			upNext === ending
		) {
			return queue;
		}

		const shouldGoRight = cC < eC;
		const shouldGoLeft = cC > eC;
		const shouldGoUp = cR > eR;
		const shouldGoDown = cR < eR;

		if (shouldGoRight) {
			if (
				rightCell &&
				!rightCell.className.includes('wall') &&
				!path[rightNext]
			) {
				current = rightNext.split('-');
				path[rightNext] = true;
				queue.push(rightNext);
				return helper(rightNext);
			} else {
				const potentialPaths = Object.keys(path);
				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					rightNext = `${cR}-${cC + 1}`;
					rightCell = document.getElementById(rightNext);
					if (
						rightCell &&
						!rightCell.className.includes('wall') &&
						!path[rightNext]
					) {
						current = rightNext.split('-');
						path[rightNext] = true;
						queue.push(rightNext);
						return helper(rightNext);
					}
				}

				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					upNext = `${cR - 1}-${cC}`;
					downNext = `${cR + 1}-${cC}`;
					upCell = document.getElementById(upNext);
					downCell = document.getElementById(downNext);
					if (upCell && !upCell.className.includes('wall') && !path[upNext]) {
						current = upNext.split('-');
						path[upNext] = true;
						queue.push(upNext);
						return helper(upNext);
					}
					if (
						downCell &&
						!downCell.className.includes('wall') &&
						!path[downNext]
					) {
						current = downNext.split('-');
						path[downNext] = true;
						queue.push(downNext);
						return helper(downNext);
					}
				}

				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					leftNext = `${cR}-${cC - 1}`;
					leftCell = document.getElementById(leftNext);
					if (
						leftCell &&
						!leftCell.className.includes('wall') &&
						!path[leftNext]
					) {
						current = leftNext.split('-');
						path[leftNext] = true;
						queue.push(leftNext);
						return helper(leftNext);
					}
				}
			}
		} else if (shouldGoLeft) {
			if (leftCell && !leftCell.className.includes('wall') && !path[leftNext]) {
				current = leftNext.split('-');
				path[leftNext] = true;
				queue.push(leftNext);
				return helper(leftNext);
			} else {
				const potentialPaths = Object.keys(path);
				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					leftNext = `${cR}-${cC - 1}`;
					leftCell = document.getElementById(leftNext);
					if (
						leftCell &&
						!leftCell.className.includes('wall') &&
						!path[leftNext]
					) {
						current = leftNext.split('-');
						path[leftNext] = true;
						queue.push(leftNext);
						return helper(leftNext);
					}
				}
				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					upNext = `${cR - 1}-${cC}`;
					downNext = `${cR + 1}-${cC}`;
					upCell = document.getElementById(upNext);
					downCell = document.getElementById(downNext);
					if (upCell && !upCell.className.includes('wall') && !path[upNext]) {
						current = upNext.split('-');
						path[upNext] = true;
						queue.push(upNext);
						return helper(upNext);
					}
					if (
						downCell &&
						!downCell.className.includes('wall') &&
						!path[downNext]
					) {
						current = downNext.split('-');
						path[downNext] = true;
						queue.push(downNext);
						return helper(downNext);
					}
				}

				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					rightNext = `${cR}-${cC + 1}`;
					rightCell = document.getElementById(rightNext);
					if (
						rightCell &&
						!rightCell.className.includes('wall') &&
						!path[rightNext]
					) {
						current = rightNext.split('-');
						path[rightNext] = true;
						queue.push(rightNext);
						return helper(rightNext);
					}
				}
			}
		}
		if (shouldGoUp) {
			if (upCell && !upCell.className.includes('wall') && !path[upNext]) {
				current = upNext.split('-');
				path[upNext] = true;
				queue.push(upNext);
				return helper(upNext);
			} else {
				const potentialPaths = Object.keys(path);

				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					upNext = `${cR - 1}-${cC}`;
					upCell = document.getElementById(upNext);
					if (upCell && !upCell.className.includes('wall') && !path[upNext]) {
						current = upNext.split('-');
						path[upNext] = true;
						queue.push(upNext);
						return helper(upNext);
					}
				}

				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					leftNext = `${cR}-${cC - 1}`;
					leftCell = document.getElementById(leftNext);
					rightNext = `${cR}-${cC + 1}`;
					rightCell = document.getElementById(rightNext);

					if (
						leftCell &&
						!leftCell.className.includes('wall') &&
						!path[leftNext]
					) {
						current = leftNext.split('-');
						path[leftNext] = true;
						queue.push(leftNext);
						return helper(leftNext);
					} else if (
						rightCell &&
						!rightCell.className.includes('wall') &&
						!path[rightNext]
					) {
						current = rightNext.split('-');
						path[rightNext] = true;
						queue.push(rightNext);
						return helper(rightNext);
					}
				}
				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					downNext = `${cR + 1}-${cC}`;
					downCell = document.getElementById(downNext);
					if (
						downCell &&
						!downCell.className.includes('wall') &&
						!path[downNext]
					) {
						current = downNext.split('-');
						path[downNext] = true;
						queue.push(downNext);
						return helper(downNext);
					}
				}
			}
		} else if (shouldGoDown) {
			if (downCell && !downCell.className.includes('wall') && !path[downNext]) {
				current = downNext.split('-');
				path[downNext] = true;
				queue.push(downNext);
				return helper(downNext);
			} else {
				const potentialPaths = Object.keys(path);
				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					downNext = `${cR + 1}-${cC}`;
					downCell = document.getElementById(downNext);
					if (
						downCell &&
						!downCell.className.includes('wall') &&
						!path[downNext]
					) {
						current = downNext.split('-');
						path[downNext] = true;
						queue.push(downNext);
						return helper(downNext);
					}
				}

				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					leftNext = `${cR}-${cC - 1}`;
					leftCell = document.getElementById(leftNext);
					rightNext = `${cR}-${cC + 1}`;
					rightCell = document.getElementById(rightNext);
					if (
						leftCell &&
						!leftCell.className.includes('wall') &&
						!path[leftNext]
					) {
						current = leftNext.split('-');
						path[leftNext] = true;
						queue.push(leftNext);
						return helper(leftNext);
					} else if (
						rightCell &&
						!rightCell.className.includes('wall') &&
						!path[rightNext]
					) {
						current = rightNext.split('-');
						path[rightNext] = true;
						queue.push(rightNext);
						return helper(rightNext);
					}
				}
				for (let i = potentialPaths.length - 1; i >= 0; i--) {
					current = potentialPaths[i].split('-');
					cR = Number(current[0]);
					cC = Number(current[1]);
					upNext = `${cR - 1}-${cC}`;
					upCell = document.getElementById(upNext);
					if (upCell && !upCell.className.includes('wall') && !path[upNext]) {
						current = upNext.split('-');
						path[upNext] = true;
						queue.push(upNext);
						return helper(upNext);
					}
				}
			}
		}
	};
	helper(starting);
	return queue;
};
