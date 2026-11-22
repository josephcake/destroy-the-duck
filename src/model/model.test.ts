import { Board, CHUNK } from './board';
import { cellOfKey, keyOf, parseId, idOf } from './cell';
import { parseLevel } from './level';

test('packed keys round-trip, including negatives', () => {
	for (const [r, c] of [[0, 0], [-1, -2], [34, 79], [-100000, 99999]])
		expect(cellOfKey(keyOf(r, c))).toEqual({ r, c });
	expect(parseId(idOf(-1, -2))).toEqual({ r: -1, c: -2 });
});

test('board is sparse and chunked', () => {
	const b = new Board();
	b.set(-1, -1, { kind: 'wall' });
	b.set(0, 0, { kind: 'weight', cost: 5 });
	b.set(CHUNK * 3, 5, { kind: 'wall' });
	expect(b.chunkCount).toBe(3);
	expect(b.get(0, 0)).toEqual({ kind: 'weight', cost: 5 });
	expect(b.get(-1, -1)).toEqual({ kind: 'wall' });
	expect(b.contentBounds()).toEqual({ r0: -1, c0: -1, r1: CHUNK * 3, c1: 5 });
	b.set(-1, -1, undefined);
	expect(b.chunkCount).toBe(2); // empty chunks are dropped
	b.clear((t) => t.kind === 'wall');
	expect([...b.entries()]).toEqual([[0, 0, { kind: 'weight', cost: 5 }]]);
});

test('level parser', () => {
	const l = parseLevel(['S.#', '25X', '..D']);
	expect(l.arrow).toEqual({ r: 0, c: 0 });
	expect(l.ducks).toEqual([{ r: 2, c: 2 }]);
	expect(l.walls).toEqual([{ r: 0, c: 2 }]);
	expect(l.weights.map((w) => w.cost)).toEqual([2, 5, 10]);
	expect(() => parseLevel(['..D'])).toThrow(/exactly one S/);
	expect(() => parseLevel(['S?D'])).toThrow(/unknown/);
});
