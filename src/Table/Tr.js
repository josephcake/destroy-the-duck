import React from 'react';
import Td from './Td';

class Tr extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		return false;
	}
	render() {
		const { r, cols } = this.props;
		const tds = [];
		for (let i = 0; i < cols; i++) {
			tds.push(
				<Td
					r={r}
					c={i}
					key={`${r}-${i}`}
				/>,
			);
		}

		return <tr>{tds}</tr>;
	}
}
export default Tr;
