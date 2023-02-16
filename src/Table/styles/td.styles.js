import styled, { keyframes, css } from 'styled-components';
import { theme } from '../../theme/themeDefinition';

const getCellBorder = (currentTheme) => {
	return theme[currentTheme].cell.border;
};

const getCellBg = (currentTheme) => {
	return theme[currentTheme].cell.background;
};

// turn unvisited to visited
const visited_animation = (currentTheme) => {
	return keyframes`
  0% {
		border-radius:2px;
		transform: scale(0.3);
		background-color: ${theme[currentTheme].animation.cell.start};
	}
	50% {
		transform: scale(1.4);
		border-radius:4px;
		background-color: ${theme[currentTheme].animation.cell.start};
	}
	100% {
		transform: scale(1);
		background-color: ${theme[currentTheme].cell.background.visited};
	}
`;
};

export const Td = styled.td`
	text-align: center;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 20px;
	height: 20px;
	font-size: 0px;
	border: ${(props) =>
		`solid 1px ${
			getCellBorder(props.currentTheme)[props.state || 'unvisited']
		}`};
	background: ${(props) => `${getCellBg(props.currentTheme)[props.state]}`};
	${(props) =>
		props.state === 'visited'
			? css`
					animation-name: ${visited_animation(props.currentTheme)};
					animation-duration: 1.5s;
					animation-timing-function: ease-in-out;
			  `
			: css`
					opacity: 1;
			  `};

	@media only screen and (max-height: 900px) {
		width: 19px;
		height: 19px;
	}
	@media only screen and (max-height: 850px) {
		width: 18px;
		height: 18px;
	}
	@media only screen and (max-height: 750px) {
		width: 16px;
		height: 16px;
	}
	@media only screen and (max-height: 650px) {
		width: 14px;
		height: 14px;
	}
	@media only screen and (max-height: 550px) {
		width: 12px;
		height: 12px;
	}
	@media only screen and (max-height: 500px) {
		width: 10px;
		height: 10px;
	}
	@media only screen and (max-height: 450px) {
		width: 9px;
		height: 9px;
	}
	@media only screen and (max-width: 1366px) {
		width: 15px;
		height: 15px;
	}
	@media only screen and (max-width: 1025px) {
		width: 12px;
		height: 12px;
	}
	@media only screen and (max-width: 768px) {
		display: block;
		width: 10px;
		height: 10px;
	}
	@media only screen and (max-width: 500px) {
		width: 6px;
		height: 6px;
		padding: 1px;
	}
`;
