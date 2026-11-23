// Quack Hunt's story: every algorithm has found and escape lines, all short and warm.
import { TRACED } from './engine/trace';
import type { Trace } from './engine/trace';
import { CLASSIC } from './shell/legacy';
import { CHECKPOINT, INTRO, INTRO_SHORT, LINES, PREMISE, SHARED, checkpointLine, linesFor, storyLine, traceLine } from './story';

const ALL = [...CLASSIC.map((a) => a.id), ...TRACED];

test('every algorithm (classic six and the new nine) has found and escape lines, and no stray keys', () => {
	expect(Object.keys(LINES).sort()).toEqual([...ALL].sort());
	for (const a of ALL) {
		expect(LINES[a].found.length, a).toBeGreaterThanOrEqual(2);
		expect(LINES[a].escaped.length, a).toBeGreaterThanOrEqual(2);
		expect(linesFor(a, 'found').length).toBeGreaterThanOrEqual(3);
		expect(linesFor(a, 'escaped').length).toBeGreaterThanOrEqual(3);
	}
});

test('every pill line is 60 characters or fewer, distinct, and never violent', () => {
	const lines = [...Object.values(LINES).flatMap((l) => [...l.found, ...l.escaped]), ...SHARED.found, ...SHARED.escaped, ...CHECKPOINT.found, ...CHECKPOINT.blocked.map((l) => l.replace('{n}', '999')), INTRO_SHORT];
	for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(60);
	for (const a of ALL) {
		expect(new Set(linesFor(a, 'found')).size).toBe(linesFor(a, 'found').length);
		expect(new Set(linesFor(a, 'escaped')).size).toBe(linesFor(a, 'escaped').length);
	}
	for (const l of [...lines, INTRO, PREMISE]) expect(l).not.toMatch(/\b(kill|shoot|shot|gun|dead duck|hurt|blood|trap)\b/i);
	expect(INTRO.length).toBeLessThanOrEqual(130); // one or two lines in the card
});

test('storyLine goes round-robin through the set, per algorithm and outcome', () => {
	const set = linesFor('astar', 'found');
	const got = set.map(() => storyLine('astar', 'found'));
	expect(new Set(got).size).toBe(set.length);
	expect(storyLine('astar', 'found')).toBe(got[0]);
	expect(linesFor('astar', 'escaped')).toContain(storyLine('astar', 'escaped'));
});

test('checkpoint lines: short, warm, no pond, round-robin', () => {
	for (const l of [...CHECKPOINT.found, ...CHECKPOINT.blocked.map((l) => l.replace('{n}', '999'))]) {
		expect(l.length, l).toBeLessThanOrEqual(60);
		expect(l).not.toMatch(/pond/i);
		expect(l).toMatch(/checkpoint/i);
	}
	const got = CHECKPOINT.blocked.map(() => checkpointLine('blocked'));
	expect(new Set(got).size).toBe(CHECKPOINT.blocked.length);
});

test('a blocked line names the checkpoint that is out of reach (gate nit)', () => {
	for (const l of CHECKPOINT.blocked) expect(l).toContain('{n}');
	const cp = { order: [{ r: 1, c: 1 }, { r: 2, c: 2 }, { r: 3, c: 3 }], method: 'exact', reached: 2 };
	const t = { algo: 'astar', result: { found: false, checkpoints: cp } } as unknown as Trace;
	const got = CHECKPOINT.blocked.map(() => traceLine(t));
	expect(got).toEqual(expect.arrayContaining(CHECKPOINT.blocked.map((l) => l.replace('{n}', '3'))));
	for (const l of got) expect(l).toMatch(/checkpoint 3\b/i);
	expect(checkpointLine('blocked', 12)).toMatch(/checkpoint 12\b/i);
});
