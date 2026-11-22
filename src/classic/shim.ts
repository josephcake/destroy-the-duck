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

/** classes: row-major strings such as "dark_wall"; ROWS * COLS of them unless `cols` says the grid is wider. */
export function makeDocument(classes: readonly string[], cols = COLS): ClassicDocument {
	if (cols === COLS ? classes.length !== ROWS * COLS : classes.length % cols !== 0) throw new Error(`expected ${cols === COLS ? ROWS * COLS : `a multiple of ${cols}`} classes, got ${classes.length}`);
	const cells: ClassicCell[] = classes.map((className, i) => ({ id: `${Math.floor(i / cols)}-${i % cols}`, className }));
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

/** Runs fn with globalThis.document = shim, even where a real document exists (the main-thread fallback). */
export function withShim<T>(doc: ClassicDocument, fn: () => T): T {
	if (typeof globalThis.document === 'undefined') return withDocument(doc, fn);
	const g = globalThis as Record<string, unknown>;
	const own = Object.getOwnPropertyDescriptor(g, 'document');
	Object.defineProperty(g, 'document', { value: doc, configurable: true, writable: true });
	try {
		return fn();
	} finally {
		if (own) Object.defineProperty(g, 'document', own);
		else delete g.document;
	}
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
