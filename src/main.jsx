import { createRoot } from 'react-dom/client';
import { TableContextProvider } from './Context/TableContext';
import AppShell from './shell/AppShell';

createRoot(document.getElementById('root')).render(
	<TableContextProvider>
		<AppShell />
	</TableContextProvider>,
);
