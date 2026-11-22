// The infinite canvas: owns the view, input gestures and the draw loop.
import { BOARD, inBoard } from '../model/bounds';
import { flushSync } from 'react-dom';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Board, Dir, Tile, Weight } from '../model/board';
import { dirOf, nextDuck, nextPadPair } from '../model/nodes';
import { Bounds, HOME } from '../model/cell';
import { TraceState } from '../learn/player';
import { K, LegacyMirror, legacy } from './mirror';
import { Palette } from './palette';
import { render, Scene } from './render';
import { Insets, View, cellAt, frame, nextStop, visibleBounds, zoomAt } from './view';
import { clampView } from './view';
import { CellAnim, Speed } from './cellAnim';
import { LaneDrag, laneEnd, laneMove, laneStart, turn } from './laneDrag';
import { CELL } from './view';

export type Tool = 'wall' | 'weight' | 'oneway' | 'pad' | 'duck' | 'erase' | 'pan';
/** Tools that place one node per click (no drag painting). */
const CLICK_TOOLS = new Set<Tool>(['pad', 'duck']);

export type SceneInput = {
	board: Board;
	mirror: LegacyMirror;
	palette: Palette;
	trace: TraceState | null;
	/** the traced run's cells for the search motion (cellAnim.ts) */
	anim: CellAnim;
	/** the playback speed: picks the motion timings */
	speed: Speed;
	learnCurrent: boolean;
	reducedMotion: boolean;
	bestPath: { r: number; c: number }[] | null; // classic run: overlay only, never written to the table
	classicWindow?: Bounds | null;
	ghost?: { kind: 'start' | 'end'; r: number; c: number } | null;
	bands?: boolean;
	/** the head of a lane drag, for the lead arrow (one-way spec §1.3) */
	drag?: { r: number; c: number; dir: Dir } | null;
};

export type StageApi = {
	home: () => void;
	fit: () => void;
	zoomStep: (dir: 1 | -1) => void;
	zoomTo: (z: number) => void;
	invalidate: () => void;
	/** The cells fully in view (null before the stage has a size). */
	viewCells: () => Bounds | null;
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
	/** What Home (H) frames: the Arrow and Duck. */
	homeBounds?: () => Bounds;
	/** Least zoom Home may pick (phones keep cells tappable). */
	homeMinZoom?: number;
	/** What Fit frames: everything placed. */
	fitBounds?: () => Bounds;
	/** A lane drag ended: its direction becomes the tap direction (one-way spec §1.2). */
	onLaneDir?: (d: Dir) => void;
	/** The Arrow or Duck was dropped outside the classic window. */
	onEndpointDrop?: (which: 'start' | 'end', cell: { r: number; c: number }) => void;
};

type Gesture =
	| { mode: 'none' }
	| { mode: 'pan'; x: number; y: number }
	| { mode: 'legacy'; pointerType: string; last: { r: number; c: number }; endpoint: 'start' | 'end' | null; ghost?: { r: number; c: number } | null; undo?: () => void }
	| { mode: 'paint'; last: { r: number; c: number }; undo?: () => void }
	| { mode: 'lane'; drag: LaneDrag; touched: Map<string, Tile | undefined>; shift: boolean }
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
	// (an endpoint dropped outside the window is placed on pointer up: see onEndpointDrop)
	if (inside) return 'legacy';
	return !endpoint && tool === 'wall' ? 'paint' : 'none';
}

export const CanvasStage = forwardRef<StageApi, Props>(function CanvasStage(props, ref) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const view = useRef<View>({ panX: 0, panY: 0, zoom: 1 });
	const size = useRef({ w: 0, h: 0, dpr: 1 });
	// Setting dirty.current = true wakes the frame loop, which otherwise sleeps
	// (no rAF scheduled) once nothing animates: an idle board costs no frames.
	const wake = useRef<() => void>(() => {});
	const dirty = useMemo(() => {
		let v = true;
		return {
			get current() {
				return v;
			},
			set current(x: boolean) {
				v = x;
				if (x) wake.current();
			},
		};
	}, []);
	const activeAt = useRef(0); // last change: the duck bob runs 3 cycles after it (§4.5 v2.2)
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
		if (size.current.w) v = clampView(v, size.current.w, size.current.h, BOARD);
		const zoomChanged = v.zoom !== view.current.zoom;
		// the cell under a still pointer changes with the view; drop the stale outline
		if (zoomChanged || v.panX !== view.current.panX || v.panY !== view.current.panY) hover.current = null;
		view.current = v;
		dirty.current = true;
		if (zoomChanged) live.current.onZoom(v.zoom);
	};
	const frameBounds = (b: Bounds, minZoom?: number) => {
		const { w, h } = size.current;
		if (!w) return;
		setView(frame(b, w, h, live.current.insets, 1.5, minZoom));
		live.current.onZoom(view.current.zoom);
	};
	const api: StageApi = {
		home: () => {
			autoFrame.current = 'home';
			frameBounds(live.current.homeBounds?.() ?? HOME, live.current.homeMinZoom);
		},
		fit: () => {
			autoFrame.current = 'fit';
			frameBounds(live.current.fitBounds?.() ?? BOARD);
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
		viewCells: () => {
			const { w, h } = size.current;
			if (!w || !h) return null;
			const v = visibleBounds(view.current, w, h); // one cell of slack each side
			return { r0: v.r0 + 2, c0: v.c0 + 2, r1: v.r1 - 2, c1: v.c1 - 2 };
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
			raf = 0;
			if (!ctx || (!dirty.current && !animating)) return; // idle: no next frame until dirty wakes it
			const now = performance.now();
			if (dirty.current) activeAt.current = now;
			dirty.current = false;
			const s = live.current.scene.current;
			const scene: Scene = {
				...s,
				view: view.current,
				width: size.current.w,
				height: size.current.h,
				dpr: size.current.dpr,
				hover: live.current.editable ? hover.current : null,
				tool: live.current.tool,
				tapDir: live.current.dir ?? 1,
				now,
				activeAt: activeAt.current,
			};
			animating = render(ctx, scene);
			if (animating) raf = requestAnimationFrame(loop);
		};
		wake.current = () => {
			if (!raf) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		// canvas text (stamps, letters, badges) uses web fonts: repaint once they load
		document.fonts?.ready.then(() => (dirty.current = true)).catch(() => {});
		return () => {
			wake.current = () => {};
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
			const g = gesture.current;
			if (e.key === 'Escape' && g.mode === 'lane') {
				// cancel the drag: every cell it touched goes back
				restoreLane(g);
				gesture.current = { mode: 'none' };
				return;
			}
			if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey && live.current.tool === 'oneway' && live.current.editable && hover.current && !(e.target instanceof HTMLInputElement)) {
				turnLane(hover.current.r, hover.current.c, e.shiftKey);
				return;
			}
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

	const clearGhost = () => {
		if (live.current.scene.current.ghost) {
			live.current.scene.current.ghost = null;
			dirty.current = true;
		}
	};
	const local = (e: { clientX: number; clientY: number }) => {
		const rect = canvasRef.current!.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	};

	/** Where a node may go: not on a Home wall or the Arrow/Duck. */
	const placeable = (r: number, c: number) => {
		if (!inBoard(r, c)) return false;
		const { board, mirror } = live.current.scene.current;
		if (!mirror.inWindow(r, c)) return board.get(r, c)?.kind !== 'wall' && !mirror.endpointAt(r, c);
		const k = mirror.at(r, c);
		return k !== K.Start && k !== K.End && k !== K.Wall;
	};
	// ---- one-way lanes (one-way spec §1)
	const world = (p: { x: number; y: number }) => {
		const sz = CELL * view.current.zoom;
		return { x: (p.x - view.current.panX) / sz, y: (p.y - view.current.panY) / sz };
	};
	const restoreLane = (g: Extract<Gesture, { mode: 'lane' }>) => {
		const { board } = live.current.scene.current;
		for (const [k, prev] of g.touched) {
			const [r, c] = k.split(',').map(Number);
			board.set(r, c, prev);
		}
		g.touched.clear();
		live.current.scene.current.drag = null;
		dirty.current = true;
	};
	/** Tap on a lane: a quarter turn, clockwise (Shift: counter-clockwise). Returns false when there's no lane. */
	const turnLane = (r: number, c: number, ccw: boolean) => {
		const { board } = live.current.scene.current;
		const t = board.get(r, c);
		if (t?.kind !== 'oneway') return false;
		board.set(r, c, { kind: 'oneway', dir: turn(t.dir, ccw) });
		dirty.current = true;
		return true;
	};
	const layLane = (g: Extract<Gesture, { mode: 'lane' }>) => (r: number, c: number, d: Dir) => {
		if (!placeable(r, c)) return; // walls, the Arrow and the Duck are skipped
		const { board } = live.current.scene.current;
		const k = `${r},${c}`;
		if (!g.touched.has(k)) g.touched.set(k, board.get(r, c));
		board.set(r, c, { kind: 'oneway', dir: d });
		dirty.current = true;
	};

	const paintCell = (r: number, c: number, dir?: Dir) => {
		const { tool, weight, scene } = live.current;
		const { board, mirror } = scene.current;
		if (!inBoard(r, c)) return; // the board is bounded: nothing lands off it
		if (mirror.free && mirror.endpointAt(r, c)) return; // free mode: the Arrow and Duck 1 aren't in the table to guard their cells
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
		if (mirror.inWindow(r, c)) {
			const k = mirror.at(r, c);
			if (k === K.Start || k === K.End) return;
			if (tool === 'erase') {
				legacy.eraseWall(mirror.idAt(r, c));
				board.set(r, c, undefined);
			} else if (tool === 'weight' && k !== K.Wall) board.set(r, c, { kind: 'weight', cost: weight });
			return; // walls in the classic window are painted by the legacy handlers
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
			// a second finger turns any one-finger gesture into pinch-zoom + two-finger pan;
			// end a table drag first, or the table stays in its building/dragging state
			const g0 = gesture.current;
			// a second finger within the first cell means "pan/zoom", not "draw": take the first cell back
			if ((g0.mode === 'legacy' || g0.mode === 'paint') && g0.undo) g0.undo();
			if (g0.mode === 'lane') restoreLane(g0);
			if (g0.mode === 'legacy') legacy.up();
			clearGhost();
			const [a, b] = [...pointers.current.values()];
			gesture.current = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
			return;
		}
		const { tool, editable, scene } = live.current;
		if (e.button === 2 && tool === 'oneway' && editable) {
			// right-click with One-way: erase the lane (desktop)
			const cell = cellAt(view.current, p.x, p.y);
			if (scene.current.board.get(cell.r, cell.c)?.kind === 'oneway') {
				scene.current.board.set(cell.r, cell.c, undefined);
				dirty.current = true;
			}
			return;
		}
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
		const { mirror } = scene.current;
		const freeEnd = mirror.free ? mirror.endpointAt(cell.r, cell.c) : null;
		if (freeEnd) {
			// free mode: no table to drag in; a ghost follows the pointer and the drop places it
			scene.current.ghost = { kind: freeEnd, ...cell };
			gesture.current = { mode: 'legacy', pointerType: e.pointerType, last: cell, endpoint: freeEnd, ghost: cell };
			dirty.current = true;
			return;
		}
		const inside = mirror.inWindow(cell.r, cell.c);
		const k = mirror.at(cell.r, cell.c);
		if (inside && (k === K.Start || k === K.End || tool === 'wall')) {
			// Classic gestures: the legacy table's own handlers do the work.
			const id = mirror.idAt(cell.r, cell.c);
			const endpoint = k === K.Start ? 'start' : k === K.End ? 'end' : null;
			// Commit the table's isBuilding before the first move: the original
			// painted the pressed cell on the first mousemove inside it, so a
			// plain click paints one wall.
			flushSync(() => legacy.down(id));
			if (!endpoint && tool === 'wall') legacy.move(id);
			const undo = !endpoint && tool === 'wall' && k !== K.Wall && e.pointerType !== 'mouse' ? () => legacy.eraseWall(id) : undefined;
			gesture.current = { mode: 'legacy', pointerType: e.pointerType, last: cell, endpoint, undo };
			return;
		}
		if (tool === 'oneway') {
			if (!inBoard(cell.r, cell.c)) return;
			const w = world(p);
			gesture.current = { mode: 'lane', drag: laneStart(w.x, w.y), touched: new Map(), shift: e.shiftKey };
			return;
		}
		const prev = scene.current.board.get(cell.r, cell.c);
		paintCell(cell.r, cell.c);
		const undo = e.pointerType !== 'mouse' ? () => void scene.current.board.set(cell.r, cell.c, prev) : undefined;
		gesture.current = { mode: 'paint', last: cell, undo };
	};

	const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		const p = local(e);
		if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
		const cell = cellAt(view.current, p.x, p.y);
		if (!hover.current || hover.current.r !== cell.r || hover.current.c !== cell.c || !live.current.editable) {
			// no hover ring while drawing is locked: it promises a cell that won't paint
			hover.current = e.pointerType === 'mouse' && live.current.editable && inBoard(cell.r, cell.c) ? cell : null;
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
				const m = live.current.scene.current.mirror;
				for (const q of line(g.last, cell)) {
					const act = legacyDragAction(!!g.endpoint, live.current.tool, m.inWindow(q.r, q.c));
					if (act === 'legacy') legacy.move(m.idAt(q.r, q.c));
					else if (act === 'paint') paintCell(q.r, q.c);
				}
				// past the window the table can't follow: show a ghost, place it on drop
				const ghost = g.endpoint && !m.inWindow(cell.r, cell.c) ? cell : null;
				live.current.scene.current.ghost = ghost && g.endpoint ? { kind: g.endpoint, ...ghost } : null;
				dirty.current = true;
				gesture.current = { ...g, last: cell, ghost, undo: undefined };
			}
		} else if (g.mode === 'lane') {
			const w = world(p);
			laneMove(g.drag, w.x, w.y, layLane(g));
			const d = g.drag;
			const head = d.dir !== null ? { ...d.cur, dir: d.dir } : null;
			const cur = live.current.scene.current.drag;
			if (head?.r !== cur?.r || head?.c !== cur?.c || head?.dir !== cur?.dir) {
				live.current.scene.current.drag = head;
				dirty.current = true;
			}
		} else if (g.mode === 'paint') {
			if ((cell.r !== g.last.r || cell.c !== g.last.c) && !CLICK_TOOLS.has(live.current.tool)) {
				for (const q of line(g.last, cell)) paintCell(q.r, q.c);
				gesture.current = { mode: 'paint', last: cell, undo: undefined };
			}
		}
	};

	const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
		pointers.current.delete(e.pointerId);
		const g = gesture.current;
		// Mouse buttons already bubble a native mouseup to window (the legacy
		// listener); touch and pen don't, so send one. A drop outside the window
		// ends the table drag now, then places the Arrow/Duck there.
		if (g.mode === 'legacy' && g.endpoint && g.ghost) {
			flushSync(() => legacy.up());
			clearGhost();
			live.current.onEndpointDrop?.(g.endpoint, g.ghost);
		} else if (g.mode === 'legacy' && g.pointerType !== 'mouse') legacy.up();
		else if (g.mode === 'lane' && e.type !== 'pointercancel') {
			const d = g.drag;
			if (!d.axis) {
				// a tap: turn the lane under it, or place one in the tap direction
				const { r, c } = d.cur;
				if (!turnLane(r, c, g.shift || e.shiftKey) && placeable(r, c)) {
					live.current.scene.current.board.set(r, c, { kind: 'oneway', dir: live.current.dir ?? 1 });
					dirty.current = true;
				}
			} else {
				const w = world(local(e));
				laneEnd(d, w.x, w.y, layLane(g));
				if (d.dir !== null) live.current.onLaneDir?.(d.dir);
			}
			live.current.scene.current.drag = null;
			dirty.current = true;
		} else if (g.mode === 'lane') {
			live.current.scene.current.drag = null; // a cancelled pointer keeps what it laid (Esc and a second finger undo)
			dirty.current = true;
		}
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
