// Learn mode MVP: step bar + inspector (narration, heap, order).
import { narrate } from '../engine/narrate';
import { TraceState } from '../learn/player';
import { parseId } from '../model/cell';
import { Icon } from './icons';
import { algoLabel } from './AlgoPicker';

const at = (id: string) => {
	const { r, c } = parseId(id);
	return `${r},${c}`;
};

type StepProps = {
	state: TraceState;
	playing: boolean;
	onSeek: (position: number) => void;
	onPlay: () => void;
};

export function StepBar({ state, playing, onSeek, onPlay }: StepProps) {
	const total = state.totalSteps;
	const p = state.position;
	return (
		<div className="float stepbar" role="toolbar" aria-label="Step through">
			<button className="icon-btn" aria-label="Start" title="Start" onClick={() => onSeek(0)}>
				<Icon.first />
			</button>
			<button className="icon-btn" aria-label="Step back" title="Step back (,)" data-testid="step-back" onClick={() => onSeek(p - 1)}>
				<Icon.back />
			</button>
			<button className="icon-btn" aria-label={playing ? 'Pause' : 'Play'} data-testid="step-play" onClick={onPlay}>
				{playing ? <Icon.pause /> : <Icon.play />}
			</button>
			<button className="icon-btn" aria-label="Step forward" title="Step (.)" data-testid="step-forward" onClick={() => onSeek(p + 1)}>
				<Icon.step />
			</button>
			<button className="icon-btn" aria-label="End" title="End" onClick={() => onSeek(total)}>
				<Icon.last />
			</button>
			<input type="range" min={0} max={total} value={p} aria-label="Scrub steps" onChange={(e) => onSeek(Number(e.target.value))} />
			<span className="stepbar__count" data-testid="step-count">
				{p} / {total}
			</span>
		</div>
	);
}

export function Inspector({ state, hasLanes = false }: { state: TraceState; hasLanes?: boolean }) {
	const evs = state.stepEvents;
	const algo = state.trace.algo;
	const astar = algo === 'astar';
	const rows = state.frontierSorted(8);
	return (
		<aside className="float inspector" aria-label="Inspector">
			<h3 data-testid="inspector-step">
				{algoLabel(algo)} · step {state.position} / {state.totalSteps}
			</h3>
			<div className="narration" aria-live="polite" data-testid="narration">
				{evs.length ? (
					<>
						<p>{narrate(evs[0], algo)}</p>
						{evs.length > 1 && (
							<ul>
								{evs.slice(1, 5).map((x) => (
									<li key={x.i}>{narrate(x, algo)}</li>
								))}
								{evs.length > 5 && <li>…and {evs.length - 5} more.</li>}
							</ul>
						)}
					</>
				) : (
					<p>Press Step to begin. One step = one cell taken off the frontier, with everything it discovers.</p>
				)}
			</div>
			{state.trace.result.checkpoints && (
				<p className="inspector__hint" data-testid="checkpoint-hint">
					Checkpoints first. The order is the one with the shortest total route ({state.trace.result.checkpoints.method === 'exact' ? 'every order tried' : 'nearest next, as there are more than 8'}), then one search per leg. The frontier starts fresh each leg.
				</p>
			)}
			{hasLanes && <p className="inspector__hint">One-way lanes can only be entered and left along their arrows. Watch the wave: it flows with the chevrons, never against them.</p>}
			<div className="chips">
				<span className="chip chip--mono" title="Neighbour order for new algorithms">order N · E · S · W</span>
				<span className="chip chip--mono">ties: {astar ? 'f, then h, then oldest' : 'g, then oldest'}</span>
			</div>
			<h3>Heap · next to pop first ({state.frontier.size})</h3>
			<table className="heap">
				<thead>
					<tr>
						<th>cell</th>
						<th>g</th>
						{astar && <th>h</th>}
						{astar && <th>f</th>}
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.node}>
							<td>{at(r.node)}</td>
							<td>{r.g}</td>
							{astar && <td>{r.h}</td>}
							{astar && <td>{r.f}</td>}
						</tr>
					))}
					{rows.length === 0 && (
						<tr>
							<td colSpan={4}>empty</td>
						</tr>
					)}
				</tbody>
			</table>
			<h3>Visited</h3>
			<p style={{ margin: 0 }}>{state.visited.size} cells settled{state.path.length ? ` · path ${state.path.length} cells, cost ${state.trace.result.pathCost}` : ''}</p>
		</aside>
	);
}
