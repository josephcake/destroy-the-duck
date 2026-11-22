import { useEffect, useRef } from 'react';
import { ALGO_INFO, TracedAlgo, isTraced as isTracedAlgo } from '../engine/trace';
import { CLASSIC, ClassicAlgo } from './legacy';
import { Icon } from './icons';

export type AlgoId = ClassicAlgo | TracedAlgo;
export const isTraced = (a: AlgoId | null): a is TracedAlgo => isTracedAlgo(a);

export function algoLabel(a: AlgoId | null) {
	if (!a) return 'Pick an algorithm';
	return isTraced(a) ? ALGO_INFO[a].label : CLASSIC.find((x) => x.id === a)!.label;
}
export function algoSub(a: AlgoId | null) {
	if (!a) return 'Classic · New';
	return isTraced(a) ? `${ALGO_INFO[a].family} · whole board` : 'Classic · whole board';
}

type Props = {
	value: AlgoId | null;
	open: boolean;
	disabled: boolean;
	onOpen: (open: boolean) => void;
	onPick: (a: AlgoId) => void;
	/** Why a new algorithm cannot run on this board (shown, and the option is disabled). */
	blocked?: (a: TracedAlgo) => string | null;
};

export function AlgoPicker({ value, open, disabled, onOpen, onPick, blocked }: Props) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) onOpen(false);
		};
		const esc = (e: KeyboardEvent) => e.key === 'Escape' && onOpen(false);
		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', esc);
		};
	}, [open, onOpen]);
	const pick = (a: AlgoId) => {
		onPick(a);
		onOpen(false);
	};
	return (
		<div className="picker" ref={ref}>
			<button
				className="picker__btn"
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				data-testid="algo-picker"
				onClick={() => onOpen(!open)}>
				<span style={{ flex: 1 }}>
					<span className="picker__name">{algoLabel(value)}</span>
					<span className="picker__sub">{algoSub(value)}</span>
				</span>
				<span className="icon-btn" style={{ width: 20, height: 20 }}>
					<Icon.chevron />
				</span>
			</button>
			{open && (
				<div className="picker__list" role="listbox">
					<div className="picker__group">Classic</div>
					{CLASSIC.map((a) => (
						<button key={a.id} className="picker__item" role="option" aria-selected={value === a.id} onClick={() => pick(a.id)}>
							<span>{a.label}</span>
							<small>{a.blurb}</small>
							<span className="tags">{a.id === 'breadthFirstSearch' || a.id === 'dijkstra' ? '★' : ''}</span>
						</button>
					))}
					<div className="picker__group">New</div>
					{(Object.keys(ALGO_INFO) as TracedAlgo[]).map((a) => (
						<button key={a} className="picker__item" role="option" aria-selected={value === a} aria-disabled={!!blocked?.(a)} disabled={!!blocked?.(a)} title={blocked?.(a) ?? undefined} onClick={() => pick(a)}>
							<span>{ALGO_INFO[a].label}</span>
							<small>{blocked?.(a) ? 'Unavailable here: needs a plain grid' : ALGO_INFO[a].blurb}</small>
							<span className="tags">{ALGO_INFO[a].tags}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
