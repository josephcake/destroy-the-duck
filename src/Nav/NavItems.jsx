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
export const NavThemes = ({
	name,
	theme,
	value,
	setTheme,
	handleClick = () => {},
}) => {
	return (
		<div
			className={`tooltip ${theme}_bg ${
				theme === name && 'nav__button__selected'
			}`}
			onClick={(e) => handleClick(name, setTheme)}
			name={name}>
			{value}
		</div>
	);
};
