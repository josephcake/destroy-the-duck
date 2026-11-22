// Touch, the classic window helpers, and small-screen framing (the board is
// bounded since 2026-11-22: see bounded.test.tsx).
import { CellAnim } from '../canvas/cellAnim';
import { createRef } from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
// @ts-expect-error legacy JS module
import { TableContextProvider } from '../Context/TableContext';
import AppShell, { closerDuckGap } from './AppShell';
import { CanvasStage, SceneInput, StageApi, Tool } from '../canvas/CanvasStage';
import { Board } from '../model/board';
import { LegacyMirror } from '../canvas/mirror';
import { PALETTES } from '../canvas/palette';
import { buildSnapshot } from './snapshot';
import { runSearch } from '../engine/search';
import { windowFor } from './window';
import { frame } from '../canvas/view';

const at = (r: number, c: number) => ({ clientX: c * 20 + 10, clientY: r * 20 + 10, button: 0, pointerId: 1, pointerType: 'mouse' });
const tableWalls = () => document.querySelectorAll('.legacy-mirror td[class*="_wall"]').length;
const flush = () => act(() => new Promise((r) => setTimeout(r, 0))); // the mirror reads the table a microtask later

function stageWith(tool: Tool) {
	const board = new Board();
	const mirror = new LegacyMirror(); // no table attached: its window is empty
	const scene = { current: { board, mirror, palette: PALETTES['paper-light'], trace: null, anim: new CellAnim(), speed: 'fast' as const, learnCurrent: false, reducedMotion: true, bestPath: null } as SceneInput };
	const ref = createRef<StageApi>();
	const props = { scene, weight: 5 as const, editable: true, insets: { top: 0, right: 0, bottom: 0, left: 0 }, onInteract: () => {}, onZoom: () => {} };
	const view = render(<CanvasStage ref={ref} {...props} tool={tool} />);
	const canvas = document.querySelector('canvas')!;
	const click = (r: number, c: number) => {
		act(() => void fireEvent.pointerDown(canvas, at(r, c)));
		act(() => void fireEvent.pointerUp(canvas, at(r, c)));
	};
	return { board, mirror, click, setTool: (t: Tool) => view.rerender(<CanvasStage ref={ref} {...props} tool={t} />) };
}

test('windowFor centres a 35x80 window on two cells, or refuses when they are too far apart', () => {
	expect(windowFor({ r: 17, c: 15 }, { r: 17, c: 64 })).toEqual({ r: 0, c: 0 });
	expect(windowFor({ r: 17, c: 100 }, { r: 17, c: 64 })).toEqual({ r: 0, c: 43 });
	expect(windowFor({ r: -400, c: 5 }, { r: -366, c: 84 })).toEqual({ r: -400, c: 5 }); // 35 x 80 exactly
	expect(windowFor({ r: -400, c: 5 }, { r: -365, c: 5 })).toBeNull();
	expect(windowFor({ r: 0, c: 5 }, { r: 0, c: 85 })).toBeNull();
});

function shell() {
	render(
		<TableContextProvider>
			<AppShell />
		</TableContextProvider>,
	);
	return document.querySelector('canvas')!;
}
function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
	act(() => void fireEvent.pointerDown(canvas, at(...from)));
	act(() => void fireEvent.pointerMove(canvas, at(...to)));
	act(() => void fireEvent.pointerUp(canvas, at(...to)));
	act(() => void fireEvent.mouseUp(window));
}

test('small screens: Duck 1 starts closer only when the classic gap cannot fit at 75 %', () => {
	expect(closerDuckGap(1280)).toBeNull();
	expect(closerDuckGap(1024)).toBeNull();
	expect(closerDuckGap(844)).toBe(47);
	expect(closerDuckGap(390)).toBe(17);
	expect(closerDuckGap(200)).toBe(6);
	// and Home then frames them at >= 75 %
	const v = frame({ r0: 14, c0: 12, r1: 20, c1: 15 + 17 + 3 }, 390, 700, { top: 68, right: 12, bottom: 68, left: 12 }, 1.5, 0.75);
	expect(v.zoom).toBeGreaterThanOrEqual(0.75);
});

const touch = (id: number, x: number, y: number) => ({ clientX: x, clientY: y, button: 0, pointerId: id, pointerType: 'touch' });

test('Draw mode: two fingers pan (and pinch zooms) without leaving the table stuck mid-wall', async () => {
	const canvas = shell();
	await flush();
	const pct = () => parseInt(screen.getByLabelText('Zoom to 100%').textContent!, 10);
	// finger 1 lands on a cell (that starts a wall), finger 2 joins: now it's a pinch
	act(() => void fireEvent.pointerDown(canvas, touch(1, 210, 110)));
	act(() => void fireEvent.pointerDown(canvas, touch(2, 410, 110)));
	for (let k = 1; k <= 5; k++) {
		act(() => void fireEvent.pointerMove(canvas, touch(1, 210 + 20 * k, 110)));
		act(() => void fireEvent.pointerMove(canvas, touch(2, 410 + 20 * k, 110)));
	}
	act(() => void fireEvent.pointerUp(canvas, touch(1, 310, 110)));
	act(() => void fireEvent.pointerUp(canvas, touch(2, 510, 110)));
	expect(pct()).toBe(100); // same finger distance: a pure pan
	expect(tableWalls()).toBe(0); // the first finger's cell was taken back: two fingers never draw
	// panned right by 100 px = 5 cells: a tap at screen cell (8, 15) is world (8, 10)
	act(() => void fireEvent.pointerDown(canvas, touch(3, 15 * 20 + 10, 8 * 20 + 10)));
	act(() => void fireEvent.pointerUp(canvas, touch(3, 15 * 20 + 10, 8 * 20 + 10)));
	expect(document.getElementById('8-10')!.className).toMatch(/_wall/); // the table took the tap: not stuck
	// spread two fingers: pinch zoom in
	act(() => void fireEvent.pointerDown(canvas, { ...touch(4, 400, 300), pointerType: 'touch' }));
	act(() => void fireEvent.pointerDown(canvas, touch(5, 500, 300)));
	act(() => void fireEvent.pointerMove(canvas, touch(5, 600, 300)));
	act(() => void fireEvent.pointerUp(canvas, touch(4, 400, 300)));
	act(() => void fireEvent.pointerUp(canvas, touch(5, 600, 300)));
	expect(pct()).toBe(200);
});

test('after a two-finger gesture that began on a cell, the Arrow still drags (no stuck table state)', async () => {
	const canvas = shell();
	await flush();
	act(() => void fireEvent.pointerDown(canvas, touch(1, 210, 110)));
	act(() => void fireEvent.pointerDown(canvas, touch(2, 410, 110)));
	act(() => void fireEvent.pointerUp(canvas, touch(1, 210, 110)));
	act(() => void fireEvent.pointerUp(canvas, touch(2, 410, 110)));
	drag(canvas, [17, 15], [20, 18]);
	expect(document.getElementById('20-18')!.className).toMatch(/_starting/);
});

test('the Hand tool: one finger pans', async () => {
	const canvas = shell();
	await flush();
	act(() => void fireEvent.keyDown(window, { key: 'p' }));
	act(() => void fireEvent.pointerDown(canvas, touch(1, 200, 200)));
	act(() => void fireEvent.pointerMove(canvas, touch(1, 260, 240)));
	act(() => void fireEvent.pointerUp(canvas, touch(1, 260, 240)));
	expect(document.querySelectorAll('.legacy-mirror td[class*="_wall"]')).toHaveLength(0); // nothing painted
	act(() => void fireEvent.keyDown(window, { key: 'w' }));
	// panned by (60, 40) px = (3, 2) cells: screen cell (10, 13) is world (8, 10)
	act(() => void fireEvent.pointerDown(canvas, touch(2, 13 * 20 + 10, 10 * 20 + 10)));
	act(() => void fireEvent.pointerUp(canvas, touch(2, 13 * 20 + 10, 10 * 20 + 10)));
	expect(document.getElementById('8-10')!.className).toMatch(/_wall/);
});

test('a 390 px screen: Duck 1 starts 17 columns from the Arrow, and the saved speed survives the move', async () => {
	localStorage.setItem('dtd.ui.v1', JSON.stringify({ chrome: 'light', cells: 'paper', speed: 'light' }));
	const w = window.innerWidth;
	window.innerWidth = 390;
	try {
		shell();
		await flush();
		await flush();
		expect(document.getElementById('17-32')!.className).toMatch(/_ending/);
		expect(document.querySelectorAll('.legacy-mirror td[class*="_ending"]')).toHaveLength(1);
		expect(within(screen.getByRole('group', { name: 'Speed', hidden: true })).getByRole('button', { name: 'Light', hidden: true }).getAttribute('aria-pressed')).toBe('true');
		expect(document.querySelector('.legacy-mirror td[class*="light_"]')).toBeNull(); // the classic theme was not rolled back either
	} finally {
		window.innerWidth = w;
		localStorage.clear();
	}
});
