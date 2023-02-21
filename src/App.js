import React, { useState } from 'react';
import './App.css';
import Main from './Main/Main';
import Nav from './Nav/Nav';
import Footer from './Footer/Footer';
import Intro from './Popup/Intro';
import { Legend } from './Legend/Legend';
import { TableContext } from './Context/TableContext';

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
			}) => {
				return (
					<div className={theme === 'dark' ? 'app dark_bg' : 'app light_bg'}>
						<Nav
							go={go}
							maze={maze}
							speed={speed}
							theme={theme}
							running={running}
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
						/>
						<div className='spacer' />
						<Footer theme={theme} />
						{intro && (
							<Intro
								theme={theme}
								setIntro={toggleIntro}
							/>
						)}
					</div>
				);
			}}
		</TableContext.Consumer>
	);
};

export default App;
