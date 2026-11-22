import React from 'react';
import { createRoot } from 'react-dom/client';

import './styles/_base.css';
import './styles/_nav.css';
import './styles/_table.css';
import './styles/_footer.css';
import './styles/_legend.css';
import './styles/_theme.css';
import './styles/_theme_cell.css';
import App from './App';
import { TableContextProvider } from './Context/TableContext';

createRoot(document.getElementById('root')).render(
	<TableContextProvider>
		<App />
	</TableContextProvider>,
);
