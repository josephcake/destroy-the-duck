import React, { useState } from 'react';
import './App.css';
import Main from './Main/Main';
import Nav from './Nav/Nav';
import Footer from './Footer/Footer';
import Intro from './Popup/Intro';
import { Legend } from './Legend/Legend';
import { TableContext } from './Context/TableContext';
import { Toast } from './Toast/Toast';

const App = () => {
	const [intro, setIntro] = useState(true);
	const toggleIntro = () => {
		setIntro(!intro);
	};
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
							setIntro={toggleIntro}
							clearBoard={clearBoard}
							setRunning={setRunning}
							selectAlgorithm={selectAlgorithm}
						/>
						<Legend theme={theme} />
						<div className='spacer' />
						<Main
							cols={cols}
							rows={rows}
							theme={theme}
							running={running}
						/>
						<div className='spacer' />
						<Footer theme={theme} />
						{intro && (
							<Intro
								theme={theme}
								setIntro={toggleIntro}
							/>
						)}
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
