// The new board store: everything the legacy 35x80 table does not hold
// (walls outside Home, weights everywhere). Chunked 32x32, sparse.
import { Bounds, keyOf } from './cell';

export const CHUNK = 32;
export type Weight = 2 | 5 | 10;
export const WEIGHTS: readonly Weight[] = [2, 5, 10];

export type Dir = 0 | 1 | 2 | 3; // N, E, S, W (same as engine/graph Dir)
/** Phase C nodes: one-way lanes, teleporter pads (pair 0..25 = a..z), extra ducks (n >= 2). */
export type Tile =
	| { kind: 'wall' }
	| { kind: 'weight'; cost: Weight }
	| { kind: 'oneway'; dir: Dir }
	| { kind: 'pad'; pair: number }
	| { kind: 'duck'; n: number };

const KIND_EMPTY = 0;
const KIND_WALL = 1;
const KIND_WEIGHT = 2;
const KIND_ONEWAY = 3;
const KIND_PAD = 4;
const KIND_DUCK = 5;

function encode(tile: Tile | undefined): [number, number] {
	if (!tile) return [KIND_EMPTY, 0];
	switch (tile.kind) {
		case 'wall':
			return [KIND_WALL, 0];
		case 'weight':
			return [KIND_WEIGHT, tile.cost];
		case 'oneway':
			return [KIND_ONEWAY, tile.dir];
		case 'pad':
			return [KIND_PAD, tile.pair];
		case 'duck':
			return [KIND_DUCK, tile.n];
	}
}
function decode(kind: number, arg: number): Tile | undefined {
	switch (kind) {
		case KIND_WALL:
			return { kind: 'wall' };
		case KIND_WEIGHT:
			return { kind: 'weight', cost: arg as Weight };
		case KIND_ONEWAY:
			return { kind: 'oneway', dir: arg as Dir };
		case KIND_PAD:
			return { kind: 'pad', pair: arg };
		case KIND_DUCK:
			return { kind: 'duck', n: arg };
	}
	return undefined;
}

type Chunk = { kind: Uint8Array; arg: Uint8Array; count: number };

const chunkKey = (cr: number, cc: number) => keyOf(cr, cc);
const split = (v: number) => {
	const q = Math.floor(v / CHUNK);
	return [q, v - q * CHUNK] as const;
};

export class Board {
	private chunks = new Map<number, { cr: number; cc: number; chunk: Chunk }>();
	private listeners = new Set<() => void>();
	version = 0;

	get(r: number, c: number): Tile | undefined {
		const [cr, lr] = split(r);
		const [cc, lc] = split(c);
		const entry = this.chunks.get(chunkKey(cr, cc));
		if (!entry) return undefined;
		const i = lr * CHUNK + lc;
		return decode(entry.chunk.kind[i], entry.chunk.arg[i]);
	}

	/** Returns true when the tile changed. */
	set(r: number, c: number, tile: Tile | undefined): boolean {
		const [cr, lr] = split(r);
		const [cc, lc] = split(c);
		const k = chunkKey(cr, cc);
		let entry = this.chunks.get(k);
		const [kind, arg] = encode(tile);
		if (!entry) {
			if (kind === KIND_EMPTY) return false;
			entry = { cr, cc, chunk: { kind: new Uint8Array(CHUNK * CHUNK), arg: new Uint8Array(CHUNK * CHUNK), count: 0 } };
			this.chunks.set(k, entry);
		}
		const ch = entry.chunk;
		const i = lr * CHUNK + lc;
		if (ch.kind[i] === kind && ch.arg[i] === arg) return false;
		if (ch.kind[i] === KIND_EMPTY && kind !== KIND_EMPTY) ch.count++;
		if (ch.kind[i] !== KIND_EMPTY && kind === KIND_EMPTY) ch.count--;
		ch.kind[i] = kind;
		ch.arg[i] = arg;
		if (ch.count === 0) this.chunks.delete(k);
		this.bump();
		return true;
	}

	clear(filter?: (t: Tile) => boolean) {
		if (!filter) {
			this.chunks.clear();
		} else {
			for (const [r, c, t] of this.entries()) if (filter(t)) this.set(r, c, undefined);
		}
		this.bump();
	}

	/** Every non-empty tile, optionally only chunks intersecting `b`. */
	*entries(b?: Bounds): Generator<[number, number, Tile]> {
		for (const { cr, cc, chunk } of this.chunks.values()) {
			const r0 = cr * CHUNK;
			const c0 = cc * CHUNK;
			if (b && (r0 > b.r1 || r0 + CHUNK - 1 < b.r0 || c0 > b.c1 || c0 + CHUNK - 1 < b.c0)) continue;
			for (let i = 0; i < CHUNK * CHUNK; i++) {
				const kind = chunk.kind[i];
				if (kind === KIND_EMPTY) continue;
				const r = r0 + Math.floor(i / CHUNK);
				const c = c0 + (i % CHUNK);
				yield [r, c, decode(kind, chunk.arg[i])!];
			}
		}
	}

	/** Bounding box of every non-empty tile, or null. */
	contentBounds(): Bounds | null {
		let b: Bounds | null = null;
		for (const [r, c] of this.entries()) {
			if (!b) b = { r0: r, c0: c, r1: r, c1: c };
			else {
				if (r < b.r0) b.r0 = r;
				if (r > b.r1) b.r1 = r;
				if (c < b.c0) b.c0 = c;
				if (c > b.c1) b.c1 = c;
			}
		}
		return b;
	}

	get chunkCount() {
		return this.chunks.size;
	}

	subscribe(fn: () => void) {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private bump() {
		this.version++;
		for (const fn of this.listeners) fn();
	}
}
