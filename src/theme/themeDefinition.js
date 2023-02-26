export const theme = {
	light: {
		default: {
			background: {
				primary: 'whitesmoke',
				secondary: 'darkslateblue',
			},
			color: {
				primary: 'darkslateblue',
				secondary: 'whitesmoke',
			},
			border: '#a9a9a9',
		},
		cell: {
			background: {
				visited: '#7C4DA2',
				unvisited: '#D3D3D3',
				path: '#FF6347',
				starting: '#e94c0e',
				ending: '#ffd000',
				wall: '#04042CCC',
			},
			border: {
				unvisited: '#F6F6F6',
				visited: '#750575',
			},
		},
		animation: {
			cell: {
				start: '#EA00FFBF',
				end: '#BE1938BF',
			},
			wall: {
				start: '#170A3BBF',
				end: '#04042CCC',
			},
		},
	},
	dark: {
		default: {
			background: {
				primary: '#111A2F',
				secondary: '#B9B9B9',
			},
			color: {
				primary: '#B9B9B9',
				secondary: '#111A2F',
			},
			border: '#424661',
		},
		cell: {
			background: {
				visited: '#5E9178',
				unvisited: '#373737',
				path: '#FF6347',
				starting: '#e94c0e',
				ending: '#ffd000',
			},
			border: {
				unvisited: '#1E1D1D',
				visited: '#13123A',
			},
		},
		animation: {
			cell: {
				start: '#00FFBB',
				end: '#31B395',
			},
			wall: {
				start: '#04042C',
				end: '#04042CCC',
			},
		},
	},
};
