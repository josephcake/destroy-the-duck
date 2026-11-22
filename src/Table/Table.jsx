import React from 'react';
import Tr from './Tr';

class Table extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		return false;
	}
	render() {
		const rowsData = [];
		const { rows, cols } = this.props;

		for (let i = 0; i < rows; i++) {
			rowsData.push(
				<Tr
					r={i}
					key={i}
					cols={cols}
				/>,
			);
		}

		return rowsData;
	}
}
export default Table;
