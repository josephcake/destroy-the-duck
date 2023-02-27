import React from 'react';
import { algorithmOptions, mazeOptions, clearButtons } from './constants';
import { NavOptions, NavSettings } from './NavItems';

const Nav = ({
	go,
	theme,
	pause,
	isPaused,
	running,
	mazeRunning,
	setSpeed,
	setTheme,
	setIntro,
	algorithm,
	speedText,
	buildMaze,
	clearBoard,
	selectAlgorithm,
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
					onClick={setIntro}
					className={'nav-image'}
					src={require('../Images/duck.png')}
					alt={'Duck'}
				/>
			</div>
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
			</div>
			<div className={'nav__wall nav__items'}>
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
			</div>

			<div className={`nav__setting nav__items`}>
				<button
					disabled={running}
					className={`
        nav__button
        nav__items__container
        ${theme}_border
				${theme}_bg_secondary
        `}>
					<NavSettings
						className={`nav__setting_theme `}
						name={'theme'}
					/>
					<div className={`tooltip__container`}>
						<div
							className={`tooltip ${theme}_bg ${
								theme === 'light' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked('light', setTheme)}
							name={'light'}>
							Light
						</div>
						<div
							className={`tooltip ${theme}_bg ${
								theme === 'dark' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked('dark', setTheme)}
							name={'dark'}>
							Dark
						</div>
						<div
							className={`tooltip ${theme}_bg ${
								theme === 'neon' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked('neon', setTheme)}
							name={'neon'}>
							Neon
						</div>
					</div>
				</button>

				<button
					className={`nav__button nav__items__container nav__items__container__speed ${theme}_border
				${theme}_bg_secondary`}>
					<NavSettings
						className={`nav__setting_speed ${theme}_bg_secondary`}
						name={'speed'}
						text={speedText}
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
			</div>
		</div>
	);
};

export default Nav;
