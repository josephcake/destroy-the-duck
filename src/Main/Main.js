import React from 'react';
import Table from '../Table/Table';

class Main extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		return false;
	}
	render() {
		const { rows, cols } = this.props;
		return (
			<div
				id={'main'}
				className={'main'}>
				<table>
					<tbody>
						<Table
							cols={cols}
							rows={rows}
						/>
					</tbody>
				</table>
			</div>
		);
	}
}

export default Main;
