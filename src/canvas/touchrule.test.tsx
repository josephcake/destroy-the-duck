// The touch rule (CanvasStage.tsx): one finger draws, two fingers pan/zoom, the Pan
// tool makes one finger pan. A second finger within TOUCH_GRACE_MS takes back the
// whole first-finger stroke (even a few cells of it); later, the stroke stays.
import { createRef } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { CellAnim } from './cellAnim';
import { CanvasStage, SceneInput, StageApi, Tool, TOUCH_GRACE_MS } from './CanvasStage';
import { Board } from '../model/board';
import { LegacyMirror } from './mirror';
import { PALETTES } from './palette';

const touch = (id: number, r: number, c: number) => ({ clientX: c * 20 + 10, clientY: r * 20 + 10, button: 0, pointerId: id, pointerType: 'touch' });

function stage(tool: Tool) {
	const board = new Board();
	const scene = { current: { board, mirror: new LegacyMirror(), palette: PALETTES['paper-light'], trace: null, anim: new CellAnim(), speed: 'fast' as const, learnCurrent: false, reducedMotion: true, bestPath: null } as SceneInput };
	render(<CanvasStage ref={createRef<StageApi>()} scene={scene} weight={5} editable insets={{ top: 0, right: 0, bottom: 0, left: 0 }} onInteract={() => {}} onZoom={() => {}} tool={tool} />);
	const all = document.querySelectorAll<HTMLCanvasElement>('[data-testid="board-canvas"]');
	return { board, canvas: all[all.length - 1] };
}
const count = (b: Board) => [...b.entries()].length;
let now = 1000;
beforeEach(() => {
	now = 1000;
	vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());

test.each(['weight', 'erase'] as Tool[])('%s: a quick second finger takes back the whole stroke, then two fingers pan', (tool) => {
	const { board, canvas } = stage(tool);
	if (tool === 'erase') for (let c = 2; c <= 8; c++) board.set(3, c, { kind: 'weight', cost: 5 });
	const before = count(board);
	act(() => void fireEvent.pointerDown(canvas, touch(1, 3, 2)));
	now += 60;
	act(() => void fireEvent.pointerMove(canvas, touch(1, 3, 5))); // three more cells
	now += 60;
	act(() => void fireEvent.pointerDown(canvas, touch(2, 6, 9))); // within the grace: it was a pinch
	act(() => void fireEvent.pointerMove(canvas, touch(1, 3, 8)));
	act(() => void fireEvent.pointerUp(canvas, touch(1, 3, 8)));
	act(() => void fireEvent.pointerMove(canvas, touch(2, 6, 12))); // the last finger alone doesn't draw
	act(() => void fireEvent.pointerUp(canvas, touch(2, 6, 12)));
	expect(count(board)).toBe(before);
});

test('a deliberate stroke stays when a second finger comes later', () => {
	const { board, canvas } = stage('weight');
	act(() => void fireEvent.pointerDown(canvas, touch(1, 3, 2)));
	now += TOUCH_GRACE_MS + 50;
	act(() => void fireEvent.pointerMove(canvas, touch(1, 3, 5)));
	act(() => void fireEvent.pointerDown(canvas, touch(2, 6, 9)));
	act(() => void fireEvent.pointerUp(canvas, touch(1, 3, 5)));
	act(() => void fireEvent.pointerUp(canvas, touch(2, 6, 9)));
	expect(count(board)).toBe(4); // (3,2)..(3,5)
});

test('one finger draws checkpoints; the Pan tool makes one finger pan', () => {
	const { board, canvas } = stage('weight');
	act(() => void fireEvent.pointerDown(canvas, touch(1, 4, 4)));
	now += 400;
	act(() => void fireEvent.pointerMove(canvas, touch(1, 4, 6)));
	act(() => void fireEvent.pointerUp(canvas, touch(1, 4, 6)));
	expect([...board.entries()].map(([r, c, t]) => [r, c, t.kind])).toEqual([[4, 4, 'weight'], [4, 5, 'weight'], [4, 6, 'weight']]);
	const pan = stage('pan');
	act(() => void fireEvent.pointerDown(pan.canvas, touch(1, 4, 4)));
	act(() => void fireEvent.pointerMove(pan.canvas, touch(1, 8, 9)));
	act(() => void fireEvent.pointerUp(pan.canvas, touch(1, 8, 9)));
	expect(count(pan.board)).toBe(0);
	expect(count(board)).toBe(3); // and the first stage got nothing more
});
