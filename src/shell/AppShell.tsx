// The new app shell (Prism Paper Cutout v2.1; was "Open Pond"). Phase A: the classic TableContext and
// its 35x80 table stay mounted (hidden) and keep running the classic six
// unchanged; this shell drives them and paints everything on the canvas.
import { FAST_CELLS } from '../lib/speed';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// @ts-expect-error legacy JS module
import Main from '../Main/Main';
import { Board, Weight } from '../model/board';
import { HOME_COLS, HOME_ROWS, parseId } from '../model/cell';
import { LegacyMirror } from '../canvas/mirror';
import { CanvasStage, SceneInput, StageApi, Tool } from '../canvas/CanvasStage';
import { CellSet, Chrome, PALETTES, migrateCellSet } from '../canvas/palette';
import { SwatchKind } from '../canvas/render';
import { Swatch } from './Swatch';
import { searchAsync, wideAsync } from '../engine/runner';
import { ClassicAlgo, FindMode, Trace, TracedAlgo } from '../engine/trace';
import { TraceState } from '../learn/player';
import { buildSnapshot, contentBox, lonePads } from './snapshot';
import { classicFrame, dragTableCell, moveWindow, placeEndpoint, wideJob } from './window';
import { wideBlock } from '../classic/wide';
import { PAD_LETTER } from '../model/nodes';
import { unsupported } from '../engine/search';
import { Dir } from '../model/board';
import { Bounds } from '../model/cell';
import { classicBestPath } from './classicBest';
import { CLASSIC, MAZES, SPEEDS, SpeedName, speedEvent, useLegacy } from './legacy';
import { AlgoId, AlgoPicker, algoLabel, isTraced } from './AlgoPicker';
import { Inspector, StepBar } from './Learn';
import { Icon } from './icons';
import { applyGenerator } from './generate';
import { PORTRAIT_PHONE, RotatePrompt } from './RotatePrompt';
import { GENERATORS, GenId } from '../model/generators';
import '../vendor/paper-kit/tokens.css';
import '../vendor/paper-kit/paper-kit.css';
import './shell.css';

// Generator seeds never touch Math.random: Random Search (and its seeded
// goldens) draw from it, and one extra call shifts every later visit.
const newSeed = () => 1 + ((globalThis.crypto?.getRandomValues?.(new Uint32Array(1))[0] ?? Date.now()) % 99999);
const PHONE = '(max-width: 599px)'; // keep in step with shell.css
const LANDSCAPE_PHONE = '(max-height: 499px) and (orientation: landscape)'; // keep in step with shell.css
const PHONE_MIN_ZOOM = 0.75;
/** Columns between Arrow and Duck 1 that fit a w-px-wide screen at PHONE_MIN_ZOOM, or null when the classic 49 fit. */
export function closerDuckGap(w: number): number | null {
	const cols = Math.floor((w - 24) / (20 * PHONE_MIN_ZOOM)) - 7; // 3 cells each side, and the duck itself
	return cols >= 49 ? null : Math.max(6, cols);
}

type Prefs = { chrome: Chrome; cells: CellSet; speed: SpeedName };
const PREFS_KEY = 'dtd.ui.v1';
// The classic player's own default is Norm (100 ms a cell: BFS on an open
// board takes minutes). The new UI starts at Fast and remembers the choice.
export const DEFAULT_SPEED: SpeedName = 'fast';
const loadPrefs = (): Prefs => {
	const fallback: Prefs = { chrome: 'light', cells: 'paper', speed: DEFAULT_SPEED }; // Paper v2.1 is the default (was Pond)
	try {
		const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
		return {
			chrome: p.chrome === 'dark' ? 'dark' : 'light',
			cells: migrateCellSet(p.cells),
			speed: SPEEDS.some((s) => s.name === p.speed) ? p.speed : DEFAULT_SPEED,
		};
	} catch {
		return fallback;
	}
};

const TOOLS: { id: Tool; label: string; key: string; icon: () => React.ReactElement; hint: string }[] = [
	{ id: 'wall', label: 'Wall', key: 'w', icon: Icon.wall, hint: 'drag to paint, drag the Arrow or Duck to move them.' },
	{ id: 'weight', label: 'Weight', key: 'g', icon: Icon.weight, hint: 'drag to paint a cost. Classic algorithms ignore weights.' },
	{ id: 'oneway', label: 'One-way', key: 'o', icon: Icon.oneway, hint: 'drag to lay a lane that points the way you drag; a click uses the arrow below. Enter and leave only along the arrow.' },
	{ id: 'pad', label: 'Teleport', key: 't', icon: Icon.pad, hint: 'click two cells to make a pair (A and A′, then B and B′…); stepping on one jumps to the other for free. Click a pad to remove it.' },
	{ id: 'duck', label: 'Duck', key: 'd', icon: Icon.duck, hint: 'click to add another duck (2, 3, …); click it again to remove. Pick Nearest, All or Tour above.' },
	{ id: 'erase', label: 'Erase', key: 'e', icon: Icon.erase, hint: 'drag to clear walls, weights, lanes, pads and extra ducks.' },
	{ id: 'pan', label: 'Pan', key: 'p', icon: Icon.hand, hint: 'drag to move around the endless table.' },
];
const WEIGHT_NAMES: Record<Weight, string> = { 2: '2', 5: '5 · mud', 10: '10 · water' };

export function useMedia(query: string) {
	const get = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
	const [on, setOn] = useState(get);
	useEffect(() => {
		if (typeof window.matchMedia !== 'function') return;
		const mq = window.matchMedia(query);
		const f = () => setOn(mq.matches);
		mq.addEventListener?.('change', f);
		return () => mq.removeEventListener?.('change', f);
	}, [query]);
	return on;
}

/** Shortcuts stay live everywhere except where the user is typing text. */
export function isTyping(t: EventTarget | null) {
	if (!(t instanceof HTMLElement)) return false;
	if (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
	if (!(t instanceof HTMLInputElement)) return false;
	return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color'].includes(t.type);
}

export default function AppShell() {
	const ctx = useLegacy();
	const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
	const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
	const [tab, setTab] = useState<'sandbox' | 'learn'>('sandbox');
	const [algo, setAlgo] = useState<AlgoId | null>(null);
	const [learnAlgo, setLearnAlgo] = useState<TracedAlgo>('astar');
	const [pickerOpen, setPickerOpen] = useState(false);
	const [tool, setTool] = useState<Tool>('wall');
	const [weight, setWeight] = useState<Weight>(5);
	const [dir, setDir] = useState<Dir>(1);
	const [findMode, setFindMode] = useState<FindMode>('all');
	const [maze, setMaze] = useState('gen:backtracker'); // fills the view; the classic mazes stay one pick away
	const [seed, setSeed] = useState(newSeed);
	const [landing, setLanding] = useState(true);
	const [legendPinned, setLegendPinned] = useState(false);
	const [legendH, setLegendH] = useState(0);
	const [zoom, setZoom] = useState(1);
	const [newToast, setNewToast] = useState(false);
	const [lockedToast, setLockedToast] = useState(false);
	// a classic run that couldn't finish on a wide board says why (classic/wide.ts)
	const [wideToast, setWideToast] = useState<string | null>(null);
	useEffect(() => {
		if (!wideToast) return;
		const t = setTimeout(() => setWideToast(null), 8000);
		return () => clearTimeout(t);
	}, [wideToast]);
	useEffect(() => {
		if (!lockedToast) return;
		const t = setTimeout(() => setLockedToast(false), 2500);
		return () => clearTimeout(t);
	}, [lockedToast]);
	const [, setTick] = useState(0); // re-render on mirror / board changes
	const [playing, setPlaying] = useState(false);
	const [applied, setApplied] = useState(0);
	const [traceState, setTraceState] = useState<TraceState | null>(null);

	const stage = useRef<StageApi>(null);
	const board = useMemo(() => new Board(), []);
	const mirror = useMemo(() => new LegacyMirror(), []);
	const palette = PALETTES[`${prefs.cells}-${prefs.chrome}`];
	const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const scene = useRef<SceneInput>({ board, mirror, palette, trace: null, traceTimes: new Map(), learnCurrent: false, reducedMotion, bestPath: null });
	scene.current.palette = palette;
	scene.current.trace = traceState;
	scene.current.learnCurrent = tab === 'learn';
	// Classic runs: after a successful run, the best path (same Dijkstra the
	// Show Best Path button uses) is drawn as an overlay and fills Path/Cost.
	// Nothing is written to the classic table, so visit order is untouched.
	const [bestPath, setBestPath] = useState<string[] | null>(null);
	scene.current.bestPath = bestPath ? bestPath.map((id) => { const q = parseId(id); return { r: q.r + mirror.origin.r, c: q.c + mirror.origin.c }; }) : null;
	const classicRun = useRef(false);
	// ms stat for classic runs: wall-clock time of the animated run (Go to the
	// last cell), so the speed tiers can be compared. New algorithms show engine ms.
	const classicStart = useRef(0);
	const [classicMs, setClassicMs] = useState<number | null>(null);
	useEffect(() => {
		if (ctx.running || !classicRun.current) return;
		classicRun.current = false;
		setClassicMs(performance.now() - classicStart.current);
		if (ctx.isToastVisible) return;
		setBestPath(classicBestPath(ctx.starting, ctx.ending));
	}, [ctx.running, ctx.isToastVisible, ctx.starting, ctx.ending]);
	useEffect(() => stage.current?.invalidate(), [bestPath]);

	const rerender = useRef(0);
	const scheduleRender = useCallback(() => {
		stage.current?.invalidate();
		if (rerender.current) return;
		rerender.current = requestAnimationFrame(() => {
			rerender.current = 0;
			setTick((t) => t + 1);
		});
	}, []);

	useEffect(() => {
		mirror.attach(scheduleRender);
		const off = board.subscribe(scheduleRender);
		return () => {
			mirror.detach();
			off();
		};
	}, [board, mirror, scheduleRender]);

	useEffect(() => {
		if (ctx.speedText !== prefs.speed) ctx.setSpeed(speedEvent(prefs.speed));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [prefs.speed]);
	useEffect(() => {
		localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
		stage.current?.invalidate();
	}, [prefs]);

	useEffect(() => stage.current?.invalidate(), [traceState, applied, tab]);

	// ---------- traced playback ----------
	const seek = useCallback(
		(n: number) => {
			const st = traceState;
			if (!st) return;
			const before = st.applied;
			st.seek(n);
			const now = performance.now();
			if (st.applied > before) {
				for (let i = before; i < st.applied; i++) {
					const e = st.trace.events[i];
					if (e.action === 'pop') scene.current.traceTimes.set(e.node, st.applied - before > 200 ? 0 : now);
				}
			}
			setApplied(st.applied);
			if (st.done) {
				setPlaying(false);
				if (!st.trace.result.found && tab === 'sandbox' && st.applied > before) setNewToast(true);
			}
		},
		[traceState, tab],
	);

	useEffect(() => {
		if (!playing || !traceState) return;
		let timer = 0;
		let raf = 0;
		// Same batching as the classic player at Fast.
		const batch = ctx.speedText === 'fast' ? FAST_CELLS : 1;
		const step = () => {
			let to = traceState.applied;
			for (let k = 0; k < batch; k++) to = traceState.nextStepEnd(to);
			seek(to);
		};
		if (ctx.speed === 0) {
			const loop = () => {
				for (let k = 0; k < 25 && !traceState.done; k++) traceState.seek(traceState.nextStepEnd());
				seek(traceState.applied);
				if (!traceState.done) raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
		} else {
			const loop = () => {
				step();
				if (!traceState.done) timer = window.setTimeout(loop, ctx.speed);
			};
			timer = window.setTimeout(loop, ctx.speed);
		}
		return () => {
			clearTimeout(timer);
			cancelAnimationFrame(raf);
		};
	}, [playing, traceState, ctx.speed, ctx.speedText, seek]);

	useEffect(() => {
		if (!newToast) return;
		const t = setTimeout(() => setNewToast(false), 6000); // same as the classic toast
		return () => clearTimeout(t);
	}, [newToast]);

	const phone = useMedia(PHONE);
	const landscapePhone = useMedia(LANDSCAPE_PHONE);
	const portraitPhone = useMedia(PORTRAIT_PHONE);
	const small = phone || landscapePhone;

	// Phone: the panel is a bottom sheet; get it out of the way once a search starts.
	const closeSheetOnPhone = () => {
		if (typeof window.matchMedia === 'function' && (window.matchMedia(PHONE).matches || window.matchMedia(LANDSCAPE_PHONE).matches)) setPanelOpen(false);
	};

	const startTrace = async (which: TracedAlgo, autoplay: boolean) => {
		setLanding(false);
		closeSheetOnPhone();
		setBestPath(null);
		setClassicMs(null);
		ctx.clearBoard('visited');
		if (ctx.isPreviewing) ctx.hideBestPath();
		const snap = buildSnapshot(board, mirror, { findMode });
		if (unsupported(which, snap)) return;
		const trace: Trace = await searchAsync(which, snap);
		scene.current.traceTimes = new Map();
		const st = new TraceState(trace);
		setTraceState(st);
		setApplied(0);
		setPlaying(autoplay);
	};

	// A classic algorithm on a board wider than its 35x80 table: the same helper,
	// off the main thread on a shim, played back like a new algorithm.
	const startWide = async (which: ClassicAlgo, bounds: Bounds) => {
		setLanding(false);
		closeSheetOnPhone();
		setBestPath(null);
		setClassicMs(null);
		setWideToast(null);
		ctx.clearBoard('visited');
		if (ctx.isPreviewing) ctx.hideBestPath();
		const res = await wideAsync(wideJob(which, board, mirror, bounds));
		if (!res.ok) {
			clearTrace();
			setWideToast(res.reason);
			return;
		}
		scene.current.traceTimes = new Map();
		setTraceState(new TraceState(res.trace));
		setApplied(0);
		setPlaying(true);
	};

	const clearTrace = () => {
		setTraceState(null);
		setPlaying(false);
		setApplied(0);
	};

	// ---------- actions ----------
	const busy = ctx.running || (playing && tab === 'sandbox');
	const editable = !ctx.running && !playing;

	const pickAlgo = (a: AlgoId) => {
		setAlgo(a);
		setLanding(false);
		if (!isTraced(a)) ctx.selectAlgorithm({ target: { value: a } });
	};

	const go = () => {
		setLanding(false);
		closeSheetOnPhone();
		if (!algo) return setPickerOpen(true);
		if (isTraced(algo)) return void startTrace(algo, true);
		const f = classicFrame(board, mirror);
		if (f.kind === 'wide') return void startWide(algo, f.bounds);
		moveWindow(mirror, board, f.origin); // everything placed fits 35x80: cover it, then run on the table as always
		clearTrace();
		setBestPath(null);
		classicRun.current = true;
		classicStart.current = performance.now();
		setClassicMs(null);
		ctx.go();
	};
	const stepOnce = () => {
		if (!algo || !isTraced(algo)) return;
		if (!traceState || traceState.trace.algo !== algo) return void startTrace(algo, false);
		setPlaying(false);
		seek(traceState.nextStepEnd());
	};
	const reset = () => {
		clearTrace();
		setBestPath(null);
		setClassicMs(null);
		if (ctx.isPreviewing) ctx.hideBestPath(); // Show Best Path cells would otherwise keep 'preview'
		ctx.clearBoard('visited');
	};
	const clear = (what: 'board' | 'wall' | 'path') => {
		setBestPath(null);
		if (what === 'board') {
			ctx.clearBoard(null);
			board.clear();
			clearTrace();
		} else if (what === 'wall') {
			ctx.clearBoard('wall');
			board.clear((t) => t.kind === 'wall');
		} else reset();
	};
	const buildMaze = (useSeed?: number) => {
		setLanding(false);
		clearTrace();
		setBestPath(null);
		if (!maze.startsWith('gen:')) return mirror.free ? undefined : ctx.buildMaze(maze);
		// New generators: Generate rolls a new seed; Enter in the seed field replays one.
		const s = useSeed ?? newSeed();
		setSeed(s);
		if (ctx.isPreviewing) ctx.hideBestPath();
		ctx.clearBoard('visited');
		// fills the cells in view (the classic mazes fill the 35x80 classic window)
		const region = stage.current?.viewCells() ?? mirror.window;
		applyGenerator(maze.slice(4) as GenId, s, board, mirror, region.r1 >= region.r0 + 4 && region.c1 >= region.c0 + 4 ? region : mirror.window);
	};

	// ---------- keyboard ----------
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
			const k = e.key.toLowerCase();
			if (k === '[') setPanelOpen((o) => !o);
			else if (k === 'h') stage.current?.home();
			else if (k === 'f') stage.current?.fit();
			else if (k === '+' || k === '=') stage.current?.zoomStep(1);
			else if (k === '-') stage.current?.zoomStep(-1);
			else if (tab === 'learn' && traceState && k === '.') seek(traceState.endOf(traceState.position + (e.shiftKey ? 10 : 1)));
			else if (tab === 'learn' && traceState && k === ',') seek(traceState.endOf(traceState.position - (e.shiftKey ? 10 : 1)));
			else {
				const t = TOOLS.find((x) => x.key === k);
				if (t) setTool(t.id);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [tab, traceState, seek]);

	// ---------- derived ----------
	const weights = [...board.entries()].filter(([, , t]) => t.kind === 'weight');
	const tiles = [...board.entries()];
	const oneways = tiles.filter(([, , t]) => t.kind === 'oneway').length;
	const pads = tiles.filter(([, , t]) => t.kind === 'pad').length;
	const extraDucks = tiles.filter(([, , t]) => t.kind === 'duck').length;
	const lone = lonePads(board);
	const snapNow = buildSnapshot(board, mirror, { findMode });
	const blocked = (a: TracedAlgo) => unsupported(a, snapNow);
	const classic = algo && !isTraced(algo) ? CLASSIC.find((c) => c.id === algo)! : null;
	// classic runs: on the table when everything fits 35x80, else wide (content + 16), or a stated limit
	const frame = classic ? classicFrame(board, mirror) : null;
	const wide = frame?.kind === 'wide' ? frame : null;
	const why = algo && isTraced(algo) ? blocked(algo) : classic && wide ? wideBlock(classic.id, wide.rows, wide.cols) : null;
	const showBestPathBtn = classic && classic.id !== 'dijkstra' && !wide;
	const classicMazeOff = !!mirror.free && !maze.startsWith('gen:');
	const tr = traceState;
	// Phone: frame Home in the gap between the quick bar / inspector and the transport / zoom row.
	const learnFloats = !!tr && tab === 'learn';
	const safe = small ? 12 : 0; // landscape notch side; env(safe-area-inset-*) is applied in CSS, this keeps framing clear of it
	const insets = landscapePhone
		? { top: 64, right: 12 + safe, bottom: 64, left: 12 + safe }
		: phone
		? { top: learnFloats ? 76 + Math.round(0.34 * window.innerHeight) : 68, right: 12, bottom: learnFloats ? 136 : 68, left: 12 }
		: { top: 56, right: learnFloats ? (window.innerWidth <= 1023 ? 260 : 300) + 32 : 24, bottom: legendPinned ? legendH + 32 : 72, left: 24 };
	// Home (H) frames the Arrow and Duck 1 with 3 cells around them. Phones
	// never go below 75 % (cells stay tappable); the board around is endless.
	const homeBounds = (): Bounds => {
		const a = mirror.startCell(), d = mirror.endCell();
		if (!a || !d) return mirror.window;
		return { r0: Math.min(a.r, d.r) - 3, c0: Math.min(a.c, d.c) - 3, r1: Math.max(a.r, d.r) + 3, c1: Math.max(a.c, d.c) + 3 };
	};
	const homeMinZoom = small ? PHONE_MIN_ZOOM : 0.5;
	const fitBounds = (): Bounds => contentBox(board, mirror) ?? mirror.window;
	// First load on a small screen: if the classic Arrow-Duck gap (49 columns)
	// can't fit at a tappable zoom, bring Duck 1 closer, once, with the table's
	// own drag (the classic six are unchanged; only the starting spot moves).
	const phoneFramed = useRef(false);
	useEffect(() => {
		// wait until the table has taken the saved speed: its handlers copy the whole
		// state ({...this.state}), so a drag before that commits rolled the speed back
		if (phoneFramed.current || mirror.start < 0 || mirror.end < 0 || ctx.speedText !== prefs.speed) return;
		phoneFramed.current = true;
		const gap = closerDuckGap(window.innerWidth);
		if (gap === null || ctx.starting !== '17-15' || ctx.ending !== '17-64') return void stage.current?.home();
		setTimeout(() => {
			dragTableCell('17-64', `17-${15 + gap}`);
			requestAnimationFrame(() => stage.current?.home()); // after the mirror has read the move
		}, 0);
	});
	const onEndpointDrop = (which: 'start' | 'end', cell: { r: number; c: number }) => {
		const cur = which === 'start' ? mirror.startCell() : mirror.endCell();
		if (cur && cur.r === cell.r && cur.c === cell.c) return; // a click, not a move
		reset();
		placeEndpoint(mirror, board, which, cell);
		scheduleRender();
	};
	const legendRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!legendPinned || !legendRef.current) return;
		const el = legendRef.current;
		const measure = () => setLegendH(el.getBoundingClientRect().height);
		measure();
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
		ro?.observe(el);
		return () => ro?.disconnect();
	}, [legendPinned]);

	// What the collapsed bar names: the algorithm the visible tab would run.
	const activeAlgo: AlgoId | null = tab === 'learn' ? learnAlgo : algo;
	const tracePaused = tab === 'sandbox' && !!tr && !tr.done && !playing && applied > 0 && tr.trace.algo === algo;
	const goButton = (compact = false) => {
		if (ctx.running && !ctx.mazeRunning)
			return (
				<button className="go" onClick={() => ctx.pause()} data-testid="go">
					{ctx.isPaused ? 'Resume' : 'Pause'}
				</button>
			);
		if (playing && tab === 'sandbox')
			return (
				<button className="go" onClick={() => setPlaying(false)} data-testid="go">
					Pause
				</button>
			);
		if (tracePaused)
			return (
				<button className="go" onClick={() => setPlaying(true)} data-testid="go">
					Resume
				</button>
			);
		return (
			<button className="go" onClick={go} data-testid="go" disabled={ctx.running || !!why} title={why ?? (algo ? undefined : 'Pick an algorithm first')}>
				{!compact && <Icon.foot />} Go!
			</button>
		);
	};

	const legend = (
		<div className="legend">
			<span><Swatch kind="start" palette={palette} />Arrow</span>
			<span><Swatch kind="duck" palette={palette} />Duck</span>
			<span><Swatch kind="path" palette={palette} />Path</span>
			<span><Swatch kind="wall" palette={palette} />Wall</span>
			<span><Swatch kind="visited" palette={palette} />Visited</span>
			<span><Swatch kind="unvisited" palette={palette} />Unvisited</span>
			{tr && <span><Swatch kind="frontier" palette={palette} />Frontier</span>}
			{([2, 5, 10] as Weight[]).filter((w) => weights.some(([, , t]) => t.kind === 'weight' && t.cost === w)).map((w) => (
				<span key={w}><Swatch kind={`weight${w}` as SwatchKind} palette={palette} />Weight {WEIGHT_NAMES[w]}</span>
			))}
			{oneways > 0 && <span><Swatch kind="oneway" palette={palette} />One-way</span>}
			{pads > 0 && <span><Swatch kind="pad" palette={palette} />Teleport</span>}
			<span className="legend__goal">Hunt the Quack!!</span>
		</div>
	);

	return (
		<div className="app" data-chrome={prefs.chrome} data-cells={prefs.cells} data-pk-theme={prefs.chrome === 'dark' ? 'night-paper' : 'paper'} data-pk-flat={prefs.cells === 'classic' ? '' : undefined} data-panel={panelOpen ? 'open' : 'closed'}>
			<RotatePrompt portraitPhone={portraitPhone} />
			{/* Phase A legacy mirror: the classic table, hidden but live. */}
			<div className="legacy-mirror" aria-hidden="true">
				<Main rows={HOME_ROWS} cols={HOME_COLS} />
			</div>

			{panelOpen && <button className="sheet-scrim" aria-label="Close panel" tabIndex={-1} onClick={() => setPanelOpen(false)} />}
			<div className="panel-lift pk-lifted" data-open={panelOpen}>
			<nav className="panel pk-panel pk-torn-right" data-open={panelOpen} aria-label="Controls" aria-hidden={!panelOpen} inert={!panelOpen}>
				<div className="panel__head pk-strip pk-torn-bottom">
					<div className="brand pk-display-m">
						<Swatch kind="duck" palette={palette} size={34} className="brand__duck" /> Quack Hunt
					</div>
					<button className="icon-btn" aria-label="Collapse panel" title="Collapse panel ([)" onClick={() => setPanelOpen(false)}>
						<Icon.collapse />
					</button>
				</div>
				<div className="panel__scroll">
					<div className="tabs pk-tabs" role="tablist">
						<button className="pk-btn" role="tab" aria-selected={tab === 'sandbox'} onClick={() => setTab('sandbox')}>Sandbox</button>
						<button className="pk-btn" role="tab" aria-selected={tab === 'learn'} data-testid="tab-learn" onClick={() => setTab('learn')}>Learn</button>
					</div>

					{tab === 'sandbox' ? (
						<section className="section">
							<h2 className="section__title">Find the duck</h2>
							<AlgoPicker value={algo} open={pickerOpen} disabled={busy} onOpen={setPickerOpen} onPick={pickAlgo} blocked={blocked} />
							{ctx.mazeRunning && (
								<p className="chip" role="status" data-testid="maze-status" style={{ marginTop: 8 }}>
									Generating maze… the picker and drawing unlock when it's done.
								</p>
							)}
							{extraDucks > 0 && (
								<div className="seg" role="group" aria-label="Find" style={{ marginTop: 8 }}>
									{(
										[
											['nearest', 'Nearest', 'Stop at the first duck reached'],
											['all', 'All', 'A shortest path to every duck'],
											['tour', 'Tour', 'Visit the ducks in number order'],
										] as [FindMode, string, string][]
									).map(([m, label, title]) => (
										<button key={m} aria-pressed={findMode === m} title={title} data-testid={`find-${m}`} disabled={busy} onClick={() => setFindMode(m)}>
											{label}
										</button>
									))}
								</div>
							)}
							<div className="run-row">
								{goButton()}
								<button className="square" aria-label="Step" title="Step (new algorithms)" data-testid="step" disabled={!isTraced(algo) || ctx.running || !!why} onClick={stepOnce}>
									<Icon.step />
								</button>
								<button className="square" aria-label="Reset" title="Reset (clear path)" disabled={busy} onClick={reset}>
									<Icon.reset />
								</button>
							</div>
							{/* Mochi fix 3: the button and the chips keep their space whatever the
							    algorithm, so Speed / Draw / Theme don't jump when one is picked. */}
							<button
								className="btn btn--wide"
								data-testid="best-path"
								style={showBestPathBtn ? undefined : { visibility: 'hidden' }}
								aria-hidden={!showBestPathBtn || undefined}
								tabIndex={showBestPathBtn ? undefined : -1}
								disabled={ctx.running || !showBestPathBtn}
								onClick={ctx.isPreviewing ? ctx.hideBestPath : ctx.showBestPath}>
								{ctx.isPreviewing ? 'Hide Best Path' : 'Show Best Path'}
							</button>
							<div className="chips chips--reserve" data-testid="find-chips">
								{algo && <span className="chip chip--mono" data-testid="order-chip">order {classic ? `classic: ${classic.order}` : 'N · E · S · W'}</span>}
								{classic && weights.length > 0 && <span className="chip">{classic.label} ignores weights ({weights.length} cells)</span>}
								{classic && wide && !why && (
									<span className="chip" data-testid="classic-wide">
										Runs on the {wide.rows} × {wide.cols} cells around everything you placed
									</span>
								)}
								{algo && isTraced(algo) && <span className="chip">Searches everything you placed, plus 16 cells around it</span>}
								{why && <span className="chip chip--warn" role="status" data-testid="algo-blocked">{why}</span>}
								{classic && (oneways > 0 || pads > 0 || extraDucks > 0) && <span className="chip" data-testid="classic-ignores">Classic algorithms ignore one-way lanes, teleporters and extra ducks</span>}
								{extraDucks > 0 && isTraced(algo) && findMode === 'tour' && (
									<span className="chip" data-testid="tour-order">Tour: Arrow → {Array.from({ length: extraDucks + 1 }, (_, i) => i + 1).join(' → ')}</span>
								)}
								{lone.length > 0 && <span className="chip" data-testid="lone-pad">Pad {lone.map(PAD_LETTER).join(', ')} has no partner yet, so searches ignore it</span>}
							</div>
						</section>
					) : (
						<section className="section">
							<h2 className="section__title">Step through</h2>
							<p className="learn-intro">Pick a search, then step through it one action at a time. The inspector explains each step and shows the heap.</p>
							<div className="seg" role="group" aria-label="Algorithm">
								{(['dijkstraW', 'astar'] as TracedAlgo[]).map((a) => (
									<button key={a} aria-pressed={learnAlgo === a} onClick={() => setLearnAlgo(a)}>
										{algoLabel(a)}
									</button>
								))}
							</div>
							<div className="run-row">
								<button className="go" data-testid="learn-start" disabled={ctx.running} onClick={() => startTrace(learnAlgo, false)}>
									Start step-through
								</button>
							</div>
							<div className="chips">
								<span className="chip chip--mono">order N · E · S · W</span>
								<span className="chip">keys <kbd>.</kbd> step <kbd>,</kbd> back</span>
							</div>
						</section>
					)}

					<section className="section">
						<h2 className="section__title">Speed</h2>
						<div className="seg" role="group" aria-label="Speed">
							{SPEEDS.map((s) => (
								<button key={s.name} aria-pressed={ctx.speedText === s.name} title={s.title} onClick={() => setPrefs({ ...prefs, speed: s.name })}>
									{s.label}
								</button>
							))}
						</div>
					</section>

					<section className="section">
						<h2 className="section__title">Draw</h2>
						<div className="tools" role="group" aria-label="Draw tools">
							{TOOLS.map((t) => (
								<button key={t.id} className="tool" aria-pressed={tool === t.id} title={`${t.label} (${t.key.toUpperCase()})`} onClick={() => setTool(t.id)}>
									<t.icon />
									{t.label}
								</button>
							))}
						</div>
						{tool === 'weight' && (
							<div className="seg" role="group" aria-label="Weight" style={{ marginTop: 8 }}>
								{([2, 5, 10] as Weight[]).map((w) => (
									<button key={w} aria-pressed={weight === w} onClick={() => setWeight(w)}>
										{WEIGHT_NAMES[w]}
									</button>
								))}
							</div>
						)}
						{tool === 'oneway' && (
							<div className="seg" role="group" aria-label="Lane direction" style={{ marginTop: 8 }}>
								{(['↑ N', '→ E', '↓ S', '← W'] as const).map((l, i) => (
									<button key={l} aria-pressed={dir === i} onClick={() => setDir(i as Dir)}>
										{l}
									</button>
								))}
							</div>
						)}
						<div className="hint">
							<b>{TOOLS.find((t) => t.id === tool)!.label}</b> · {TOOLS.find((t) => t.id === tool)!.hint}
							<br />
							Space-drag pans · scroll zooms · <kbd>{tool[0].toUpperCase()}</kbd>
						</div>
					</section>

					<section className="section">
						<h2 className="section__title">Board</h2>
						<div className="row">
							<select className="select grow" aria-label="Maze" value={maze} disabled={busy} onChange={(e) => setMaze(e.target.value)}>
								<optgroup label="Fill the view">
									{GENERATORS.map((g) => (
										<option key={g.id} value={`gen:${g.id}`} title={g.blurb}>
											{g.label}
										</option>
									))}
								</optgroup>
								<optgroup label="Classic mazes (around the Arrow and Duck)">
									{MAZES.map((m) => (
										<option key={m.value} value={m.value}>
											Maze: {m.text}
										</option>
									))}
								</optgroup>
							</select>
							<button
								className="btn"
								disabled={busy || classicMazeOff}
								title={classicMazeOff ? 'Classic mazes fill the 35 × 80 cells around the Arrow and Duck 1, which are further apart now. Pick a Fill-the-view maze.' : undefined}
								aria-busy={ctx.mazeRunning || undefined}
								onClick={() => buildMaze()}
								data-testid="generate">
								{ctx.mazeRunning ? 'Generating maze…' : 'Generate'}
							</button>
						</div>
						{classicMazeOff && (
							<div className="chips" style={{ marginTop: 8 }}>
								<span className="chip" data-testid="classic-maze-off">Classic mazes fill the 35 × 80 cells around the Arrow and Duck 1, which are further apart now. Pick a Fill-the-view maze.</span>
							</div>
						)}
						{maze.startsWith('gen:') && (
							<div className="row" style={{ marginTop: 8 }}>
								<label className="label" htmlFor="gen-seed">Seed</label>
								<input
									id="gen-seed"
									className="select grow"
									data-testid="gen-seed"
									inputMode="numeric"
									value={seed}
									disabled={busy}
									title="Generate rolls a new seed. Type one and press Enter to rebuild that board."
									onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)}
									onKeyDown={(e) => e.key === 'Enter' && buildMaze(seed)}
								/>
							</div>
						)}
						<div className="row" style={{ marginTop: 8 }}>
							<span className="label">Clear</span>
							<button className="btn" disabled={busy} onClick={() => clear('board')}>Board</button>
							<button className="btn" disabled={busy} onClick={() => clear('wall')}>Wall</button>
							<button className="btn" disabled={busy} onClick={() => clear('path')}>Path</button>
						</div>
					</section>

					<section className="section">
						<h2 className="section__title">Stats</h2>
						<div className="stats" data-testid="stats">
							<div className="stat pk-well"><b className="pk-number">{tr ? tr.visited.size : mirror.visitedCount}</b><span>Visited</span></div>
							<div className="stat pk-well"><b className="pk-number">{tr && tr.path.length ? tr.path.length : !tr && bestPath ? bestPath.length : '–'}</b><span>Path</span></div>
							<div className="stat pk-well"><b className="pk-number">{tr && tr.done && tr.trace.result.found ? tr.trace.result.pathCost : !tr && bestPath ? bestPath.length - 1 : '–'}</b><span>Cost</span></div>
							<div className="stat pk-well" title={tr ? 'Engine time' : 'Run time, Go to last cell'}><b className="pk-number">{tr ? `${Math.round(tr.trace.result.engineMs)}` : classicMs !== null ? `${Math.round(classicMs)}` : '–'}</b><span>ms</span></div>
						</div>
					</section>

					<section className="section">
						<h2 className="section__title">
							Legend
							<button className="icon-btn" aria-pressed={legendPinned} aria-label="Pin legend to canvas" title="Pin to canvas" onClick={() => setLegendPinned((p) => !p)}>
								<Icon.pin />
							</button>
						</h2>
						{legend}
					</section>

					<section className="section">
						<h2 className="section__title">Theme</h2>
						<div className="seg" role="group" aria-label="Chrome">
							{(['light', 'dark'] as Chrome[]).map((c) => (
								<button key={c} aria-pressed={prefs.chrome === c} onClick={() => setPrefs({ ...prefs, chrome: c })}>
									{c === 'light' ? 'Light' : 'Dark'}
								</button>
							))}
						</div>
						<div className="seg" role="group" aria-label="Cells" style={{ marginTop: 6 }}>
							{(['paper', 'classic'] as CellSet[]).map((c) => (
								<button key={c} aria-pressed={prefs.cells === c} data-testid={`cells-${c}`} onClick={() => setPrefs({ ...prefs, cells: c })}>
									{c === 'paper' ? 'Paper' : 'Classic'}
								</button>
							))}
						</div>
					</section>
				</div>
				<footer className="panel__foot">
					<span>Joseph Cake</span>
					<span aria-hidden="true">·</span>
					<a href="https://www.linkedin.com/in/jocake" target="_blank" rel="noreferrer">LinkedIn</a>
					<span aria-hidden="true">·</span>
					<a href="https://www.github.com/josephcake" target="_blank" rel="noreferrer">GitHub</a>
				</footer>
			</nav>
			</div>

			<main className="stage">
				<CanvasStage
					ref={stage}
					scene={scene}
					tool={tool}
					weight={weight}
					editable={editable}
					insets={insets}
					onInteract={() => {
						setLanding(false);
						setBestPath(null);
					}}
					onLocked={() => setLockedToast(true)}
					onZoom={setZoom}
					homeBounds={homeBounds}
					homeMinZoom={homeMinZoom}
					fitBounds={fitBounds}
					onEndpointDrop={onEndpointDrop}
					dir={dir}
				/>

				{!panelOpen && (
					<div className="float mini" role="toolbar" aria-label="Quick controls">
						<button className="icon-btn" aria-label="Open panel" title="Open panel ([)" onClick={() => setPanelOpen(true)}>
							<Icon.menu />
						</button>
						<span className="mini__algo" data-testid="mini-algo">{algoLabel(activeAlgo)}</span>
						{tab === 'learn' ? (
							<button className="go" data-testid="mini-learn-start" disabled={ctx.running} onClick={() => startTrace(learnAlgo, false)}>
								Start
							</button>
						) : (
							goButton(true)
						)}
						{TOOLS.filter((t) => !small || ['wall', 'erase', 'pan'].includes(t.id) || t.id === tool).map((t) => (
							<button key={t.id} className="icon-btn" aria-pressed={tool === t.id} aria-label={t.label} title={t.label} onClick={() => setTool(t.id)} style={tool === t.id ? { background: 'var(--raised)' } : undefined}>
								<t.icon />
							</button>
						))}
					</div>
				)}

				{landing && (
					<div className="float landing" data-testid="landing">
						<Swatch kind="duck" palette={palette} size={48} className="landing__duck" />
						<h1>Hunt the quack.</h1>
						<p>Draw walls, pick a search, and watch it find the duck. The board never ends: pan with the hand or two fingers, and draw anywhere.</p>
						<div className="row">
							<button className="go" onClick={() => { setPanelOpen(true); setTab('sandbox'); setPickerOpen(true); setLanding(false); }}>
								Pick an algorithm
							</button>
							<button className="btn" onClick={() => buildMaze()}>
								Try a maze
							</button>
							<span className="landing__dismiss">Goes away on first click</span>
						</div>
					</div>
				)}

				{tr && tab === 'sandbox' && (
					<div className="float pill" aria-live="polite">
						<span>{algoLabel(tr.trace.algo)}</span>
						<span>visited {tr.visited.size}</span>
						{tr.done && tr.trace.result.found && <span>cost {tr.trace.result.pathCost}</span>}
					</div>
				)}

				{tr && tab === 'learn' && (
					<>
						<Inspector state={tr} />
						<StepBar state={tr} playing={playing} onSeek={(p) => { setPlaying(false); seek(tr.endOf(p)); }} onPlay={() => setPlaying((p) => !p)} />
					</>
				)}

				{legendPinned && (
					<div className="float legend-pin" ref={legendRef} data-testid="legend-pin">
						{legend}
					</div>
				)}

				<div className="float zoom" role="toolbar" aria-label="Zoom">
					<span className="pk-tape zoom__tape" aria-hidden="true" />
					<button className="icon-btn" aria-label="Zoom out" onClick={() => stage.current?.zoomStep(-1)}><Icon.minus /></button>
					<button className="zoom__pct" aria-label="Zoom to 100%" onClick={() => stage.current?.zoomTo(1)}>{Math.round(zoom * 100)}%</button>
					<button className="icon-btn" aria-label="Zoom in" onClick={() => stage.current?.zoomStep(1)}><Icon.plus /></button>
					<button className="icon-btn" aria-label="Fit" title="Fit (F)" onClick={() => stage.current?.fit()}><Icon.fit /></button>
					<button className="icon-btn" aria-label="Home" title="Home (H)" onClick={() => stage.current?.home()}><Icon.home /></button>
				</div>

				{wideToast && (
					<button className="float toast" role="status" data-testid="wide-toast" onClick={() => setWideToast(null)}>
						{wideToast}
					</button>
				)}
				{lockedToast && !ctx.isToastVisible && !newToast && !wideToast && (
					<button className="float toast" role="status" data-testid="locked-toast" onClick={() => setLockedToast(false)}>
						Drawing is locked while the search runs. Wait, or press Reset.
					</button>
				)}
				{(ctx.isToastVisible || newToast) && (
					<button className="float toast" role="status" onClick={() => (ctx.isToastVisible ? ctx.resetToast('click') : setNewToast(false))}>
						Cannot find Duck!
					</button>
				)}
			</main>
		</div>
	);
}
