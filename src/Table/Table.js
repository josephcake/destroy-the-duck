import React from 'react';
import Tr from './Tr';

class Table extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		if (
			this.props.theme !== nextProps.theme ||
			this.props.activeCell !== nextProps.activeCell ||
			this.props.isBuilding !== nextProps.isBuilding ||
			this.props.buildingPath !== nextProps.buildingPath
		) {
			return true;
		}
		return false;
	}
	render() {
		const rowsData = [];
		const {
			rows,
			cols,
			current,
			starting,
			ending,
			activeCell,
			wallBuilding,
			wallConstructorOn,
			wallConstructorOff,
			theme,
			isBuilding,
			buildingPath,
			buildingCell,
		} = this.props;

		for (let i = 0; i < rows; i++) {
			rowsData.push(
				<Tr
					r={i}
					key={i}
					cols={cols}
					theme={theme}
					activeCell={activeCell}
					ending={ending}
					draggable={false}
					isBuilding={isBuilding}
					current={current}
					buildingCell={buildingCell}
					buildingPath={buildingPath}
					starting={starting}
					wallBuilding={wallBuilding}
					wallConstructorOn={wallConstructorOn}
					wallConstructorOff={wallConstructorOff}
				/>,
			);
		}

		return rowsData;
	}
}
export default Table;
