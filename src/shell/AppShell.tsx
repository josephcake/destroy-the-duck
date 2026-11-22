// The new app shell (Prism "Open Pond"). Phase A: the classic TableContext and
// its 35x80 table stay mounted (hidden) and keep running the classic six
// unchanged; this shell drives them and paints everything on the canvas.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// @ts-expect-error legacy JS module
import Main from '../Main/Main';
import duckImage from '../Images/duck.png';
import { Board, Weight } from '../model/board';
import { HOME_COLS, HOME_ROWS, inHome } from '../model/cell';
import { LegacyMirror } from '../canvas/mirror';
import { CanvasStage, SceneInput, StageApi, Tool } from '../canvas/CanvasStage';
import { CellSet, Chrome, PALETTES, weightColor } from '../canvas/palette';
import { searchAsync } from '../engine/runner';
import { Trace, TracedAlgo } from '../engine/trace';
import { TraceState } from '../learn/player';
import { buildSnapshot, BUDGET } from './snapshot';
import { CLASSIC, MAZES, SPEEDS, speedEvent, useLegacy } from './legacy';
import { AlgoId, AlgoPicker, algoLabel, isTraced } from './AlgoPicker';
import { Inspector, StepBar } from './Learn';
import { Icon } from './icons';
import './shell.css';

type Prefs = { chrome: Chrome; cells: CellSet };
const PREFS_KEY = 'dtd.ui.v1';
const loadPrefs = (): Prefs => {
	try {
		const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
		return { chrome: p.chrome === 'dark' ? 'dark' : 'light', cells: p.cells === 'classic' ? 'classic' : 'pond' };
	} catch {
		return { chrome: 'light', cells: 'pond' }; // decision 7: Pond is the default
	}
};

const TOOLS: { id: Tool; label: string; key: string; icon: () => React.ReactElement; hint: string }[] = [
	{ id: 'wall', label: 'Wall', key: 'w', icon: Icon.wall, hint: 'drag to paint, drag the Arrow or Duck to move them.' },
	{ id: 'weight', label: 'Weight', key: 'g', icon: Icon.weight, hint: 'drag to paint a cost. Classic algorithms ignore weights.' },
	{ id: 'erase', label: 'Erase', key: 'e', icon: Icon.erase, hint: 'drag to clear walls and weights.' },
	{ id: 'pan', label: 'Pan', key: 'p', icon: Icon.hand, hint: 'drag to move around the endless pond.' },
];
const WEIGHT_NAMES: Record<Weight, string> = { 2: '2', 5: '5 · mud', 10: '10 · water' };

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
	const [maze, setMaze] = useState('basic');
	const [landing, setLanding] = useState(true);
	const [legendPinned, setLegendPinned] = useState(false);
	const [legendH, setLegendH] = useState(0);
	const [zoom, setZoom] = useState(1);
	const [newToast, setNewToast] = useState(false);
	const [, setTick] = useState(0); // re-render on mirror / board changes
	const [playing, setPlaying] = useState(false);
	const [applied, setApplied] = useState(0);
	const [traceState, setTraceState] = useState<TraceState | null>(null);

	const stage = useRef<StageApi>(null);
	const board = useMemo(() => new Board(), []);
	const mirror = useMemo(() => new LegacyMirror(), []);
	const palette = PALETTES[`${prefs.cells}-${prefs.chrome}`];
	const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const scene = useRef<SceneInput>({ board, mirror, palette, trace: null, traceTimes: new Map(), learnCurrent: false, reducedMotion });
	scene.current.palette = palette;
	scene.current.trace = traceState;
	scene.current.learnCurrent = tab === 'learn';

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
		const step = () => seek(traceState.nextStepEnd());
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
	}, [playing, traceState, ctx.speed, seek]);

	useEffect(() => {
		if (!newToast) return;
		const t = setTimeout(() => setNewToast(false), 6000); // same as the classic toast
		return () => clearTimeout(t);
	}, [newToast]);

	const startTrace = async (which: TracedAlgo, autoplay: boolean) => {
		ctx.clearBoard('visited');
		if (ctx.isPreviewing) ctx.hideBestPath();
		const trace: Trace = await searchAsync(which, buildSnapshot(board, mirror));
		scene.current.traceTimes = new Map();
		const st = new TraceState(trace);
		setTraceState(st);
		setApplied(0);
		setPlaying(autoplay);
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
		if (!algo) return setPickerOpen(true);
		if (isTraced(algo)) return void startTrace(algo, true);
		clearTrace();
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
		ctx.clearBoard('visited');
	};
	const clear = (what: 'board' | 'wall' | 'path') => {
		if (what === 'board') {
			ctx.clearBoard(null);
			board.clear();
			clearTrace();
		} else if (what === 'wall') {
			ctx.clearBoard('wall');
			board.clear((t) => t.kind === 'wall');
		} else reset();
	};
	const buildMaze = () => {
		setLanding(false);
		clearTrace();
		ctx.buildMaze(maze);
	};

	// ---------- keyboard ----------
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return;
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
	const outside = [...board.entries()].some(([r, c]) => !inHome(r, c));
	const classic = algo && !isTraced(algo) ? CLASSIC.find((c) => c.id === algo)! : null;
	const showBestPathBtn = classic && classic.id !== 'dijkstra';
	const tr = traceState;
	const insets = { top: 56, right: 24, bottom: legendPinned ? legendH + 32 : 72, left: 24 };
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
			<button className="go" onClick={go} data-testid="go" disabled={ctx.running} title={algo ? undefined : 'Pick an algorithm first'}>
				{!compact && <Icon.foot />} Go!
			</button>
		);
	};

	const legend = (
		<div className="legend">
			<span><i style={{ background: palette.start }} />Arrow</span>
			<span><i style={{ background: palette.duck }} />Duck</span>
			<span><i style={{ background: palette.path }} />Path</span>
			<span><i style={{ background: palette.wall }} />Wall</span>
			<span><i style={{ background: palette.visited }} />Visited</span>
			<span><i style={{ background: palette.home, borderColor: palette.homeLine }} />Unvisited</span>
			{tr && <span><i style={{ background: 'transparent', border: `2px solid ${palette.front}` }} />Frontier</span>}
			{([2, 5, 10] as Weight[]).filter((w) => weights.some(([, , t]) => t.kind === 'weight' && t.cost === w)).map((w) => (
				<span key={w}><i style={{ background: weightColor(palette, w) }} />Weight {WEIGHT_NAMES[w]}</span>
			))}
			<span className="legend__goal">Hunt the Quack!!</span>
		</div>
	);

	return (
		<div className="app" data-chrome={prefs.chrome} data-cells={prefs.cells}>
			{/* Phase A legacy mirror: the classic table, hidden but live. */}
			<div className="legacy-mirror" aria-hidden="true">
				<Main rows={HOME_ROWS} cols={HOME_COLS} />
			</div>

			<nav className="panel" data-open={panelOpen} aria-label="Controls" aria-hidden={!panelOpen}>
				<div className="panel__head">
					<div className="brand">
						<img src={duckImage} alt="" /> Destroy the Duck
					</div>
					<button className="icon-btn" aria-label="Collapse panel" title="Collapse panel ([)" onClick={() => setPanelOpen(false)}>
						<Icon.collapse />
					</button>
				</div>
				<div className="panel__scroll">
					<div className="tabs" role="tablist">
						<button role="tab" aria-selected={tab === 'sandbox'} onClick={() => setTab('sandbox')}>Sandbox</button>
						<button role="tab" aria-selected={tab === 'learn'} data-testid="tab-learn" onClick={() => setTab('learn')}>Learn</button>
					</div>

					{tab === 'sandbox' ? (
						<section className="section">
							<h2 className="section__title">Find the duck</h2>
							<AlgoPicker value={algo} open={pickerOpen} disabled={busy} onOpen={setPickerOpen} onPick={pickAlgo} />
							<div className="run-row">
								{goButton()}
								<button className="square" aria-label="Step" title="Step (new algorithms)" data-testid="step" disabled={!isTraced(algo) || ctx.running} onClick={stepOnce}>
									<Icon.step />
								</button>
								<button className="square" aria-label="Reset" title="Reset (clear path)" disabled={busy} onClick={reset}>
									<Icon.reset />
								</button>
							</div>
							{showBestPathBtn && (
								<button className="btn btn--wide" disabled={ctx.running} onClick={ctx.isPreviewing ? ctx.hideBestPath : ctx.showBestPath}>
									{ctx.isPreviewing ? 'Hide Best Path' : 'Show Best Path'}
								</button>
							)}
							<div className="chips">
								{algo && <span className="chip chip--mono" data-testid="order-chip">order {classic ? `classic: ${classic.order}` : 'N · E · S · W'}</span>}
								{classic && weights.length > 0 && <span className="chip">{classic.label} ignores weights ({weights.length} cells)</span>}
								{classic && outside && <span className="chip">Classic algorithms search Home only</span>}
								{algo && isTraced(algo) && <span className="chip">Searches the whole pond (budget {BUDGET / 1000}k)</span>}
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
								<button key={s.name} aria-pressed={ctx.speedText === s.name} title={s.title} onClick={() => ctx.setSpeed(speedEvent(s.name))}>
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
								{MAZES.map((m) => (
									<option key={m.value} value={m.value}>
										Maze: {m.text}
									</option>
								))}
							</select>
							<button className="btn" disabled={busy} onClick={buildMaze} data-testid="generate">
								Generate
							</button>
						</div>
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
							<div className="stat"><b>{tr ? tr.visited.size : mirror.visitedCount}</b><span>Visited</span></div>
							<div className="stat"><b>{tr && tr.path.length ? tr.path.length : '–'}</b><span>Path</span></div>
							<div className="stat"><b>{tr && tr.done && tr.trace.result.found ? tr.trace.result.pathCost : '–'}</b><span>Cost</span></div>
							<div className="stat"><b>{tr ? `${Math.round(tr.trace.result.engineMs)}` : '–'}</b><span>ms</span></div>
						</div>
					</section>

					<section className="section">
						<h2 className="section__title">
							Legend
							<button className="icon-btn" style={{ width: 28, height: 28 }} aria-pressed={legendPinned} aria-label="Pin legend to canvas" title="Pin to canvas" onClick={() => setLegendPinned((p) => !p)}>
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
							{(['pond', 'classic'] as CellSet[]).map((c) => (
								<button key={c} aria-pressed={prefs.cells === c} data-testid={`cells-${c}`} onClick={() => setPrefs({ ...prefs, cells: c })}>
									{c === 'pond' ? 'Pond' : 'Classic'}
								</button>
							))}
						</div>
					</section>
				</div>
				<footer className="panel__foot">
					<span>Joseph Cake</span>
					<a href="https://www.linkedin.com/in/jocake" target="_blank" rel="noreferrer">LinkedIn</a>
					<a href="https://www.github.com/josephcake" target="_blank" rel="noreferrer">GitHub</a>
				</footer>
			</nav>

			<main className="stage">
				<CanvasStage
					ref={stage}
					scene={scene}
					tool={tool}
					weight={weight}
					editable={editable}
					insets={insets}
					onInteract={() => setLanding(false)}
					onZoom={setZoom}
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
						{TOOLS.map((t) => (
							<button key={t.id} className="icon-btn" aria-pressed={tool === t.id} aria-label={t.label} title={t.label} onClick={() => setTool(t.id)} style={tool === t.id ? { background: 'var(--raised)' } : undefined}>
								<t.icon />
							</button>
						))}
					</div>
				)}

				{landing && (
					<div className="float landing" data-testid="landing">
						<img src={duckImage} alt="" />
						<h1>Hunt the quack.</h1>
						<p>Draw walls, pick a search, and watch it find the duck. The pond is endless; the dashed box is the classic board.</p>
						<div className="row">
							<button className="go" onClick={() => { setPanelOpen(true); setTab('sandbox'); setPickerOpen(true); setLanding(false); }}>
								Pick an algorithm
							</button>
							<button className="btn" onClick={() => { setMaze('basic'); setLanding(false); ctx.buildMaze('basic'); }}>
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
					<button className="icon-btn" aria-label="Zoom out" onClick={() => stage.current?.zoomStep(-1)}><Icon.minus /></button>
					<button className="zoom__pct" aria-label="Reset zoom to 100%" onClick={() => stage.current?.zoomTo(1)}>{Math.round(zoom * 100)}%</button>
					<button className="icon-btn" aria-label="Zoom in" onClick={() => stage.current?.zoomStep(1)}><Icon.plus /></button>
					<button className="icon-btn" aria-label="Fit" title="Fit (F)" onClick={() => stage.current?.fit()}><Icon.fit /></button>
					<button className="icon-btn" aria-label="Home" title="Home (H)" onClick={() => stage.current?.home()}><Icon.home /></button>
				</div>

				{(ctx.isToastVisible || newToast) && (
					<button className="float toast" role="status" onClick={() => (ctx.isToastVisible ? ctx.resetToast('click') : setNewToast(false))}>
						Cannot find Duck!
					</button>
				)}
			</main>
		</div>
	);
}
