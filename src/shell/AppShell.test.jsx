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

test('the collapsed bar names the algorithm of the visible tab', () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getByRole('option', { name: /^Dijkstra · weighted/ }));
	fireEvent.click(screen.getByTestId('tab-learn'));
	fireEvent.click(screen.getByRole('button', { name: 'A*' }));
	fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }));
	expect(screen.getByTestId('mini-algo').textContent).toBe('A*');
	expect(screen.getByTestId('mini-learn-start')).toBeInTheDocument();
	fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
	fireEvent.click(screen.getByRole('tab', { name: 'Sandbox' }));
	fireEvent.click(screen.getByRole('button', { name: 'Collapse panel' }));
	expect(screen.getByTestId('mini-algo').textContent).toBe('Dijkstra · weighted');
});

test('. and , step from anywhere, including the focused scrubber, but not while typing', async () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	fireEvent.click(screen.getByTestId('tab-learn'));
	fireEvent.click(screen.getByTestId('learn-start'));
	await screen.findByTestId('step-forward');
	const count = () => screen.getByTestId('step-count').textContent.split(' / ')[0];
	fireEvent.keyDown(document.body, { key: '.' });
	expect(count()).toBe('1');
	const scrub = screen.getByRole('slider', { name: 'Scrub steps' });
	scrub.focus();
	fireEvent.keyDown(scrub, { key: '.' });
	fireEvent.keyDown(scrub, { key: '.' });
	expect(count()).toBe('3');
	fireEvent.keyDown(scrub, { key: ',' });
	expect(count()).toBe('2');
	const text = document.createElement('input');
	document.body.appendChild(text);
	fireEvent.keyDown(text, { key: '.' });
	expect(count()).toBe('2');
});

test('the new UI starts at Fast and remembers the chosen speed', () => {
	localStorage.clear();
	const { unmount } = render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const speed = () => screen.getByRole('group', { name: 'Speed' }).querySelector('[aria-pressed="true"]').textContent;
	expect(speed()).toBe('Fast');
	fireEvent.click(screen.getByRole('group', { name: 'Speed' }).querySelector('[title^="light speed"]'));
	expect(speed()).toBe('Light');
	unmount();
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	expect(speed()).toBe('Light');
});

test('phone: starting a step-through closes the bottom sheet so the floats do not stack on it', async () => {
	const orig = window.matchMedia;
	window.matchMedia = (q) => ({ matches: q === '(max-width: 599px)', media: q, addEventListener() {}, removeEventListener() {} });
	try {
		const { container } = render(
			<TableContextProvider>
				<AppShell />
			</TableContextProvider>,
		);
		const panel = container.querySelector('.panel');
		if (panel.getAttribute('data-open') !== 'true') fireEvent.click(screen.getByLabelText('Open panel'));
		expect(container.querySelector('.app').getAttribute('data-panel')).toBe('open');
		fireEvent.click(screen.getByTestId('tab-learn'));
		fireEvent.click(screen.getByTestId('learn-start'));
		await screen.findByTestId('step-forward');
		expect(panel.getAttribute('data-open')).toBe('false');
		expect(container.querySelector('.app').getAttribute('data-panel')).toBe('closed');
	} finally {
		window.matchMedia = orig;
	}
});

test('Prism P5: the collapsed panel is inert, so Tab cannot land inside it', () => {
	const { container } = render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const panel = container.querySelector('.panel');
	if (panel.getAttribute('data-open') === 'true') fireEvent.click(screen.getByLabelText('Collapse panel'));
	expect(panel.hasAttribute('inert')).toBe(true);
	fireEvent.click(screen.getByLabelText('Open panel'));
	expect(panel.hasAttribute('inert')).toBe(false);
});

test('Mochi fix 3: Show Best Path and the chips keep their slot whatever the algorithm', () => {
	localStorage.clear();
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	const slot = () => screen.getByTestId('best-path');
	expect(slot().style.visibility).toBe('hidden'); // no algorithm yet: hidden, space kept
	expect(slot()).toBeDisabled();
	expect(screen.getByTestId('find-chips')).toHaveClass('chips--reserve');
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getAllByRole('option', { name: /^Breadth First Search/ })[0]);
	expect(slot().style.visibility).toBe('');
	expect(screen.getByRole('button', { name: 'Show Best Path' })).toBe(slot());
	fireEvent.click(screen.getByTestId('algo-picker'));
	fireEvent.click(screen.getByRole('option', { name: /^A\*/ }));
	expect(slot().style.visibility).toBe('hidden');
	expect(screen.queryByRole('button', { name: 'Show Best Path' })).toBeNull();
});
