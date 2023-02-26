import React from 'react';
export const NavOptions = ({ value, text }) => {
	return (
		<option
			className={'nav__select_option'}
			value={value}>
			{text}
		</option>
	);
};

export const NavButtons = ({ name, text, isRunning, clearBoard, theme }) => {
	const shouldClear = (e) => {
		if (name) {
			clearBoard(e);
		} else {
			clearBoard();
		}
	};
	return (
		<button
			name={name}
			disabled={isRunning}
			className={`nav__button__clear ${theme}_bg `}
			onClick={(e) => shouldClear(e)}>
			{text}
		</button>
	);
};

export const NavSettings = ({
	name,
	className,
	text,
	handleClick = () => {},
}) => {
	return (
		<div
			onClick={handleClick}
			className={className}
			name={name}>
			{text ? text : null}
		</div>
	);
};
