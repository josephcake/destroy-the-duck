// Phase A "legacy mirror": the classic 35x80 <table> stays mounted (hidden)
// and keeps running the unchanged classic code. This reads its cell classes
// so the canvas can paint Home from them.
import { HOME_COLS, HOME_ROWS, idOf } from '../model/cell';

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
	previewOrder: number[] = []; // indices in the order preview tags appeared
	start = -1;
	end = -1;
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
				const now = performance.now();
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
			this.kind[i] = kind;
			this.changedAt[i] = now;
		}
		if (kind === K.Start) this.start = i;
		if (kind === K.End) this.end = i;
		if (preview && !this.preview[i]) this.previewOrder.push(i);
		if (!preview && this.preview[i]) this.previewOrder = this.previewOrder.filter((j) => j !== i);
		this.preview[i] = preview ? 1 : 0;
	}

	at(r: number, c: number): K {
		return this.kind[r * HOME_COLS + c] as K;
	}
	static idAt(i: number) {
		return idOf(Math.floor(i / HOME_COLS), i % HOME_COLS);
	}
	static cellAt(i: number) {
		return { r: Math.floor(i / HOME_COLS), c: i % HOME_COLS };
	}
}

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
