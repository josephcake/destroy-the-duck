import React from 'react';
import Table from '../Table/Table';
import { TableContext } from '../Context/TableContext';

class Main extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		if (
			nextProps.activeCell !== this.props.activeCell ||
			nextProps.theme !== this.props.theme ||
			this.props.isBuilding !== nextProps.isBuilding ||
			this.props.buildingPath !== nextProps.buildingPath
		) {
			return true;
		}
		return false;
	}
	render() {
		const {
			rows,
			cols,
			theme,
			starting,
			ending,
			current,
			activeCell,
			wallConstructorOn,
			wallConstructorOff,
			wallBuilding,
			isBuilding,
			buildingPath,
			buildingCell,
		} = this.props;
		return (
			<div
				id={'main'}
				className={'main'}>
				<table>
					<tbody>
						<Table
							cols={cols}
							rows={rows}
							activeCell={activeCell}
							theme={theme}
							ending={ending}
							current={current}
							draggable={false}
							buildingCell={buildingCell}
							buildingPath={buildingPath}
							isBuilding={isBuilding}
							starting={starting}
							wallBuilding={wallBuilding}
							wallConstructorOn={wallConstructorOn}
							wallConstructorOff={wallConstructorOff}
						/>
					</tbody>
				</table>
			</div>
		);
	}
}

export default Main;
