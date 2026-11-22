// Prism one-way spec §1: drag to lay (direction follows the drag, L-turns),
// tap a lane to turn it (Shift: back), Esc cancels a drag, right-click erases,
// and the last drag's direction becomes the tap direction.
import { createRef } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { CanvasStage, SceneInput, StageApi } from './CanvasStage';
import { CellAnim } from './cellAnim';
import { Board, Dir } from '../model/board';
import { LegacyMirror } from './mirror';
import { PALETTES } from './palette';

const px = (x: number, y: number, extra: Record<string, unknown> = {}) => ({ clientX: x * 20, clientY: y * 20, button: 0, pointerId: 1, pointerType: 'mouse', ...extra });
function stage(dir: Dir = 1) {
	const board = new Board();
	const scene = { current: { board, mirror: new LegacyMirror(), palette: PALETTES['paper-light'], trace: null, anim: new CellAnim(), speed: 'fast' as const, learnCurrent: false, reducedMotion: true, bestPath: null } as SceneInput };
	const laneDirs: Dir[] = [];
	render(<CanvasStage ref={createRef<StageApi>()} scene={scene} tool="oneway" dir={dir} weight={5} editable insets={{ top: 0, right: 0, bottom: 0, left: 0 }} onInteract={() => {}} onZoom={() => {}} onLaneDir={(d) => laneDirs.push(d)} />);
	const canvas = document.querySelector('canvas')!;
	const down = (x: number, y: number, e = {}) => act(() => void fireEvent.pointerDown(canvas, px(x, y, e)));
	const move = (x: number, y: number) => act(() => void fireEvent.pointerMove(canvas, px(x, y)));
	const up = (x: number, y: number, e = {}) => act(() => void fireEvent.pointerUp(canvas, px(x, y, e)));
	const tap = (r: number, c: number, e = {}) => (down(c + 0.5, r + 0.5, e), up(c + 0.5, r + 0.5, e));
	const dirAt = (r: number, c: number) => {
		const t = board.get(r, c);
		return t?.kind === 'oneway' ? t.dir : null;
	};
	return { board, scene, down, move, up, tap, dirAt, laneDirs };
}
const glide = (s: ReturnType<typeof stage>, from: [number, number], to: [number, number], n = 30) => {
	for (let i = 1; i <= n; i++) s.move(from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n);
};

test('a drag lays a lane pointing the way you drag; its direction becomes the tap direction', () => {
	const s = stage(1);
	s.down(5.5, 5.5);
	glide(s, [5.5, 5.5], [5.5, 1.5]); // upward
	s.up(5.5, 1.5);
	for (let r = 1; r <= 5; r++) expect(s.dirAt(r, 5)).toBe(0);
	expect(s.laneDirs).toEqual([0]);
});

test('a 45° drag lays an L whose corner takes the new direction', () => {
	const s = stage();
	s.down(2.5, 2.5);
	glide(s, [2.5, 2.5], [7.5, 7.5]);
	s.up(7.5, 7.5);
	expect(s.dirAt(2, 2)).toBe(1);
	expect(s.dirAt(2, 7)).toBe(2); // corner
	expect(s.dirAt(7, 7)).toBe(2);
	expect(s.dirAt(3, 3)).toBeNull(); // no staircase
});

test('tap on an empty cell places the tap direction; tap on a lane turns it clockwise, Shift turns it back', () => {
	const s = stage(2);
	s.tap(4, 4);
	expect(s.dirAt(4, 4)).toBe(2);
	s.tap(4, 4);
	expect(s.dirAt(4, 4)).toBe(3);
	s.tap(4, 4);
	expect(s.dirAt(4, 4)).toBe(0);
	s.tap(4, 4, { shiftKey: true });
	expect(s.dirAt(4, 4)).toBe(3);
});

test('Esc during a drag restores every cell it touched', () => {
	const s = stage();
	s.tap(3, 6); // an existing lane (E) the drag will re-point
	s.down(2.5, 3.5);
	glide(s, [2.5, 3.5], [9.5, 3.5]);
	expect(s.dirAt(3, 9)).toBe(1);
	act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
	s.up(9.5, 3.5);
	expect(s.dirAt(3, 2)).toBeNull();
	expect(s.dirAt(3, 9)).toBeNull();
	expect(s.dirAt(3, 6)).toBe(1); // put back as it was
});

test('right-click with One-way erases a lane; R turns the hovered lane', () => {
	const s = stage();
	s.tap(6, 6);
	s.move(6.5, 6.5); // hover
	act(() => void fireEvent.keyDown(window, { key: 'r' }));
	expect(s.dirAt(6, 6)).toBe(2);
	act(() => void fireEvent.keyDown(window, { key: 'R', shiftKey: true }));
	expect(s.dirAt(6, 6)).toBe(1);
	s.down(6.5, 6.5, { button: 2 });
	s.up(6.5, 6.5, { button: 2 });
	expect(s.dirAt(6, 6)).toBeNull();
});

test('the board keeps the lane store in sync (render never scans the board)', () => {
	const s = stage();
	s.tap(1, 1);
	s.tap(1, 2);
	s.tap(1, 2); // turn E -> S
	expect(s.board.laneCount[1]).toBe(1);
	expect(s.board.laneCount[2]).toBe(1);
	s.board.set(1, 1, undefined);
	expect(s.board.laneCount[1]).toBe(0);
	expect(s.board.laneDir[1 * 80 + 1]).toBe(-1);
});
