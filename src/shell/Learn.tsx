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
	applied: number;
	playing: boolean;
	onSeek: (n: number) => void;
	onPlay: () => void;
};

export function StepBar({ state, applied, playing, onSeek, onPlay }: StepProps) {
	const total = state.trace.events.length;
	return (
		<div className="float stepbar" role="toolbar" aria-label="Step through">
			<button className="icon-btn" aria-label="Start" title="Start (Home)" onClick={() => onSeek(0)}>
				<Icon.first />
			</button>
			<button className="icon-btn" aria-label="Step back" title="Step back (,)" data-testid="step-back" onClick={() => onSeek(applied - 1)}>
				<Icon.back />
			</button>
			<button className="icon-btn" aria-label={playing ? 'Pause' : 'Play'} data-testid="step-play" onClick={onPlay}>
				{playing ? <Icon.pause /> : <Icon.play />}
			</button>
			<button className="icon-btn" aria-label="Step forward" title="Step (.)" data-testid="step-forward" onClick={() => onSeek(applied + 1)}>
				<Icon.step />
			</button>
			<button className="icon-btn" aria-label="End" title="End (End)" onClick={() => onSeek(total)}>
				<Icon.last />
			</button>
			<input
				type="range"
				min={0}
				max={total}
				value={applied}
				aria-label="Scrub"
				onChange={(e) => onSeek(Number(e.target.value))}
			/>
			<span className="stepbar__count" data-testid="step-count">
				{applied} / {total}
			</span>
		</div>
	);
}

export function Inspector({ state }: { state: TraceState }) {
	const e = state.lastEvent;
	const algo = state.trace.algo;
	const astar = algo === 'astar';
	const rows = state.frontierSorted(8);
	return (
		<aside className="float inspector" aria-label="Inspector">
			<h3>{algoLabel(algo)} · step {e ? e.step : 0}</h3>
			<p className="narration" aria-live="polite" data-testid="narration">
				{e ? narrate(e, algo) : 'Press Step to begin. Each step is one thing the algorithm does.'}
			</p>
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
