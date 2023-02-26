import styled, { css } from 'styled-components';

export const ToastContainer = styled.div`
	position: absolute;
	text-align: center;
	display: flex;
	justify-content: center;
	align-items: center;
	width: 300px;
	height: 75px;
	font-size: 16px;
	font-family: SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial,
		sans-serif;
	font-weight: 900;
	border-radius: 5px;
	transition: all 1.5s ease-out;
	align-self: center;

	${(props) =>
		props.isToastVisible
			? css`
					top: 15px;
					opacity: 1;
					color: whitesmoke;
					backdrop-filter: blur(5px);
					background: rgba(198, 15, 15, 0.7);
			  `
			: css`
					top: -100%;
					opacity: 0;
					background: transparent;
			  `}
`;
