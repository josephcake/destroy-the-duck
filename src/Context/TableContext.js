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
import { dijkstraHelper } from './algorithms/dijkstraHelper';
import { bidirectionalSpreadHelper } from './algorithms/bidirectionalSpreadHelper';
import { randomHelper } from './algorithms/randomHelper';
import { VISITED, UNVISITED, WALL, LIGHT, DARK, NEON } from '../lib/constants';

export const TableContext = createContext();
export class TableContextProvider extends Component {
	state = {
		starting: '17-15',
		ending: '17-64',
		rows: 35,
		cols: 80,
		algorithm: 'algorithm',
		current: '17-15',
		running: false,
		mazeRunning: false,
		speed: 100,
		speedText: 'norm',
		theme: LIGHT,
		maze: 'maze',
		isBuilding: false,
		isToastVisible: false,
		isPaused: false,
		currentBuildingPath: null,
	};
	componentDidMount() {
		const table = document.getElementById('main');
		window.addEventListener('mouseup', this.wallConstructorOff);
		table.addEventListener('mousedown', this.wallConstructorOn);
		this.checkInitialTheme();
		// table.addEventListener('mousemove', this.wallConstructorOn);
	}

	shouldComponentUpdate(nextProps, nextState) {
		if (
			nextState.currentBuildingPath !== this.state.currentBuildingPath ||
			nextState.isPaused !== this.state.isPaused ||
			nextState.isToastVisible !== this.state.isToastVisible ||
			nextState.isBuilding !== this.state.isBuilding ||
			nextState.algorithm !== this.state.algorithm ||
			nextState.ending !== this.state.ending ||
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
	setRunning = (running, shouldShowKnownPathBtn) => {
		if (shouldShowKnownPathBtn) {
		} else {
			if (running) {
				this.setState({
					...this.state,
					running,
				});
			} else {
				this.setState({
					...this.state,
					running,
					isPaused: false,
					mazeRunning: false,
					currentBuildingPath: null,
				});
			}
		}

		return;
	};
	checkInitialTheme = () => {
		const initialTheme = localStorage.getItem('dtdTheme');
		if (initialTheme) {
			this.setTheme(initialTheme);
		} else {
			this.setTheme(LIGHT);
		}
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
				cell.className.includes(UNVISITED) && !cell.className.includes(WALL);
			if (isValidCell) {
				const classname = cell.className.replace(UNVISITED, WALL);
				cell.className = classname;
			}
		}
	};
	setTheme = (newThemeName) => {
		let tds = document.querySelectorAll('td');
		let tbody = document.querySelectorAll('tbody')[0];
		// let knownPathBtn = document.querySelectorAll('.knownPathBtn')[0];

		let currentThemeName = tds[0].className.includes(DARK)
			? DARK
			: tds[0].className.includes(LIGHT)
			? LIGHT
			: NEON;

		tbody.className = `${newThemeName}_border`;

		// knownPathBtn.className = `knownPathBtn ${newThemeName}_bg_secondary ${newThemeName}_border`;

		for (let i = 0; i < tds.length; i++) {
			let td = tds[i];
			let classname = td.className.replace(currentThemeName, newThemeName);
			td.className = classname;
		}

		localStorage.setItem('dtdTheme', newThemeName);
		this.setState({
			...this.state,
			theme: newThemeName,
		});
		return;
	};
	resetToast = (origin) => {
		if (origin === 'click') {
			let newState = { ...this.state };
			newState.isToastVisible = false;
			this.setState(newState);
		} else {
			setTimeout(() => {
				let newState = { ...this.state };
				newState.isToastVisible = false;
				this.setState(newState);
			}, 6000);
		}
	};
	cannotFindDuck = () => {
		let newState = { ...this.state };
		newState.running = false;
		newState.isPaused = false;
		newState.currentBuildingPath = null;
		newState.isToastVisible = true;
		this.setState(newState, () => {
			this.resetToast();
		});
	};
	setSpeed = (e) => {
		let name = e.currentTarget.attributes.name.value;
		let newState = { ...this.state };
		if (name === LIGHT) {
			newState.speed = 0;
			newState.speedText = LIGHT;
		} else if (name === 'fast') {
			newState.speed = 10;
			newState.speedText = 'fast';
		} else if (name === 'norm') {
			newState.speed = 100;
			newState.speedText = 'norm';
		} else if (name === 'slow') {
			newState.speed = 333;
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
				running: name === 'maze' ? false : true,
				mazeRunning: name === 'maze' ? false : true,
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
			let counter = 0;
			const selectedMaze = mazes[idx];

			let helper = () => {
				let timer = setTimeout(() => {
					let cell = document.getElementById(selectedMaze[counter]);
					let classname = cell.className.replace(UNVISITED, WALL);
					cell.className = classname;
					counter++;
					if (counter === selectedMaze.length) {
						clearTimeout(timer);
						this.setRunning(false);
						return;
					}
					helper();
				}, this.state.speed);
			};
			helper();
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
		if (wide && direction) {
			this.extension(wallsToBeBuild, direction);
		} else {
			let counter = 0;

			let helper = () => {
				let timer = setTimeout(() => {
					let cell = document.getElementById(wallsToBeBuild[counter]);
					let classname = cell.className.replace(UNVISITED, WALL);
					cell.className = classname;
					counter++;
					if (counter === wallsToBeBuild.length) {
						clearTimeout(timer);
						this.setRunning(false);
						return;
					} else {
						helper();
					}
				}, this.state.speed);
			};
			helper();
		}
	};
	extension = (wallsToBeBuild, direction) => {
		let counter = 0;
		let helper = () => {
			let extra = Math.ceil(Math.random() * 3);
			let difference = Math.floor(Math.random() * 10) > 5 ? true : false;
			let timer = setTimeout(() => {
				let current = wallsToBeBuild[counter].split('-');
				let cR = Number(current[0]);
				let cC = Number(current[1]);
				let cell = document.getElementById(wallsToBeBuild[counter]);
				let nextDifferenceCell =
					direction === 'horizontal' ? `${cR - 1}-${cC}` : `${cR}-${cC - 1}`;
				let nextCell =
					direction === 'horizontal' ? `${cR + 1}-${cC}` : `${cR}-${cC + 1}`;

				for (let i = 0; i < extra; i++) {
					if (difference) {
						let tempCell = document.getElementById(nextDifferenceCell);
						if (
							tempCell &&
							!tempCell.className.includes(`_starting`) &&
							!tempCell.className.includes(`_ending`)
						) {
							let classname = tempCell.className.replace(UNVISITED, WALL);
							tempCell.className = classname;
							if (direction === 'horizontal') {
								cR--;
							} else {
								cC--;
							}
							extra = Math.ceil(Math.random() * 3);
						}
					} else {
						let tempCell = document.getElementById(nextCell);
						if (
							tempCell &&
							!tempCell.className.includes(`_starting`) &&
							!tempCell.className.includes(`_ending`)
						) {
							let classname = tempCell.className.replace(UNVISITED, WALL);
							tempCell.className = classname;
							if (direction === 'horizontal') {
								cR++;
							} else {
								cC++;
							}
						}
					}
				}

				let classname = cell.className.replace(UNVISITED, WALL);
				cell.className = classname;

				counter++;
				if (counter === wallsToBeBuild.length) {
					clearTimeout(timer);
					this.setRunning(false);
					return;
				} else {
					helper();
				}
			}, this.state.speed);
		};
		helper();
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
		let counter = 0;
		const helper = () => {
			let timer = setTimeout(() => {
				let cell = document.getElementById(wallsToBeBuild[counter]);
				if (cell) {
					let classname = cell.className.replace(UNVISITED, WALL);
					cell.className = classname;
				}
				if (counter < wallsToBeBuild.length) {
					counter++;
					helper();
				} else {
					clearTimeout(timer);
					this.setRunning(false);
				}
			}, this.state.speed);
		};
		helper();
	};

	clearBoard = (e) => {
		this.returnToUnvisited(e);
		// remove and update this
	};

	returnToUnvisited = (e) => {
		const theme = this.state.theme;
		if (e) {
			let name = e.target ? e.target.name : e;
			const affectedCells = document.querySelectorAll(`td.${theme}_${name}`);
			// getElementsByClassName(`${theme}_${name}`);
			const cellsArr = Array.from(affectedCells);
			for (let i = 0; i < cellsArr.length; i++) {
				let k = i;
				let normalizedCell = cellsArr[k].className.replace(name, UNVISITED);
				cellsArr[k].className = normalizedCell;
			}
		} else {
			const visitedCells = document.querySelectorAll(`td.${theme}_${VISITED}`);
			const walledCells = document.querySelectorAll(`td.${theme}_${WALL}`);
			const wallCellsArr = Array.from(walledCells);
			const visitedCellsArr = Array.from(visitedCells);

			for (let i = 0; i < wallCellsArr.length; i++) {
				let k = i;
				let normalizedCell = wallCellsArr[k].className.replace(WALL, UNVISITED);
				wallCellsArr[k].className = normalizedCell;
			}
			for (let i = 0; i < visitedCellsArr.length; i++) {
				let k = i;
				let normalizedCell = visitedCellsArr[k].className.replace(
					VISITED,
					UNVISITED,
				);
				visitedCellsArr[k].className = normalizedCell;
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
		let newState = { ...this.state };
		if (name === 'algorithm') {
			newState.running = false;
			this.setState(newState);
			return;
		}
		const algorithmNames = [
			'dijkstra',
			'linearSearch',
			'breadthFirstSearch',
			'depthFirstSearch',
			'bidirectionalSearch',
			'randomSearch',
		];
		const algorithms = [
			this.dijkstra,
			this.linearSearch,
			this.breadthFirstSearch,
			this.depthFirstSearch,
			this.bidirectionalSearch,
			this.randomSearch,
		];
		const selected = algorithmNames.indexOf(name);
		algorithms[selected]();
	};
	pause = () => {
		let newState = { ...this.state };
		if (this.state.isPaused) {
			newState.isPaused = false;
			this.setState(newState, () => this.resume());
		} else {
			newState.isPaused = true;
			this.setState(newState);
		}
	};
	resume = () => {
		const queue = this.state.currentBuildingPath;
		if (this.state.algorithm !== 'bidirectionalSearch') {
			const firstUnvisited = queue.find((path) =>
				document.getElementById(path).className.includes(UNVISITED),
			);
			const ending = this.state.ending;
			const firstUnvisitedIdx = queue.indexOf(firstUnvisited);
			let counter = firstUnvisitedIdx;
			const helper = () => {
				if (this.state.isPaused) return;
				let timer = setTimeout(() => {
					let currentCell = document.getElementById(queue[counter]);
					let classname = currentCell.className.replace(UNVISITED, VISITED);
					currentCell.className = classname;
					counter++;
					if (counter >= queue.length) {
						clearTimeout(timer);
						if (queue.indexOf(ending) === -1) {
							return this.cannotFindDuck();
						} else {
							return this.setRunning(false);
						}
					} else {
						helper();
					}
				}, this.state.speed);
			};
			helper();
		} else {
			const { startingQueue, endingQueue, lastQueueToRender } = queue;
			const firstStartingUnvisited = startingQueue.find((path) =>
				document.getElementById(path).className.includes(UNVISITED),
			);
			const firstEndingUnvisited = endingQueue.find((path) =>
				document.getElementById(path).className.includes(UNVISITED),
			);

			const firstStartingUnvisitedIdx = startingQueue.indexOf(
				firstStartingUnvisited,
			);
			const firstEndingUnvisitedIdx = endingQueue.indexOf(firstEndingUnvisited);

			let starting_counter = firstStartingUnvisitedIdx;
			let ending_counter = firstEndingUnvisitedIdx;
			const helper = () => {
				if (this.state.isPaused) return;
				let timer = setTimeout(() => {
					let cellOne = document.getElementById(
						startingQueue[starting_counter],
					);
					if (cellOne) {
						let classnameOne = cellOne.className.replace(UNVISITED, VISITED);
						cellOne.className = classnameOne;
					}
					let cellTwo = document.getElementById(endingQueue[ending_counter]);
					if (cellTwo) {
						let classnameTwo = cellTwo.className.replace(UNVISITED, VISITED);
						cellTwo.className = classnameTwo;
					}
					starting_counter++;
					ending_counter++;
					if (
						ending_counter >= endingQueue.length &&
						starting_counter >= startingQueue.length
					) {
						clearTimeout(timer);
						if (
							endingQueue.indexOf(lastQueueToRender) > -1 &&
							startingQueue.indexOf(lastQueueToRender) > -1
						) {
							return this.setRunning(false);
						} else {
							return this.cannotFindDuck();
						}
					} else {
						helper();
					}
				}, this.state.speed);
			};
			helper();
		}
	};

	bidirectionalSearch = () => {
		let counter = 0;
		let queue = bidirectionalSpreadHelper(
			this.state.starting,
			this.state.ending,
		);
		this.setState({ ...this.state, currentBuildingPath: queue, running: true });
		const helper = () => {
			if (this.state.isPaused) return;
			let timer = setTimeout(() => {
				let cellOne = document.getElementById(queue.startingQueue[counter]);
				if (cellOne) {
					let classnameOne = cellOne.className.replace(UNVISITED, VISITED);
					cellOne.className = classnameOne;
				}
				let cellTwo = document.getElementById(queue.endingQueue[counter]);
				if (cellTwo) {
					let classnameTwo = cellTwo.className.replace(UNVISITED, VISITED);
					cellTwo.className = classnameTwo;
				}
				counter++;
				if (
					counter >= queue.endingQueue.length &&
					counter >= queue.startingQueue.length
				) {
					clearTimeout(timer);
					if (
						queue.endingQueue.indexOf(queue.lastQueueToRender) > -1 &&
						queue.startingQueue.indexOf(queue.lastQueueToRender) > -1
					) {
						return this.setRunning(false);
					} else {
						return this.cannotFindDuck();
					}
				} else {
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
		this.setState({ ...this.state, currentBuildingPath: queue, running: true });

		const helper = () => {
			if (this.state.isPaused) return;
			let timer = setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace(UNVISITED, VISITED);
				currentCell.className = classname;
				counter++;
				if (counter >= queue.length) {
					clearTimeout(timer);
					if (queue.indexOf(ending) === -1) {
						return this.cannotFindDuck();
					} else {
						return this.setRunning(false);
					}
				} else {
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

		this.setState({ ...this.state, currentBuildingPath: queue, running: true });
		const helper = () => {
			if (this.state.isPaused) return;
			let timer = setTimeout(() => {
				let validCells = checkValidCells(queue[counter]);
				const { currentCell, upNext, downNext, leftNext, rightNext } =
					validCells;
				let classname = currentCell.className.replace(UNVISITED, VISITED);
				currentCell.className = classname;

				if (
					queue[counter] === ending ||
					upNext === ending ||
					downNext === ending ||
					leftNext === ending ||
					rightNext === ending
				) {
					clearTimeout(timer);
					this.setRunning(false);
					return;
				}
				counter++;
				if (counter >= queue.length) {
					clearTimeout(timer);
					if (queue.indexOf(ending) === -1) {
						return this.cannotFindDuck();
					} else {
						return this.setRunning(false);
					}
				} else {
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

		this.setState({ ...this.state, currentBuildingPath: queue, running: true });
		const helper = () => {
			if (this.state.isPaused) return;
			let timer = setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace(UNVISITED, VISITED);
				currentCell.className = classname;
				counter++;
				if (counter >= queue.length) {
					clearTimeout(timer);
					if (queue.indexOf(starting) === -1) {
						return this.cannotFindDuck();
					} else {
						return this.setRunning(false);
					}
				} else {
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

		this.setState({ ...this.state, currentBuildingPath: queue, running: true });
		const helper = () => {
			if (this.state.isPaused) return;
			let timer = setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace(UNVISITED, VISITED);
				currentCell.className = classname;
				counter++;
				if (counter >= queue.length) {
					clearTimeout(timer);
					if (queue.indexOf(ending) === -1) {
						return this.cannotFindDuck();
					} else {
						return this.setRunning(false);
					}
				} else {
					helper();
				}
			}, this.state.speed);
		};
		helper();
	};

	dijkstra = () => {
		let starting = this.state.starting;
		let ending = this.state.ending;
		let counter = 0;
		let queue = dijkstraHelper(starting, ending);

		this.setState({ ...this.state, currentBuildingPath: queue, running: true });
		const helper = () => {
			if (this.state.isPaused) return;
			let timer = setTimeout(() => {
				let currentCell = document.getElementById(queue[counter]);
				let classname = currentCell.className.replace(UNVISITED, VISITED);
				currentCell.className = classname;
				counter++;
				if (counter >= queue.length) {
					clearTimeout(timer);
					if (queue.indexOf(ending) === -1) {
						return this.breadthFirstSearch();
					} else {
						return this.setRunning(false);
					}
				} else {
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
					resetToast: this.resetToast,
					pause: this.pause,
				}}>
				{this.props.children}
			</TableContext.Provider>
		);
	}
}
