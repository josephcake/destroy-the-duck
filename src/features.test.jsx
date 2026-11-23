// One-way is parked (features.ts): with the flag off the UI offers no one-way tool,
// and a board carrying one-way cells drops them to plain empty. The engine keeps them.
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TableContextProvider } from './Context/TableContext';
import AppShell from './shell/AppShell';
import { FEATURES, dropParkedTiles } from './features';
import { Board } from './model/board';
import { parseLevel } from './model/level';
import { snapshotOf } from './testing/levelSnapshot';
import { runSearch } from './engine/search';

test('the flag is off', () => {
	expect(FEATURES.oneWay).toBe(false);
});

test('with One-way off the UI has no one-way tool, no O shortcut, and no lane hint or legend row', () => {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	expect(screen.queryByTitle(/One-way/i)).toBeNull();
	expect(screen.queryByLabelText(/One-way/i)).toBeNull();
	expect(screen.getByTitle('Wall (W)')).toBeInTheDocument();
	act(() => void fireEvent.keyDown(window, { key: 'o' }));
	expect(document.querySelector('.tool[aria-pressed="true"]')?.getAttribute('title')).not.toMatch(/One-way/i);
	expect(document.body.textContent).not.toMatch(/one-way|lanes?\b/i);
});

test('a board with one-way cells loads with them dropped to plain empty; other tiles stay', () => {
	const b = new Board();
	b.set(3, 4, { kind: 'oneway', dir: 1 });
	b.set(3, 5, { kind: 'oneway', dir: 2 });
	b.set(4, 4, { kind: 'weight', cost: 5 });
	b.set(5, 5, { kind: 'pad', pair: 0 });
	expect(dropParkedTiles(b)).toBe(2);
	expect(b.get(3, 4)).toBeUndefined();
	expect(b.get(3, 5)).toBeUndefined();
	expect(b.get(4, 4)).toEqual({ kind: 'weight', cost: 5 });
	expect(b.get(5, 5)).toEqual({ kind: 'pad', pair: 0 });
	expect(dropParkedTiles(b)).toBe(0); // idempotent
	// with the flag on, they stay
	const on = new Board();
	on.set(1, 1, { kind: 'oneway', dir: 0 });
	expect(dropParkedTiles(on, { oneWay: true })).toBe(0);
	expect(on.get(1, 1)).toEqual({ kind: 'oneway', dir: 0 });
});

test('the engine still honours one-way lanes (support is parked, not removed)', () => {
	const cost = (rows) => runSearch('astar', snapshotOf(parseLevel(rows))).result.pathCost;
	expect(cost(['S>D', '...'])).toBe(2);
	expect(cost(['S<D', '...'])).toBe(4); // against the arrow: a detour
});
