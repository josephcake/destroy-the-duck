// The infinite canvas: owns the view, input gestures and the draw loop.
import { flushSync } from 'react-dom';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Board, Dir, Weight } from '../model/board';
import { dirOf, nextDuck, nextPadPair } from '../model/nodes';
import { Bounds, HOME, idOf, inHome } from '../model/cell';
import { TraceState } from '../learn/player';
import { K, LegacyMirror, legacy } from './mirror';
import { Palette } from './palette';
import { render, Scene } from './render';
import { Insets, View, cellAt, frame, nextStop, zoomAt } from './view';

export type Tool = 'wall' | 'weight' | 'oneway' | 'pad' | 'duck' | 'erase' | 'pan';
/** Tools that place one node per click (no drag painting). */
const CLICK_TOOLS = new Set<Tool>(['pad', 'duck']);

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
	/** One-way direction for clicks (drags follow the pointer). */
	dir?: Dir;
	editable: boolean;
	insets: Insets;
	onInteract: () => void;
	/** A draw gesture was refused because a search is running. */
	onLocked?: () => void;
	onZoom: (z: number) => void;
	/** What Home (H) frames; defaults to the classic 35x80 board. */
	homeBounds?: () => Bounds;
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
	// Mochi fix 6: the last framing the user asked for (Home or Fit) is redone
	// when the stage resizes (window, browser zoom, panel, insets). A manual
	// zoom or pan clears it, and then a resize keeps the zoom and the centre.
	const autoFrame = useRef<'home' | 'fit' | null>('home');
	const live = useRef(props);
	live.current = props;

	const setView = (v: View, manual = false) => {
		if (manual) autoFrame.current = null;
		const zoomChanged = v.zoom !== view.current.zoom;
		// the cell under a still pointer changes with the view; drop the stale outline
		if (zoomChanged || v.panX !== view.current.panX || v.panY !== view.current.panY) hover.current = null;
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
		home: () => {
			autoFrame.current = 'home';
			frameBounds(live.current.homeBounds?.() ?? HOME);
		},
		fit: () => {
			autoFrame.current = 'fit';
			const c = live.current.scene.current.board.contentBounds();
			const b = c
				? { r0: Math.min(HOME.r0, c.r0) - 4, c0: Math.min(HOME.c0, c.c0) - 4, r1: Math.max(HOME.r1, c.r1) + 4, c1: Math.max(HOME.c1, c.c1) + 4 }
				: { r0: -4, c0: -4, r1: HOME.r1 + 4, c1: HOME.c1 + 4 };
			frameBounds(b);
		},
		zoomStep: (dir) => {
			const { w, h } = size.current;
			setView(zoomAt(view.current, w / 2, h / 2, nextStop(view.current.zoom, dir)), true);
		},
		zoomTo: (z) => {
			const { w, h } = size.current;
			setView(zoomAt(view.current, w / 2, h / 2, z), true);
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
			const prev = size.current;
			size.current = { w: rect.width, h: rect.height, dpr };
			canvas.width = Math.round(rect.width * dpr);
			canvas.height = Math.round(rect.height * dpr);
			if (!framed.current && rect.width > 0) {
				framed.current = true;
				api.home();
			} else if (framed.current && rect.width > 0 && (rect.width !== prev.w || rect.height !== prev.h)) {
				if (autoFrame.current === 'home') api.home();
				else if (autoFrame.current === 'fit') api.fit();
				else setView({ ...view.current, panX: view.current.panX + (rect.width - prev.w) / 2, panY: view.current.panY + (rect.height - prev.h) / 2 });
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
				hover: live.current.editable ? hover.current : null,
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

	useEffect(() => {
		dirty.current = true; // the hover ring follows the drawing lock
	}, [props.editable]);

	// re-frame Home when insets change (pinned legend, phone Learn layout)
	useEffect(() => {
		if (!framed.current) return;
		if (autoFrame.current === 'home') api.home();
		else if (autoFrame.current === 'fit') api.fit();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [props.insets.bottom, props.insets.top, props.insets.right, props.insets.left]);

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

	/** Where a node may go: not on a Home wall or the Arrow/Duck. */
	const placeable = (r: number, c: number) => {
		if (!inHome(r, c)) return live.current.scene.current.board.get(r, c)?.kind !== 'wall';
		const k = live.current.scene.current.mirror.at(r, c);
		return k !== K.Start && k !== K.End && k !== K.Wall;
	};
	const paintCell = (r: number, c: number, dir?: Dir) => {
		const { tool, weight, scene } = live.current;
		const { board, mirror } = scene.current;
		if (tool === 'oneway') {
			if (placeable(r, c)) board.set(r, c, { kind: 'oneway', dir: dir ?? live.current.dir ?? 1 });
			dirty.current = true;
			return;
		}
		if (tool === 'pad' || tool === 'duck') {
			if (!placeable(r, c)) return;
			const t = board.get(r, c);
			if (t && t.kind === tool) board.set(r, c, undefined); // click again removes it
			else if (tool === 'pad') {
				const pair = nextPadPair(board);
				if (pair >= 0) board.set(r, c, { kind: 'pad', pair });
			} else {
				const n = nextDuck(board);
				if (n >= 0) board.set(r, c, { kind: 'duck', n });
			}
			dirty.current = true;
			return;
		}
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
		if (e.button !== 0) return;
		if (!editable) {
			// Drawing is locked while a search runs. Say so: a silent drop left
			// only the hover ring, which read as a white tile (Mochi check 3).
			live.current.onLocked?.();
			return;
		}
		const cell = cellAt(view.current, p.x, p.y);
		const inside = inHome(cell.r, cell.c);
		const k = inside ? scene.current.mirror.at(cell.r, cell.c) : K.Unvisited;
		if (inside && (k === K.Start || k === K.End || tool === 'wall')) {
			// Classic gestures: the legacy table's own handlers do the work.
			const id = idOf(cell.r, cell.c);
			const endpoint = k === K.Start || k === K.End;
			// Commit the table's isBuilding before the first move: the original
			// painted the pressed cell on the first mousemove inside it, so a
			// plain click paints one wall.
			flushSync(() => legacy.down(id));
			if (!endpoint && tool === 'wall') legacy.move(id);
			gesture.current = { mode: 'legacy', pointerType: e.pointerType, last: cell, endpoint };
			return;
		}
		paintCell(cell.r, cell.c);
		gesture.current = { mode: 'paint', last: cell };
	};

	const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const p = local(e);
		if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
		const cell = cellAt(view.current, p.x, p.y);
		if (!hover.current || hover.current.r !== cell.r || hover.current.c !== cell.c || !live.current.editable) {
			// no hover ring while drawing is locked: it promises a cell that won't paint
			hover.current = e.pointerType === 'mouse' && live.current.editable ? cell : null;
			dirty.current = true;
		}
		const g = gesture.current;
		if (g.mode === 'pan') {
			setView({ ...view.current, panX: view.current.panX + p.x - g.x, panY: view.current.panY + p.y - g.y }, true);
			gesture.current = { mode: 'pan', x: p.x, y: p.y };
		} else if (g.mode === 'pinch' && pointers.current.size >= 2) {
			const [a, b] = [...pointers.current.values()];
			const dist = Math.hypot(a.x - b.x, a.y - b.y);
			const mx = (a.x + b.x) / 2;
			const my = (a.y + b.y) / 2;
			const z = zoomAt(view.current, mx, my, view.current.zoom * (dist / Math.max(1, g.dist)));
			setView({ ...z, panX: z.panX + mx - g.mx, panY: z.panY + my - g.my }, true);
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
			if ((cell.r !== g.last.r || cell.c !== g.last.c) && !CLICK_TOOLS.has(live.current.tool)) {
				let prev = g.last;
				for (const q of line(g.last, cell)) {
					if (live.current.tool === 'oneway') {
						// a dragged lane points the way the pointer moved
						const d = dirOf(prev, q) ?? undefined;
						paintCell(prev.r, prev.c, d);
						paintCell(q.r, q.c, d);
					} else paintCell(q.r, q.c);
					prev = q;
				}
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
		setView(zoomAt(view.current, p.x, p.y, view.current.zoom * k), true);
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
			style={{ cursor: props.tool === 'pan' ? 'grab' : props.editable ? 'crosshair' : 'not-allowed' }}
		/>
	);
});
