import React, { Component, createContext } from 'react';
import { BASIC_WALL } from '../Wall/BasicWall';
import { SPIRAL_WALL } from '../Wall/SpiralWall';
import { STAIR_WALL } from '../Wall/StairWall';
import { TARGET_WALL } from '../Wall/TargetWall';
import { CHECKER_WALL } from '../Wall/CheckerWall';
import { FOREST_WALL } from '../Wall/ForestWall';
import { linearSearchHelper } from './algorithms/linearSearchHelper';
import { checkValidCells } from './algorithms/checkValidCellsHelper';
import { spreadHelper } from './algorithms/spreadHelper';
import { knownDirectionHelper } from './algorithms/knownDirectionHelper';
import { bidirectionalSpreadHelper } from './algorithms/bidirectionalSpreadHelper';
import { randomHelper } from './algorithms/randomHelper';

export const TableContext = createContext();
export class TableContextProvider extends Component {
	state = {
		starting: '17-15',
		ending: '17-64',
		rows: 35,
		cols: 80,
		activeCell: '17-15',
		algorithm: 'algorithm',
		current: '17-15',
		running: false,
		refresh: false,
		block: '',
		speed: 100,
		// speed: 1000,
		speedText: 'norm',
		// speedText: 'sloth',
		theme: 'light',
		maze: 'maze',
		isBuilding: false,
		buildingCell: null,
		buildingPath: {},
	};
	componentDidMount() {
		const table = document.getElementById('main');
		window.addEventListener('mouseup', this.wallConstructorOff);
		table.addEventListener('mousedown', this.wallConstructorOn);
		// table.addEventListener('mousemove', this.wallConstructorOn);
	}

	shouldComponentUpdate(nextProps, nextState) {
		if (
			nextState.buildingCell !== this.state.buildingCell ||
			nextState.buildingPath !== this.state.buildingPath ||
			nextState.isBuilding !== this.state.isBuilding ||
			nextState.activeCell !== this.state.activeCell ||
			nextState.algorithm !== this.state.algorithm ||
			nextState.ending !== this.state.ending ||
			nextState.wallOn !== this.state.wallOn ||
			nextState.theme !== this.state.theme ||
			nextState.speed !== this.state.speed ||
			nextState.speedText !== this.state.speedText ||
			nextState.maze !== this.state.maze ||
			nextState.running !== this.state.running
		) {
			return true;
		}
		return false;
	}
	setRunning = (running) => {
		this.setState({
			...this.state,
			running,
		});

		return;
	};

	wallConstructorOn = () => {
		let newState = { ...this.state };
		newState.isBuilding = true;
		this.setState(newState);
	};
	wallConstructorOff = () => {
		let newState = { ...this.state };
		newState.isBuilding = false;
		this.setState(newState);
	};

	wallBuilding = (e) => {
		if (this.state.isBuilding && !this.state.running) {
			const cell = document.getElementById(e);
			const isValidCell =
				cell.className.includes('unvisited') &&
				!cell.className.includes('wall');
			if (isValidCell) {
				const classname = cell.className.replace('unvisited', 'wall');
				cell.className = classname;
			}
		}
	};
	setTheme = () => {
		this.setState({
			...this.state,
			theme: this.state.theme === 'dark' ? 'light' : 'dark',
		});
		return;
	};
	cannotFindDuck = () => {
		if (window.checkWallInterval) {
			clearInterval(window.checkWallInterval);
		}
		let newState = { ...this.state };
		newState.running = false;
		this.setState(newState);
		// return alert('cannot find duck')
		return console.log('cannot find duck');
	};
	setSpeed = (e) => {
		let name = e.currentTarget.attributes.name.value;
		let newState = { ...this.state };
		if (name === 'light') {
			newState.speed = 0;
			newState.speedText = 'light';
		} else if (name === 'fast') {
			newState.speed = 10;
			newState.speedText = 'fast';
		} else if (name === 'norm') {
			newState.speed = 30;
			newState.speedText = 'norm';
		} else if (name === 'slow') {
			newState.speed = 150;
			newState.speedText = 'slow';
		} else if (name === 'sloth') {
			newState.speed = 1500;
			newState.speedText = 'sloth';
		}
		this.setState(newState);
		return;
	};

	buildMaze = (name) => {
		this.returnToUnvisited();
		this.setState((prevState) => {
			return {
				...prevState,
				maze: name,
				// running : name === "maze" ? false : true
			};
		});
		if (name === 'maze') return;

		const mazeType = [
			'basic',
			'spiral',
			'stair',
			'target',
			'checker',
			'forest',
		];
		if (name === 'random') {
			this.randomlyGeneratedMaze();
		} else if (name === 'vertical') {
			this.directionalGeneratedMaze(
				this.state.cols,
				this.state.rows,
				'vertical',
				true,
			);
		} else if (name === 'horizontal') {
			this.directionalGeneratedMaze(
				this.state.rows,
				this.state.cols,
				'horizontal',
				true,
			);
		} else if (name === 'verticalNarrow') {
			this.directionalGeneratedMaze(
				this.state.cols,
				this.state.rows,
				'vertical',
			);
		} else if (name === 'horizontalNarrow') {
			this.directionalGeneratedMaze(
				this.state.rows,
				this.state.cols,
				'horizontal',
			);
		} else {
			const mazes = [
				BASIC_WALL,
				SPIRAL_WALL,
				STAIR_WALL,
				TARGET_WALL,
				CHECKER_WALL,
				FOREST_WALL,
			];
			const idx = mazeType.indexOf(name);
			const theme = this.state.theme;

			for (let i = 0; i < mazes[idx].length; i++) {
				let k = i;
				let cell = document.getElementById(mazes[idx][k]);
				setTimeout(function () {
					cell.className = `${theme}_wall`;
				}, this.state.speed * k);
			}
		}
	};

	directionalGeneratedMaze = (outerNum, innerNum, direction, wide) => {
		this.returnToUnvisited();
		let wallsToBeBuild = [];
		let spaces = wide ? 6 : 2;
		for (let i = 1; i < outerNum; i += spaces) {
			const skip = Math.floor(Math.random() * innerNum);
			for (let j = 0; j < innerNum; j++) {
				let current = direction === 'horizontal' ? `${i}-${j}` : `${j}-${i}`;
				if (current !== this.state.starting && current !== this.state.ending) {
					if (j !== skip) {
						wallsToBeBuild.push(current);
					}
				}
			}
		}
		if (wide && direction === 'horizontal') {
			this.horizontalExtension(wallsToBeBuild);
		} else if (wide && direction === 'vertical') {
			this.verticalExtension(wallsToBeBuild);
		} else {
			const theme = this.state.theme;

			for (let i = 0; i < wallsToBeBuild.length; i++) {
				let k = i;
				setTimeout(() => {
					let cell = document.getElementById(wallsToBeBuild[k]);
					cell.className = `${theme}_wall`;
				}, this.state.speed * k);
			}
		}
		let newState = { ...this.state };
		newState.running = true;
		this.setState(newState);
	};
	horizontalExtension = (wallsToBeBuild) => {
		const theme = this.state.theme;
		for (let i = 0; i < wallsToBeBuild.length; i++) {
			let k = i;
			let extra = Math.ceil(Math.random() * 2);
			let upOrDown = Math.floor(Math.random() * 10) > 5 ? true : false;
			setTimeout(() => {
				let current = wallsToBeBuild[k].split('-');
				let cR = Number(current[0]);
				let cC = Number(current[1]);
				let cell = document.getElementById(wallsToBeBuild[k]);
				for (let i = 0; i < extra; i++) {
					if (upOrDown) {
						let tempCell = document.getElementById(`${cR - 1}-${cC}`);
						if (
							tempCell &&
							!tempCell.className.includes(`_starting`) &&
							!tempCell.className.includes(`_ending`)
						) {
							tempCell.className = `${theme}_wall`;
							cR--;
						}
					} else {
						let tempCell = document.getElementById(`${cR + 1}-${cC}`);
						if (
							tempCell &&
							!tempCell.className.includes(`_starting`) &&
							!tempCell.className.includes(`_ending`)
						) {
							tempCell.className = `${theme}_wall`;
							cR++;
						}
					}
				}

				cell.className = `${theme}_wall`;
			}, this.state.speed * k);
		}
	};
	verticalExtension = (wallsToBeBuild) => {
		const theme = this.state.theme;

		for (let i = 0; i < wallsToBeBuild.length; i++) {
			let k = i;
			let extra = Math.ceil(Math.random() * 2);
			let leftOrRight = Math.floor(Math.random() * 10) > 5 ? true : false;
			setTimeout(() => {
				let current = wallsToBeBuild[k].split('-');
				let cR = Number(current[0]);
				let cC = Number(current[1]);
				let cell = document.getElementById(wallsToBeBuild[k]);
				for (let i = 0; i < extra; i++) {
					if (leftOrRight) {
						let tempCell = document.getElementById(`${cR}-${cC - 1}`);
						if (
							tempCell &&
							!tempCell.className.includes(`_starting`) &&
							!tempCell.className.includes(`_ending`)
						) {
							tempCell.className = `${theme}_wall`;
							cC--;
						}
					} else {
						let tempCell = document.getElementById(`${cR}-${cC + 1}`);
						if (
							tempCell &&
							!tempCell.className.includes(`_starting`) &&
							!tempCell.className.includes(`_ending`)
						) {
							tempCell.className = `${theme}_wall`;
							cC++;
						}
					}
				}

				cell.className = `${theme}_wall`;
			}, this.state.speed * k);
		}
	};

	randomlyGeneratedMaze = () => {
		this.returnToUnvisited();
		const theme = this.state.theme;
		let wallsToBeBuild = [];

		const unvisited = document.getElementsByClassName(`${theme}_unvisited`);
		const unvisitedArr = Array.from(unvisited);
		for (let i = 0; i < unvisitedArr.length; i++) {
			const skip = Math.floor(Math.random() * 9);
			const walls = Math.floor(Math.random() * 4);
			if (i + walls < unvisitedArr.length) {
				for (let j = 0; j < walls; j++) {
					let cell = unvisitedArr[i + j];
					wallsToBeBuild.push(cell.id);
				}
			}
			i += skip;
		}

		for (let i = 0; i < wallsToBeBuild.length; i++) {
			let k = i;
			setTimeout(() => {
				let cell = document.getElementById(wallsToBeBuild[k]);
				cell.className = `${theme}_wall`;
			}, this.state.speed * k);
		}
		let newState = { ...this.state };
		newState.running = true;
		this.setState(newState);
	};

	clearBoard = (e) => {
		this.returnToUnvisited(e);
		let newState = { ...this.state };
		newState.running = false;
		newState.current = this.state.starting;
		this.setState(newState);
	};

	returnToUnvisited = (e) => {
		const theme = this.state.theme;
		if (e) {
			let name = e.target ? e.target.name : e;
			const cellsHTML = document.getElementsByClassName(`${theme}_${name}`);
			const cellsArr = Array.from(cellsHTML);
			for (let i = 0; i < cellsArr.length; i++) {
				let k = i;
				cellsArr[k].className = `${theme}_unvisited`;
			}
		} else {
			const unvisitedAnimated = document.getElementsByClassName(
				`${theme}_visited`,
			);
			const cellsHTML = document.getElementsByClassName(`${theme}_wall`);
			const cellsArr = Array.from(cellsHTML);
			const arrVisited = Array.from(unvisitedAnimated);

			for (let i = 0; i < cellsArr.length; i++) {
				let k = i;
				cellsArr[k].className = `${theme}_unvisited`;
			}
			for (let i = 0; i < arrVisited.length; i++) {
				let k = i;
				arrVisited[k].className = `${theme}_unvisited`;
			}
		}
	};

	selectAlgorithm = (e) => {
		let algorithm = e.target.value;
		let newState = { ...this.state };
		newState.algorithm = algorithm;
		this.setState(newState);
	};

	go = () => {
		this.returnToUnvisited(`visited`);
		const name = this.state.algorithm;
		if (name === 'algorithm') {
			let newState = { ...this.state };
			newState.running = false;
			this.setState(newState);
			return;
		}
		const algorithmNames = [
			'knownEndPointSearch',
			'linearSearch',
			'breadthFirstSearch',
			'depthFirstSearch',
			'bidirectionalSearch',
			'randomSearch',
		];
		const algorithms = [
			this.knownEndPointSearch,
			this.linearSearch,
			this.breadthFirstSearch,
			this.depthFirstSearch,
			this.bidirectionalSearch,
			this.randomSearch,
		];
		const selected = algorithmNames.indexOf(name);
		algorithms[selected]();
	};

	bidirectionalSearch = () => {
		let counter = 0;
		let queue = bidirectionalSpreadHelper(
			this.state.starting,
			this.state.ending,
		);
		const helper = () => {
			setTimeout(() => {
				let cellOne = document.getElementById(queue.startingQueue[counter]);
				if (cellOne) {
					let classnameOne = cellOne.className.replace('unvisited', 'visited');
					cellOne.className = classnameOne;
				}
				let cellTwo = document.getElementById(queue.endingQueue[counter]);
				if (cellTwo) {
					let classnameTwo = cellTwo.className.replace('unvisited', 'visited');
					cellTwo.className = classnameTwo;
				}

				if (counter === queue.length - 1) {
					return;
				} else {
					counter++;
					helper();
				}
			}, this.state.speed);
		};
		helper();
	};

	randomSearch = () => {
		let ending = this.state.ending;
		let queue = randomHelper(this.state.starting, ending);
		let counter = 0;
		const helper = () => {
			setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace('unvisited', 'visited');
				currentCell.className = classname;
				if (queue[counter] === ending) {
					return;
				}
				if (counter === queue.length - 1 && queue[counter] !== ending) {
					return this.cannotFindDuck();
				}
				if (counter === queue.length - 1) {
					return;
				} else {
					counter++;
					helper();
				}
			}, this.state.speed);
		};
		helper();
	};
	linearSearch = () => {
		const ending = this.state.ending;
		const starting = this.state.starting;
		let queue = linearSearchHelper(starting);
		let counter = 0;

		const helper = () => {
			setTimeout(() => {
				let validCells = checkValidCells(queue[counter]);
				const { currentCell, upNext, downNext, leftNext, rightNext } =
					validCells;
				let classname = currentCell.className.replace('unvisited', 'visited');
				currentCell.className = classname;
				if (
					queue[counter] === ending ||
					upNext === ending ||
					downNext === ending ||
					leftNext === ending ||
					rightNext === ending
				) {
					return;
				}
				if (counter === queue.length - 1 && queue[counter] !== ending) {
					return this.cannotFindDuck();
				}
				if (counter === queue.length - 1) {
					return;
				} else {
					counter++;
					helper();
				}
			}, this.state.speed);
		};
		helper();
	};

	depthFirstSearch = () => {
		let starting = this.state.starting;
		let counter = 0;
		let queue = spreadHelper(this.state.ending, starting);
		const helper = () => {
			setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace('unvisited', 'visited');
				currentCell.className = classname;
				if (queue[counter] === starting) {
					return;
				}
				if (counter === queue.length - 1 && queue[counter] !== starting) {
					return this.cannotFindDuck();
				}
				if (counter === queue.length - 1) {
					return;
				} else {
					counter++;
					helper();
				}
			}, this.state.speed);
		};
		helper();
	};

	breadthFirstSearch = () => {
		let ending = this.state.ending;
		let counter = 0;
		let queue = spreadHelper(this.state.starting, ending);

		const helper = () => {
			setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace('unvisited', 'visited');
				currentCell.className = classname;
				if (queue[counter] === ending) {
					return;
				}
				if (counter === queue.length - 1 && queue[counter] !== ending) {
					return this.cannotFindDuck();
				}
				if (counter === queue.length - 1) {
					return;
				} else {
					counter++;
					helper();
				}
			}, this.state.speed);
		};
		helper();
	};

	knownEndPointSearch = () => {
		let starting = this.state.starting;
		let ending = this.state.ending;
		let counter = 0;
		let queue = knownDirectionHelper(starting, ending);

		const helper = () => {
			setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace('unvisited', 'visited');
				currentCell.className = classname;
				if (queue[counter] === ending) {
					return;
				}
				if (counter === queue.length - 1 && queue[counter] !== ending) {
					return this.cannotFindDuck();
				}
				if (counter === queue.length - 1) {
					return;
				} else {
					counter++;
					helper();
				}
			}, this.state.speed);
		};
		helper();
	};

	render() {
		return (
			<TableContext.Provider
				value={{
					...this.state,
					changeEndpoint: this.changeEndpoint,
					clearBoard: this.clearBoard,
					wallConstructorOn: this.wallConstructorOn,
					wallConstructorOff: this.wallConstructorOff,
					wallBuilding: this.wallBuilding,
					buildMaze: this.buildMaze,
					randomlyGeneratedMaze: this.randomlyGeneratedMaze,
					selectAlgorithm: this.selectAlgorithm,
					go: this.go,
					setSpeed: this.setSpeed,
					setTheme: this.setTheme,
					setRunning: this.setRunning,
					cannotFindDuck: this.cannotFindDuck,
				}}>
				{this.props.children}
			</TableContext.Provider>
		);
	}
}
