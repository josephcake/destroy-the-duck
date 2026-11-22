import React from 'react';
import { render } from '@testing-library/react';
import App from './App';
import { TableContextProvider } from './Context/TableContext';

test('renders the board with Arrow and Duck inside the provider', () => {
	const { container } = render(
		<TableContextProvider>
			<App />
		</TableContextProvider>,
	);
	expect(container.querySelectorAll('td')).toHaveLength(35 * 80);
	expect(document.getElementById('17-15').className).toMatch(/_starting/);
	expect(document.getElementById('17-64').className).toMatch(/_ending/);
});
