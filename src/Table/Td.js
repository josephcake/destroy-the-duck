import React from 'react';
import { Td as Cell } from './styles/td.styles.js';
import { TableContext } from '../Context/TableContext';

const Td = ({ r, c }) => {
	return (
		<TableContext.Consumer>
			{({ theme, starting, ending, draggingOrWallBuilding }) => {
				return (
					<TdContainer
						r={r}
						c={c}
						starting={starting}
						ending={ending}
						theme={theme}
						draggingOrWallBuilding={draggingOrWallBuilding}
					/>
				);
			}}
		</TableContext.Consumer>
	);
};

class TdContainer extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		return false;
	}

	render() {
		const { r, c, starting, ending, theme } = this.props;
		const cell = `${r}-${c}`;
		let classN =
			cell === ending
				? `${theme}_ending`
				: cell === starting
				? `${theme}_starting`
				: `${theme}_unvisited`;

		return (
			<Cell
				className={`${classN}`}
				id={cell}
				draggable={false}
				onMouseMove={(e) => this.props.draggingOrWallBuilding(cell)}
				currentTheme={theme}
				state={classN}
			/>
		);
	}
}

export default Td;
