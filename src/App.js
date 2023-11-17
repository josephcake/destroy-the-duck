import React from 'react';
import './App.css';
import Main from './Main/Main';
import Nav from './Nav/Nav';
import Footer from './Footer/Footer';
import { Legend } from './Legend/Legend';
import { TableContext } from './Context/TableContext';
import { Toast } from './Toast/Toast';

const App = () => {
	return (
		<TableContext.Consumer>
			{({
				go,
				maze,
				theme,
				speed,
				running,
				mazeRunning,
				setTheme,
				setSpeed,
				algorithm,
				speedText,
				buildMaze,
				setRunning,
				clearBoard,
				selectAlgorithm,
				rows,
				cols,
				isToastVisible,
				resetToast,
				isPaused,
				pause,
				showBestPath,
				hideBestPath,
				isPreviewing,
			}) => {
				return (
					<div className={`${theme}_bg app`}>
						<Nav
							go={go}
							maze={maze}
							speed={speed}
							theme={theme}
							pause={pause}
							isPaused={isPaused}
							running={running}
							mazeRunning={mazeRunning}
							setSpeed={setSpeed}
							setTheme={setTheme}
							algorithm={algorithm}
							speedText={speedText}
							buildMaze={buildMaze}
							clearBoard={clearBoard}
							setRunning={setRunning}
							selectAlgorithm={selectAlgorithm}
							showBestPath={showBestPath}
							hideBestPath={hideBestPath}
							isPreviewing={isPreviewing}
						/>
						{/* <hr /> */}
						{/* <div>display steps taken</div> */}
						{/* <hr /> */}
						<div className='h_spacer' />
						<div className='h_spacer' />
						<Main
							cols={cols}
							rows={rows}
							theme={theme}
							running={running}
							algorithm={algorithm}
						/>
						<div className='h_spacer' />
						<div className='h_spacer' />
						<div className='h_spacer' />
						<Legend theme={theme} />

						<Footer theme={theme} />

						<Toast
							resetToast={resetToast}
							isToastVisible={isToastVisible}
						/>
					</div>
				);
			}}
		</TableContext.Consumer>
	);
};

export default App;
