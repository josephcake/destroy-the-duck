// Search motion bookkeeping (Prism, search-motion spec §6, 2026-11-22). One flat
// typed-array slot per board cell, i = r * C + c: no Maps and no string keys in
// the render path. Writers: AppShell `seek` (traced runs) and the legacy mirror
// (classic runs). Reader: render.ts, which walks only `live` and `frontier`.
import { BOARD_COLS, BOARD_ROWS } from '../model/bounds';

export const St = {
	None: 0,
	Enter: 1, // phase A: frontier tick grows in
	Hold: 2, // phase B: still frontier tick
	Settle: 3, // phase C: the tick fades as the cell fill comes in
	Done: 4, // phase D: settled, a soft flat fill (in `settled`)
} as const;

/** Per-speed timings in ms (spec §1). */
export type Timing = { in: number; settle: number };
export type Speed = 'sloth' | 'slow' | 'norm' | 'fast' | 'light';
export const MOTION: Record<Speed, Timing> = {
	sloth: { in: 320, settle: 900 },
	slow: { in: 280, settle: 720 },
	norm: { in: 200, settle: 520 },
	fast: { in: 140, settle: 360 },
	light: { in: 0, settle: 240 },
};
/** Past this many live cells the oldest settling ones snap to D (FIFO). */
export const LIVE_CAP = 4000;

export class CellAnim {
	readonly N: number;
	readonly cols: number;
	fAt: Float32Array; // ms since runStart the cell entered the frontier
	vAt: Float32Array; // ms since runStart it was visited
	g: Float32Array; // cost at push (NaN = unknown)
	state: Uint8Array;
	live: Int32Array;
	liveCount = 0;
	frontier: Int32Array;
	frontierCount = 0;
	/** Settled cells in the order they settled (render appends new ones to a cached path). */
	settled: Int32Array;
	settledCount = 0;
	/** Bumped whenever settled cells are removed, so caches rebuild. */
	epoch = 0;
	runStart = 0;
	/** ms since runStart from which settling cells finish at 2x (the path trace started). */
	boostAt = Infinity;
	private fPos: Int32Array;
	private lPos: Int32Array;

	constructor(rows = BOARD_ROWS, cols = BOARD_COLS) {
		this.cols = cols;
		const N = (this.N = rows * cols);
		this.fAt = new Float32Array(N);
		this.vAt = new Float32Array(N);
		this.g = new Float32Array(N).fill(NaN);
		this.state = new Uint8Array(N);
		this.live = new Int32Array(N);
		this.frontier = new Int32Array(N);
		this.settled = new Int32Array(N);
		this.fPos = new Int32Array(N).fill(-1);
		this.lPos = new Int32Array(N).fill(-1);
	}
	index(r: number, c: number) {
		return r < 0 || c < 0 || c >= this.cols || r * this.cols + c >= this.N ? -1 : r * this.cols + c;
	}
	reset(now = 0) {
		this.state.fill(0);
		this.g.fill(NaN);
		this.fPos.fill(-1);
		this.lPos.fill(-1);
		this.liveCount = this.frontierCount = this.settledCount = 0;
		this.runStart = now;
		this.boostAt = Infinity;
		this.epoch++;
	}
	get empty() {
		return this.frontierCount === 0 && this.settledCount === 0 && this.liveCount === 0;
	}
	private addLive(i: number) {
		if (this.lPos[i] >= 0) return;
		if (this.liveCount >= LIVE_CAP) this.snapOldest();
		this.lPos[i] = this.liveCount;
		this.live[this.liveCount++] = i;
	}
	private dropLive(i: number) {
		const p = this.lPos[i];
		if (p < 0) return;
		const last = this.live[--this.liveCount];
		this.live[p] = last;
		this.lPos[last] = p;
		this.lPos[i] = -1;
	}
	private snapOldest() {
		// the oldest settling cell: the smallest vAt among live settles
		let best = -1, bt = Infinity;
		for (let k = 0; k < this.liveCount; k++) {
			const i = this.live[k];
			if (this.state[i] === St.Settle && this.vAt[i] < bt) (bt = this.vAt[i]), (best = i);
		}
		if (best < 0) best = this.live[0];
		this.finish(best);
	}
	private finish(i: number) {
		this.dropLive(i);
		if (this.state[i] === St.Enter) {
			this.state[i] = St.Hold;
			return;
		}
		this.state[i] = St.Done;
		this.settled[this.settledCount++] = i;
	}
	private dropFrontier(i: number) {
		const p = this.fPos[i];
		if (p < 0) return;
		const last = this.frontier[--this.frontierCount];
		this.frontier[p] = last;
		this.fPos[last] = p;
		this.fPos[i] = -1;
	}
	/** init / push / relax. `t` is ms since runStart; instant skips phase A. */
	frontierAt(i: number, t: number, g: number, instant = false) {
		if (i < 0) return;
		if (!Number.isNaN(g)) this.g[i] = g;
		const st = this.state[i];
		if (st === St.Enter || st === St.Hold) return; // already on the frontier (a relax)
		if (st === St.Settle || st === St.Done) return; // a closed cell is never re-opened on screen
		this.fAt[i] = t;
		this.fPos[i] = this.frontierCount;
		this.frontier[this.frontierCount++] = i;
		if (instant) this.state[i] = St.Hold;
		else {
			this.state[i] = St.Enter;
			this.addLive(i);
		}
	}
	/** pop / visit. */
	visitAt(i: number, t: number, instant = false) {
		if (i < 0) return;
		const st = this.state[i];
		if (st === St.Settle || st === St.Done) return;
		this.dropFrontier(i);
		this.dropLive(i);
		this.vAt[i] = t;
		if (instant) {
			this.state[i] = St.Done;
			this.settled[this.settledCount++] = i;
		} else {
			this.state[i] = St.Settle;
			this.addLive(i);
		}
	}
	/** A cell un-visited (a classic table cleared): forget it. */
	clear(i: number) {
		if (i < 0 || this.state[i] === St.None) return;
		if (this.state[i] === St.Done) {
			// rare (classic resets clear everything); rebuild the settled list
			let n = 0;
			for (let k = 0; k < this.settledCount; k++) if (this.settled[k] !== i) this.settled[n++] = this.settled[k];
			this.settledCount = n;
			this.epoch++;
		}
		this.dropFrontier(i);
		this.dropLive(i);
		this.state[i] = St.None;
	}
	/** A new leg: the frontier empties (TraceState does the same). */
	clearFrontier() {
		for (let k = this.frontierCount - 1; k >= 0; k--) {
			const i = this.frontier[k];
			this.dropLive(i);
			this.fPos[i] = -1;
			this.state[i] = St.None;
		}
		this.frontierCount = 0;
	}
	/** Everything still moving jumps to its end state. */
	settleAll() {
		while (this.liveCount) this.finish(this.live[this.liveCount - 1]);
	}
	/** Phase progress of a live cell at time t (0..1, unclamped above). */
	progress(i: number, t: number, T: Timing) {
		if (this.state[i] === St.Enter) return T.in <= 0 ? 1 : (t - this.fAt[i]) / T.in;
		let el = t - this.vAt[i];
		if (t > this.boostAt) el += t - Math.max(this.boostAt, this.vAt[i]); // finishes at 2x
		return T.settle <= 0 ? 1 : el / T.settle;
	}
	/** Moves finished live cells on (A -> B, C -> D). */
	step(t: number, T: Timing) {
		for (let k = this.liveCount - 1; k >= 0; k--) {
			const i = this.live[k];
			if (this.progress(i, t, T) >= 1) this.finish(i);
		}
	}
}
