import React from 'react';
import {
	algorithmOptions,
	mazeOptions,
	clearButtons,
	themeOptions,
} from './constants';
import { NavOptions, NavSettings, NavThemes } from './NavItems';

const Nav = ({
	go,
	theme,
	pause,
	isPaused,
	running,
	mazeRunning,
	setSpeed,
	setTheme,
	algorithm,
	speedText,
	buildMaze,
	clearBoard,
	selectAlgorithm,
	showBestPath,
	hideBestPath,
	isPreviewing,
}) => {
	const shouldUpdateMazeSelection = (e) => {
		const name = e.target.value;
		if (!running) {
			buildMaze(name);
		}
	};
	const handleItemClicked = (e, fn) => {
		// remove later
		fn(e);
	};

	return (
		<div className={`nav ${theme}_bg_secondary`}>
			<div className={'nav__algo nav__items'}>
				<img
					className={'nav-image'}
					src={require('../Images/duck.png')}
					alt={'Duck'}
				/>
			</div>
			<div className={`nav__items`}>
				{algorithm !== 'dijkstra' && algorithm !== 'algorithm' && (
					<>
						<div className={`nav__items`}>
							<button
								disabled={running}
								onClick={isPreviewing ? hideBestPath : showBestPath}
								className={`nav__button nav__button__knownPathBtn ${theme}_border ${theme}_bg_secondary`}>
								{isPreviewing ? 'Hide Best Path' : 'Show Best Path'}
							</button>
						</div>
						<div className='w_spacer'></div>
					</>
				)}

				<div className={`nav__algo nav__items`}>
					<select
						className={`nav__select ${theme}_border ${theme}_bg_secondary`}
						disabled={running}
						onChange={(e) => selectAlgorithm(e)}>
						{algorithmOptions.map((algo) => (
							<NavOptions
								key={algo.value}
								value={algo.value}
								text={algo.text}
							/>
						))}
					</select>
					<div className='w_spacer'></div>
					<select
						className={`nav__select ${theme}_border ${theme}_bg_secondary`}
						disabled={running}
						id='maze'
						onChange={(e) => shouldUpdateMazeSelection(e)}>
						{mazeOptions.map((maze) => (
							<NavOptions
								key={maze.value}
								value={maze.value}
								text={maze.text}
							/>
						))}
					</select>
				</div>

				<div className={'nav__action nav__items'}>
					{running && !mazeRunning ? (
						<button
							onClick={pause}
							className={`nav__button pause ${theme}_border`}>
							{isPaused ? 'Resume' : 'Pause'}
						</button>
					) : (
						<button
							onClick={go}
							className={`nav__button go ${theme}_border`}
							disabled={running || algorithm === 'algorithm'}>
							Go!
						</button>
					)}
				</div>

				<div className={`nav__setting nav__items`}>
					<button
						disabled={running}
						className={`nav__button nav__items__container nav__items__container__clear ${theme}_border ${theme}_bg_secondary`}>
						<NavSettings
							className={`nav__setting_clear ${theme}_bg_secondary`}
							name={'clear'}
							text={'Clear'}
						/>
						<div className={`tooltip__container `}>
							{clearButtons.map((btn) => (
								<div
									className={`tooltip ${theme}_bg`}
									onClick={() => clearBoard(btn.name)}
									key={btn.text}
									name={btn.name}>
									{btn.text}
								</div>
							))}
						</div>
					</button>
					<button
						className={`nav__button nav__items__container nav__items__container__speed ${theme}_border
				${theme}_bg_secondary`}>
						<NavSettings
							className={`nav__setting_speed ${theme}_bg_secondary`}
							name={'speed'}
							text={'Speed'}
						/>
						<div className={`tooltip__container`}>
							<div
								className={`tooltip ${theme}_bg ${
									speedText === 'sloth' && 'nav__button__selected'
								}`}
								onClick={(e) => handleItemClicked(e, setSpeed)}
								name={'sloth'}>
								Sloth
							</div>
							<div
								className={`tooltip ${theme}_bg ${
									speedText === 'slow' && 'nav__button__selected'
								}`}
								onClick={(e) => handleItemClicked(e, setSpeed)}
								name={'slow'}>
								Slow
							</div>
							<div
								className={`tooltip ${theme}_bg ${
									speedText === 'norm' && 'nav__button__selected'
								}`}
								onClick={(e) => handleItemClicked(e, setSpeed)}
								name={'norm'}>
								Normal
							</div>
							<div
								className={`tooltip ${theme}_bg ${
									speedText === 'fast' && 'nav__button__selected'
								}`}
								onClick={(e) => handleItemClicked(e, setSpeed)}
								name={'fast'}>
								Fast
							</div>
							<div
								className={`tooltip ${theme}_bg ${
									speedText === 'light' && 'nav__button__selected'
								}`}
								onClick={(e) => handleItemClicked(e, setSpeed)}
								name={'light'}>
								Light
							</div>
						</div>
					</button>
					<button
						disabled={running}
						className={`
        			nav__button
        			nav__button_square
        			nav__items__container
        			${theme}_border
							${theme}_bg_secondary
        		`}
						onClick={setTheme}>
						<NavSettings
							className={`nav__setting_theme_${theme} `}
							name={'theme'}
						/>
					</button>
				</div>
			</div>
		</div>
	);
};

export default Nav;
