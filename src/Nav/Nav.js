import React from 'react';
import { algorithmOptions, mazeOptions, clearButtons } from './constants';
import { NavButtons, NavOptions, NavSettings } from './NavItems';

const Nav = ({
	go,
	maze,
	theme,
	running,
	setSpeed,
	setTheme,
	setIntro,
	algorithm,
	speedText,
	buildMaze,
	setRunning,
	clearBoard,
	selectAlgorithm,
}) => {
	const shouldUpdateMazeSelection = (e) => {
		const name = e.target.value;
		if (!running) {
			buildMaze(name);
			if (name !== 'maze') {
				setRunning(true);
			}
		}
	};
	const handleItemClicked = (e, fn) => {
		fn(e);
		document.getElementsByTagName('body')[0].click();
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
				<button
					onClick={go}
					className={`nav__button go ${theme}_border`}
					disabled={running || algorithm === 'algorithm'}>
					Go!
				</button>
			</div>
			<div className={`nav__setting nav__items ${running && 'disabled'}`}>
				<div
					className={`nav__button nav__items__container nav__items__container__clear ${theme}_border`}>
					<NavSettings
						className={`nav__setting_clear ${theme}_bg_secondary`}
						name={'clear'}
						text={'Clear'}
					/>
					<div className={`tooltip__container `}>
						{clearButtons.map((btn) => (
							<NavButtons
								key={btn.text}
								name={btn.name}
								text={btn.text}
								clearBoard={clearBoard}
								theme={theme}
							/>
						))}
					</div>
				</div>
			</div>

			<div className={'nav__setting nav__items'}>
				<div
					className={`
        nav__button
        nav__items__container
        ${theme}_border
        `}>
					<NavSettings
						className={'nav__setting_theme'}
						name={'theme'}
					/>
					<div className={`tooltip__container`}>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								theme === 'light' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setTheme)}
							name={'light'}>
							Light
						</div>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								theme === 'dark' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setTheme)}
							name={'light'}>
							Dark
						</div>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								theme === 'sloth' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setTheme)}
							name={'light'}>
							Neon
						</div>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								theme === 'sloth' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setTheme)}
							name={'light'}>
							Glass
						</div>
					</div>
				</div>

				<div
					className={`nav__button nav__items__container nav__items__container__speed ${theme}_border`}>
					<NavSettings
						className={`nav__setting_speed ${theme}_bg_secondary`}
						name={'speed'}
						text={speedText}
					/>
					<div className={`tooltip__container`}>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								speedText === 'sloth' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setSpeed)}
							name={'sloth'}>
							Sloth
						</div>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								speedText === 'slow' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setSpeed)}
							name={'slow'}>
							Slow
						</div>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								speedText === 'norm' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setSpeed)}
							name={'norm'}>
							Normal
						</div>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								speedText === 'fast' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setSpeed)}
							name={'fast'}>
							Fast
						</div>
						<div
							className={`tooltip ${theme}_bg_secondary ${
								speedText === 'light' && 'nav__button__selected'
							}`}
							onClick={(e) => handleItemClicked(e, setSpeed)}
							name={'light'}>
							Light
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Nav;
