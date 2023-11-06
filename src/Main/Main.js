import React from 'react';
import Table from '../Table/Table';

class Main extends React.Component {
	shouldComponentUpdate(nextProps, nextState) {
		return true;
		console.log({ nextProps });
		if (nextProps.algorithm) return true;
		return false;
	}
	render() {
		const {
			rows,
			cols,
			theme,
			algorithm,
			showBestPath,
			hideBestPath,
			isPreviewing,
		} = this.props;
		return (
			<div
				id={'main'}
				className={`main`}>
				{algorithm !== 'dijkstra' && algorithm !== 'algorithm' && (
					<div
						className={`knownPathBtn ${theme}_bg_secondary`}
						onClick={isPreviewing ? hideBestPath : showBestPath}>
						{isPreviewing ? 'Hide Best Path' : 'Show Best Path'}
					</div>
				)}

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
