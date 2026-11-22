// Phase A "legacy mirror": the classic 35x80 <table> stays mounted (hidden)
// and keeps running the unchanged classic code. This reads its cell classes
// so the canvas can paint them.
//
// The table is a 35x80 *window* onto the endless board: table cell "r-c" is
// world cell (origin.r + r, origin.c + c). The window follows the Arrow and
// Duck (shell/window.ts); nothing draws it.
import { Bounds, Cell, HOME_COLS, HOME_ROWS, idOf } from '../model/cell';

export enum K {
	Unvisited = 0,
	Wall = 1,
	Visited = 2,
	Start = 3,
	End = 4,
}

const N = HOME_ROWS * HOME_COLS;

export function parseClass(className: string): { kind: K; preview: boolean } {
	let kind = K.Unvisited;
	let preview = false;
	for (const t of className.split(/\s+/)) {
		if (t === 'preview') preview = true;
		else if (t.endsWith('_wall')) kind = K.Wall;
		else if (t.endsWith('_visited') && !t.endsWith('_unvisited')) kind = K.Visited;
		else if (t.endsWith('_starting')) kind = K.Start;
		else if (t.endsWith('_ending')) kind = K.End;
	}
	return { kind, preview };
}

export class LegacyMirror {
	kind = new Uint8Array(N);
	preview = new Uint8Array(N);
	changedAt = new Float64Array(N); // ms timestamp of the last kind change
	prevKind = new Uint8Array(N); // kind before the last change (erase peel: was it a wall?)
	previewOrder: number[] = []; // indices in the order preview tags appeared
	start = -1; // table index of the Arrow
	end = -1; // table index of Duck 1
	origin: Cell = { r: 0, c: 0 };
	/** Set before a window move: the next batch of class changes carries no change time. */
	silent = false;
	visitedCount = 0;
	version = 0;
	private observer: MutationObserver | null = null;
	private tds: HTMLElement[] = [];
	private onChange: () => void = () => {};

	attach(onChange: () => void) {
		this.onChange = onChange;
		const tbody = document.querySelector('#main tbody');
		if (!tbody) return false;
		this.tds = Array.from(tbody.querySelectorAll('td')) as HTMLElement[];
		for (let i = 0; i < this.tds.length && i < N; i++) this.read(i, 0);
		this.version++;
		if (typeof MutationObserver !== 'undefined') {
			this.observer = new MutationObserver((records) => {
				// a window move rewrites the table: no flutter or peel for that batch
				const now = this.silent ? 0 : performance.now();
				this.silent = false;
				for (const rec of records) {
					const td = rec.target as HTMLElement;
					const i = this.indexOf(td.id);
					if (i >= 0) this.read(i, now);
				}
				this.version++;
				this.onChange();
			});
			this.observer.observe(tbody, { subtree: true, attributes: true, attributeFilter: ['class'] });
		}
		return true;
	}

	detach() {
		this.observer?.disconnect();
	}

	private indexOf(id: string) {
		const m = /^(\d+)-(\d+)$/.exec(id);
		return m ? Number(m[1]) * HOME_COLS + Number(m[2]) : -1;
	}

	private read(i: number, now: number) {
		const { kind, preview } = parseClass(this.tds[i].className);
		const prev = this.kind[i];
		if (prev !== kind) {
			if (prev === K.Visited) this.visitedCount--;
			if (kind === K.Visited) this.visitedCount++;
			this.prevKind[i] = prev;
			this.kind[i] = kind;
			this.changedAt[i] = now;
		}
		if (kind === K.Start) this.start = i;
		if (kind === K.End) this.end = i;
		if (preview && !this.preview[i]) this.previewOrder.push(i);
		if (!preview && this.preview[i]) this.previewOrder = this.previewOrder.filter((j) => j !== i);
		this.preview[i] = preview ? 1 : 0;
	}

	/** Table index of world cell (r, c), or -1 outside the window. */
	index(r: number, c: number) {
		return windowIndex(this.origin, r, c);
	}
	inWindow(r: number, c: number) {
		return this.index(r, c) >= 0;
	}
	/** What the table holds at world cell (r, c); Unvisited outside the window. */
	at(r: number, c: number): K {
		const i = this.index(r, c);
		return i < 0 ? K.Unvisited : (this.kind[i] as K);
	}
	/** World cell of table index i. */
	cellAt(i: number): Cell {
		return windowCell(this.origin, i);
	}
	/** Table id ("r-c") of world cell (r, c); only meaningful inside the window. */
	idAt(r: number, c: number) {
		return idOf(r - this.origin.r, c - this.origin.c);
	}
	get window(): Bounds {
		return windowBounds(this.origin);
	}
}

export const windowCell = (o: Cell, i: number): Cell => ({ r: o.r + Math.floor(i / HOME_COLS), c: o.c + (i % HOME_COLS) });
export function windowIndex(o: Cell, r: number, c: number) {
	const lr = r - o.r;
	const lc = c - o.c;
	return lr >= 0 && lr < HOME_ROWS && lc >= 0 && lc < HOME_COLS ? lr * HOME_COLS + lc : -1;
}
export const windowBounds = (o: Cell): Bounds => ({ r0: o.r, c0: o.c, r1: o.r + HOME_ROWS - 1, c1: o.c + HOME_COLS - 1 });

// Input bridge: canvas gestures inside Home become the same DOM events the
// legacy table listened to, so TableContext's handlers run unchanged.
export const legacy = {
	down(id: string) {
		document.getElementById(id)?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
	},
	move(id: string) {
		document.getElementById(id)?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
	},
	up() {
		window.dispatchEvent(new MouseEvent('mouseup'));
	},
	/** Single-cell erase, the same class swap Clear Wall does per cell. */
	eraseWall(id: string) {
		const td = document.getElementById(id);
		if (td && td.className.includes('_wall')) td.className = td.className.replace('wall', 'unvisited');
	},
};
