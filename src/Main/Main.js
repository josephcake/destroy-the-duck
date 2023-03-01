import React from 'react';
import Table from '../Table/Table';

class Main extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		return false;
	}
	render() {
		const { rows, cols, theme } = this.props;
		return (
			<div
				id={'main'}
				className={`main`}>
				{/* <div className={`knownPathBtn ${theme}_bg_secondary`}>
					Show Known Path
				</div> */}

				<table>
					<tbody className={`tbody`}>
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
