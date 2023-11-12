import React from 'react';
import ReactDOM from 'react-dom';

import './styles/_base.css';
import './styles/_nav.css';
import './styles/_table.css';
import './styles/_footer.css';
import './styles/_legend.css';
import './styles/_intro.css';
import './styles/_theme.css';
import './styles/_theme_cell.css';
import App from './App';
import * as serviceWorker from './serviceWorker';
import { TableContextProvider } from './Context/TableContext';

ReactDOM.render(
	<TableContextProvider>
		<App />
	</TableContextProvider>,

	document.getElementById('root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
