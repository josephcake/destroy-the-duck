export const checkValidCells = (currentID) => {
	let currentSplit = currentID.split('-');
	let cR = Number(currentSplit[0]);
	let cC = Number(currentSplit[1]);

	let upNext = `${cR - 1}-${cC}`;
	let downNext = `${cR + 1}-${cC}`;
	let leftNext = `${cR}-${cC - 1}`;
	let rightNext = `${cR}-${cC + 1}`;
	let currentCell = document.getElementById(currentID);
	let upCell = document.getElementById(upNext);
	let downCell = document.getElementById(downNext);
	let leftCell = document.getElementById(leftNext);
	let rightCell = document.getElementById(rightNext);

	return {
		current: currentID,
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
	};
};
