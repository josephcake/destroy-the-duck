// Minimal binary heap with a caller-supplied ordering.
export class Heap<T> {
	private items: T[] = [];
	constructor(private less: (a: T, b: T) => boolean) {}
	get size() {
		return this.items.length;
	}
	push(x: T) {
		const a = this.items;
		a.push(x);
		let i = a.length - 1;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (!this.less(a[i], a[p])) break;
			[a[i], a[p]] = [a[p], a[i]];
			i = p;
		}
	}
	pop(): T | undefined {
		const a = this.items;
		if (a.length === 0) return undefined;
		const top = a[0];
		const last = a.pop()!;
		if (a.length) {
			a[0] = last;
			let i = 0;
			for (;;) {
				const l = 2 * i + 1;
				const r = l + 1;
				let m = i;
				if (l < a.length && this.less(a[l], a[m])) m = l;
				if (r < a.length && this.less(a[r], a[m])) m = r;
				if (m === i) break;
				[a[i], a[m]] = [a[m], a[i]];
				i = m;
			}
		}
		return top;
	}
	/** Items in heap order (not sorted); for inspection only. */
	toArray() {
		return this.items.slice();
	}
}
