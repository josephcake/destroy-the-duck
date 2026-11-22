// Phase B "document" stand-in. The classic helpers only ever ask
// document.getElementById(id) and document.querySelectorAll('td'), and only
// read .id and .className from what they get back. This answers exactly that
// from a snapshot of Home's 2,800 class strings, so the helper files run
// unchanged (byte-identical) inside a Worker, where no DOM exists.
export const ROWS = 35;
export const COLS = 80;

export type ClassicCell = { readonly id: string; className: string };
export type ClassicDocument = {
	getElementById(id: string): ClassicCell | null;
	querySelectorAll(selector: string): ClassicCell[];
};

/** classes: row-major, ROWS * COLS strings such as "dark_wall". */
export function makeDocument(classes: readonly string[]): ClassicDocument {
	if (classes.length !== ROWS * COLS) throw new Error(`expected ${ROWS * COLS} classes, got ${classes.length}`);
	const cells: ClassicCell[] = classes.map((className, i) => ({ id: `${Math.floor(i / COLS)}-${i % COLS}`, className }));
	// getElementById is an exact string lookup: "3-80", "-1-4" or "03-4" are null, as in the browser.
	const byId = new Map(cells.map((c) => [c.id, c]));
	return {
		getElementById: (id) => byId.get(String(id)) ?? null,
		querySelectorAll: (selector) => {
			if (selector !== 'td') throw new Error(`shim only supports 'td', got '${selector}'`);
			return cells.slice();
		},
	};
}

/** Runs fn with globalThis.document = shim when no real document exists (Worker, Node). */
export function withDocument<T>(doc: ClassicDocument, fn: () => T): T {
	const g = globalThis as { document?: unknown };
	if (typeof g.document !== 'undefined') return fn(); // main thread: the live table is the source
	g.document = doc;
	try {
		return fn();
	} finally {
		delete g.document;
	}
}
