import React from 'react';
import { Td as Cell } from './styles/td.styles.js';

class Td extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		const cell = `${this.props.r}-${this.props.c}`;
		if (
			this.props.theme !== nextProps.theme ||
			nextProps.activeCell === cell ||
			(nextProps.buildingCell === cell &&
				cell !== this.props.starting &&
				cell !== this.props.ending) ||
			this.props.isBuilding !== nextProps.isBuilding ||
			(!this.props.buildingPath[cell] && nextProps.buildingPath[cell])
		) {
			console.log(cell);
			return true;
		}
		return false;
	}

	// move the context down, to prevent updates to other components
	handleWallBuilding = (cell) => {
		if (this.props.isBuilding) {
			this.props.wallBuilding(cell);
		}
	};
	render() {
		const {
			r,
			c,
			starting,
			ending,
			wallConstructorOn,
			wallConstructorOff,
			wallBuilding,
			isBuilding,
			theme,
			activeCell,
			buildingPath,
		} = this.props;
		const cell = `${r}-${c}`;

		let classN =
			cell === ending
				? `ending`
				: cell === starting
				? `starting`
				: cell === activeCell
				? `visited`
				: buildingPath[cell]
				? `wall`
				: `unvisited`;
		return (
			<Cell
				className={`${classN}`}
				id={cell}
				draggable={false}
				onMouseDown={wallConstructorOn}
				onMouseUp={wallConstructorOff}
				onMouseMove={(e) => this.handleWallBuilding(cell)}
				// onMouseMove={wallBuilding}
				currentTheme={theme}
				state={classN}
			/>
		);
	}
}
export default Td;
