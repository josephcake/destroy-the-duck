import React from 'react';
import Td from './Td';

class Tr extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		let nextBuildingCell =
			nextProps.buildingCell && nextProps.buildingCell.split('-');
		let nextActiveCell = nextProps.activeCell.split('-');
		let nextActiveR = Number(nextActiveCell[0]);
		let nextBuildingR = nextBuildingCell && Number(nextBuildingCell[0]);
		if (
			this.props.theme !== nextProps.theme ||
			nextActiveR === this.props.r ||
			nextBuildingR === this.props.r ||
			this.props.isBuilding !== nextProps.isBuilding ||
			this.props.buildingPath !== nextProps.buildingPath
		) {
			return true;
		}
		return false;
	}
	render() {
		const {
			r,
			cols,
			current,
			starting,
			ending,
			wallConstructorOn,
			wallConstructorOff,
			wallBuilding,
			theme,
			activeCell,
			isBuilding,
			buildingPath,
			buildingCell,
		} = this.props;
		const tds = [];
		for (let i = 0; i < cols; i++) {
			tds.push(
				<Td
					r={r}
					c={i}
					theme={theme}
					ending={ending}
					key={`${r}-${i}`}
					draggable={false}
					activeCell={activeCell}
					current={current}
					buildingPath={buildingPath}
					buildingCell={buildingCell}
					isBuilding={isBuilding}
					starting={starting}
					wallBuilding={wallBuilding}
					wallConstructorOn={wallConstructorOn}
					wallConstructorOff={wallConstructorOff}
				/>,
			);
		}

		return <tr>{tds}</tr>;
	}
}
export default Tr;
