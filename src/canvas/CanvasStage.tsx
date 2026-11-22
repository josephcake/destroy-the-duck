// The infinite canvas: owns the view, input gestures and the draw loop.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Board, Weight } from '../model/board';
import { Bounds, HOME, idOf, inHome } from '../model/cell';
import { TraceState } from '../learn/player';
import { K, LegacyMirror, legacy } from './mirror';
import { Palette } from './palette';
import { render, Scene } from './render';
import { Insets, View, cellAt, frame, nextStop, zoomAt } from './view';

export type Tool = 'wall' | 'weight' | 'erase' | 'pan';

export type SceneInput = {
	board: Board;
	mirror: LegacyMirror;
	palette: Palette;
	trace: TraceState | null;
	traceTimes: Map<string, number>;
	learnCurrent: boolean;
	reducedMotion: boolean;
	bestPath: { r: number; c: number }[] | null; // classic run: overlay only, never written to the table
};

export type StageApi = {
	home: () => void;
	fit: () => void;
	zoomStep: (dir: 1 | -1) => void;
	zoomTo: (z: number) => void;
	invalidate: () => void;
};

type Props = {
	scene: React.MutableRefObject<SceneInput>;
	tool: Tool;
	weight: Weight;
	editable: boolean;
	insets: Insets;
	onInteract: () => void;
	onZoom: (z: number) => void;
};

type Gesture =
	| { mode: 'none' }
	| { mode: 'pan'; x: number; y: number }
	| { mode: 'legacy'; pointerType: string; last: { r: number; c: number }; endpoint: boolean }
	| { mode: 'paint'; last: { r: number; c: number } }
	| { mode: 'pinch'; dist: number; mx: number; my: number };

function* line(a: { r: number; c: number }, b: { r: number; c: number }) {
	const n = Math.max(Math.abs(b.r - a.r), Math.abs(b.c - a.c));
	for (let i = 1; i <= n; i++)
		yield { r: Math.round(a.r + ((b.r - a.r) * i) / n), c: Math.round(a.c + ((b.c - a.c) * i) / n) };
}

/**
 * A drag that began on the classic table: inside Home the table's own
 * handlers decide (they move the Arrow/Duck or build walls). Outside Home a
 * wall drag keeps painting board walls, but an Arrow/Duck drag never paints.
 */
export function legacyDragAction(endpoint: boolean, tool: Tool, inside: boolean): 'legacy' | 'paint' | 'none' {
	if (inside) return 'legacy';
	return !endpoint && tool === 'wall' ? 'paint' : 'none';
}

export const CanvasStage = forwardRef<StageApi, Props>(function CanvasStage(props, ref) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const view = useRef<View>({ panX: 0, panY: 0, zoom: 1 });
	const size = useRef({ w: 0, h: 0, dpr: 1 });
	const dirty = useRef(true);
	const hover = useRef<{ r: number; c: number } | null>(null);
	const gesture = useRef<Gesture>({ mode: 'none' });
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const space = useRef(false);
	const framed = useRef(false);
	const live = useRef(props);
	live.current = props;

	const setView = (v: View) => {
		const zoomChanged = v.zoom !== view.current.zoom;
		view.current = v;
		dirty.current = true;
		if (zoomChanged) live.current.onZoom(v.zoom);
	};
	const frameBounds = (b: Bounds) => {
		const { w, h } = size.current;
		if (!w) return;
		setView(frame(b, w, h, live.current.insets));
		live.current.onZoom(view.current.zoom);
	};
	const api: StageApi = {
		home: () => frameBounds(HOME),
		fit: () => {
			const c = live.current.scene.current.board.contentBounds();
			const b = c
				? { r0: Math.min(HOME.r0, c.r0) - 4, c0: Math.min(HOME.c0, c.c0) - 4, r1: Math.max(HOME.r1, c.r1) + 4, c1: Math.max(HOME.c1, c.c1) + 4 }
				: { r0: -4, c0: -4, r1: HOME.r1 + 4, c1: HOME.c1 + 4 };
			frameBounds(b);
		},
		zoomStep: (dir) => {
			const { w, h } = size.current;
			setView(zoomAt(view.current, w / 2, h / 2, nextStop(view.current.zoom, dir)));
		},
		zoomTo: (z) => {
			const { w, h } = size.current;
			setView(zoomAt(view.current, w / 2, h / 2, z));
		},
		invalidate: () => {
			dirty.current = true;
		},
	};
	useImperativeHandle(ref, () => api);

	// size + draw loop
	useEffect(() => {
		const canvas = canvasRef.current!;
		const ctx = canvas.getContext?.('2d') ?? null;
		const resize = () => {
			const rect = canvas.parentElement!.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			size.current = { w: rect.width, h: rect.height, dpr };
			canvas.width = Math.round(rect.width * dpr);
			canvas.height = Math.round(rect.height * dpr);
			if (!framed.current && rect.width > 0) {
				framed.current = true;
				api.home();
			}
			dirty.current = true;
		};
		resize();
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
		ro?.observe(canvas.parentElement!);
		let raf = 0;
		let animating = false;
		const loop = () => {
			raf = requestAnimationFrame(loop);
			if (!ctx || (!dirty.current && !animating)) return;
			dirty.current = false;
			const s = live.current.scene.current;
			const scene: Scene = {
				...s,
				view: view.current,
				width: size.current.w,
				height: size.current.h,
				dpr: size.current.dpr,
				hover: hover.current,
				now: performance.now(),
			};
			animating = render(ctx, scene);
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			ro?.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// re-frame Home when insets change (pinned legend, phone Learn layout)
	useEffect(() => {
		if (framed.current) api.home();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.insets.bottom, props.insets.top]);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) {
				space.current = true;
				e.preventDefault();
			}
		};
		const up = (e: KeyboardEvent) => {
			if (e.code === 'Space') space.current = false;
		};
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		return () => {
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
		};
	}, []);

	const local = (e: { clientX: number; clientY: number }) => {
		const rect = canvasRef.current!.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	};

	const paintCell = (r: number, c: number) => {
		const { tool, weight, scene } = live.current;
		const { board, mirror } = scene.current;
		if (inHome(r, c)) {
			const k = mirror.at(r, c);
			if (k === K.Start || k === K.End) return;
			if (tool === 'erase') {
				legacy.eraseWall(idOf(r, c));
				board.set(r, c, undefined);
			} else if (tool === 'weight' && k !== K.Wall) board.set(r, c, { kind: 'weight', cost: weight });
			return; // Home walls are painted by the legacy handlers
		}
		if (tool === 'wall') board.set(r, c, { kind: 'wall' });
		else if (tool === 'weight') board.set(r, c, { kind: 'weight', cost: weight });
		else if (tool === 'erase') board.set(r, c, undefined);
		dirty.current = true;
	};

	const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const p = local(e);
		pointers.current.set(e.pointerId, p);
		canvasRef.current!.setPointerCapture?.(e.pointerId);
		live.current.onInteract();
		if (pointers.current.size === 2) {
			const [a, b] = [...pointers.current.values()];
			gesture.current = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
			return;
		}
		const { tool, editable, scene } = live.current;
		if (e.button === 1 || space.current || tool === 'pan' || e.button === 2) {
			gesture.current = { mode: 'pan', x: p.x, y: p.y };
			return;
		}
		if (e.button !== 0 || !editable) return;
		const cell = cellAt(view.current, p.x, p.y);
		const inside = inHome(cell.r, cell.c);
		const k = inside ? scene.current.mirror.at(cell.r, cell.c) : K.Unvisited;
		if (inside && (k === K.Start || k === K.End || tool === 'wall')) {
			// Classic gestures: the legacy table's own handlers do the work.
			legacy.down(idOf(cell.r, cell.c));
			gesture.current = { mode: 'legacy', pointerType: e.pointerType, last: cell, endpoint: k === K.Start || k === K.End };
			return;
		}
		paintCell(cell.r, cell.c);
		gesture.current = { mode: 'paint', last: cell };
	};

	const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const p = local(e);
		if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
		const cell = cellAt(view.current, p.x, p.y);
		if (!hover.current || hover.current.r !== cell.r || hover.current.c !== cell.c) {
			hover.current = e.pointerType === 'mouse' ? cell : null;
			dirty.current = true;
		}
		const g = gesture.current;
		if (g.mode === 'pan') {
			setView({ ...view.current, panX: view.current.panX + p.x - g.x, panY: view.current.panY + p.y - g.y });
			gesture.current = { mode: 'pan', x: p.x, y: p.y };
		} else if (g.mode === 'pinch' && pointers.current.size >= 2) {
			const [a, b] = [...pointers.current.values()];
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			const mx = (a.x + b.x) / 2;
			const my = (a.y + b.y) / 2;
			const z = zoomAt(view.current, mx, my, view.current.zoom * (dist / Math.max(1, g.dist)));
			setView({ ...z, panX: z.panX + mx - g.mx, panY: z.panY + my - g.my });
			gesture.current = { mode: 'pinch', dist, mx, my };
		} else if (g.mode === 'legacy') {
			// Fast drags skip cells between pointer events; the old table got a
			// mouseover per cell, so replay every cell along the line.
			if (cell.r !== g.last.r || cell.c !== g.last.c) {
				for (const q of line(g.last, cell)) {
					const act = legacyDragAction(g.endpoint, live.current.tool, inHome(q.r, q.c));
					if (act === 'legacy') legacy.move(idOf(q.r, q.c));
					else if (act === 'paint') paintCell(q.r, q.c);
				}
				gesture.current = { ...g, last: cell };
			}
		} else if (g.mode === 'paint') {
			if (cell.r !== g.last.r || cell.c !== g.last.c) {
				for (const q of line(g.last, cell)) paintCell(q.r, q.c);
				gesture.current = { mode: 'paint', last: cell };
			}
		}
	};

	const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
		pointers.current.delete(e.pointerId);
		const g = gesture.current;
		// Mouse buttons already bubble a native mouseup to window (the legacy
		// listener); touch and pen don't, so send one.
		if (g.mode === 'legacy' && g.pointerType !== 'mouse') legacy.up();
		gesture.current = { mode: 'none' };
	};

	const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
		const p = local(e);
		const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
		setView(zoomAt(view.current, p.x, p.y, view.current.zoom * k));
	};

	useEffect(() => {
		// React's onWheel is passive; block page zoom/scroll on the canvas.
		const c = canvasRef.current!;
		const block = (e: WheelEvent) => e.preventDefault();
		c.addEventListener('wheel', block, { passive: false });
		return () => c.removeEventListener('wheel', block);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			data-testid="board-canvas"
			aria-label="Board. Drag to draw walls, scroll to zoom, space-drag to pan."
			role="img"
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
			onPointerLeave={() => {
				hover.current = null;
				dirty.current = true;
			}}
			onWheel={onWheel}
			onContextMenu={(e) => e.preventDefault()}
			style={{ cursor: props.tool === 'pan' ? 'grab' : 'crosshair' }}
		/>
	);
});
