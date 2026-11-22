// Typed view of the legacy TableContext value (src/Context/TableContext.jsx).
import { useContext } from 'react';
// @ts-expect-error legacy JS module
import { TableContext } from '../Context/TableContext';
import { FAST_CELLS } from '../lib/speed';

export type ClassicAlgo =
	| 'dijkstra'
	| 'linearSearch'
	| 'breadthFirstSearch'
	| 'depthFirstSearch'
	| 'bidirectionalSearch'
	| 'randomSearch';

export type SpeedName = 'sloth' | 'slow' | 'norm' | 'fast' | 'light';

export type LegacyCtx = {
	starting: string;
	ending: string;
	algorithm: ClassicAlgo | 'algorithm';
	running: boolean;
	mazeRunning: boolean;
	isPaused: boolean;
	isPreviewing: boolean;
	isToastVisible: boolean;
	speed: number;
	speedText: SpeedName;
	go: () => void;
	pause: () => void;
	selectAlgorithm: (e: { target: { value: string } }) => void;
	setSpeed: (e: { currentTarget: { attributes: { name: { value: string } } } }) => void;
	buildMaze: (name: string) => void;
	clearBoard: (name: string | null) => void;
	showBestPath: () => void;
	hideBestPath: () => void;
	resetToast: (origin?: string) => void;
};

export const useLegacy = () => useContext(TableContext) as LegacyCtx;

export const CLASSIC: { id: ClassicAlgo; label: string; blurb: string; order: string }[] = [
	{ id: 'dijkstra', label: 'Dijkstra', blurb: 'Draws the shortest path it found.', order: 'up, down, left, right' },
	{ id: 'linearSearch', label: 'Linear Search', blurb: 'One walker with a fixed preference order.', order: 'left, then up, down, right' },
	{ id: 'breadthFirstSearch', label: 'Breadth First Search', blurb: 'Ring-by-ring spread from the Arrow.', order: 'left, right, down, up' },
	{ id: 'depthFirstSearch', label: 'Depth First Search', blurb: 'Spreads from the duck back to the Arrow.', order: 'left, right, down, up' },
	{ id: 'bidirectionalSearch', label: 'Bidirectional Search', blurb: 'Two waves meeting in the middle.', order: 'left, right, down, up' },
	{ id: 'randomSearch', label: 'Random Search', blurb: 'A random walk that bumps into the duck.', order: 'random' },
];

export const SPEEDS: { name: SpeedName; label: string; title?: string }[] = [
	{ name: 'sloth', label: 'Sloth' },
	{ name: 'slow', label: 'Slow' },
	{ name: 'norm', label: 'Norm' },
	{ name: 'fast', label: 'Fast', title: `${FAST_CELLS} cells every 10 ms` },
	{ name: 'light', label: 'Light', title: 'light speed: 40 cells a tick' },
];

export const MAZES = [
	{ value: 'basic', text: 'Basic' },
	{ value: 'spiral', text: 'Spiral' },
	{ value: 'target', text: 'Target' },
	{ value: 'stair', text: 'Stair' },
	{ value: 'checker', text: 'Checker' },
	{ value: 'horizontal', text: 'Horizontal Wide' },
	{ value: 'vertical', text: 'Vertical Wide' },
	{ value: 'random', text: 'Random' },
];

export const speedEvent = (name: SpeedName) => ({ currentTarget: { attributes: { name: { value: name } } } });
