import { render, screen, fireEvent } from '@testing-library/react';
import { TableContextProvider } from '../Context/TableContext';
import AppShell from './AppShell';

test('shell mounts the hidden classic grid with Arrow and Duck, panel and landing card', () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	expect(document.querySelectorAll('.legacy-mirror td')).toHaveLength(35 * 80);
	expect(document.getElementById('17-15').className).toMatch(/_starting/);
	expect(document.getElementById('17-64').className).toMatch(/_ending/);
	expect(screen.getByTestId('landing')).toBeInTheDocument();
	expect(screen.getByText('Destroy the Duck')).toBeInTheDocument();
	expect(screen.getByTestId('go')).toBeInTheDocument();
});

test('Pond is the default palette and Classic is one click away (decision 7)', () => {
	localStorage.clear();
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const app = document.querySelector('.app');
	expect(app.getAttribute('data-cells')).toBe('pond');
	fireEvent.click(screen.getByTestId('cells-classic'));
	expect(app.getAttribute('data-cells')).toBe('classic');
	expect(JSON.parse(localStorage.getItem('dtd.ui.v1')).cells).toBe('classic');
});

test('picking a classic algorithm shows its classic neighbour order', () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getByRole('option', { name: /Breadth First Search/ }));
	expect(screen.getByTestId('order-chip').textContent).toMatch(/classic: left, right, down, up/);
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getByRole('option', { name: /^A\*/ }));
	expect(screen.getByTestId('order-chip').textContent).toMatch(/N · E · S · W/);
});

test('Learn: the inspector header and the step bar count the same steps', async () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	fireEvent.click(screen.getByTestId('tab-learn'));
	fireEvent.click(screen.getByTestId('learn-start'));
	const fwd = await screen.findByTestId('step-forward');
	for (let i = 0; i < 3; i++) fireEvent.click(fwd);
	const total = screen.getByTestId('step-count').textContent.split(' / ')[1];
	expect(screen.getByTestId('step-count').textContent).toBe(`3 / ${total}`);
	expect(screen.getByTestId('inspector-step').textContent).toMatch(new RegExp(`step 3 / ${total}$`));
	fireEvent.keyDown(window, { key: ',' });
	expect(screen.getByTestId('step-count').textContent).toBe(`2 / ${total}`);
	expect(screen.getByTestId('inspector-step').textContent).toMatch(new RegExp(`step 2 / ${total}$`));
});
