import '@testing-library/jest-dom/vitest';

// jsdom has no Path2D; the paper-kit canvas primitives build paths with it.
// A recording no-op is enough for the unit tests that drive render() with fake contexts.
if (typeof globalThis.Path2D === 'undefined') {
	globalThis.Path2D = class Path2D {
		constructor() {
			this.ops = [];
		}
	};
	for (const m of ['moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'closePath', 'quadraticCurveTo', 'bezierCurveTo', 'addPath'])
		globalThis.Path2D.prototype[m] = function (...a) {
			this.ops.push([m, ...a]);
		};
}
if (typeof globalThis.DOMMatrix === 'undefined') {
	globalThis.DOMMatrix = class DOMMatrix {
		translate() {
			return this;
		}
	};
}

// jsdom has no OffscreenCanvas; the paper kit and the renderer bake sprites on
// offscreen layers. A no-op 2D context lets the whole render path run in tests.
if (typeof globalThis.OffscreenCanvas === 'undefined') {
	const noopCtx = () =>
		new Proxy(
			{},
			{
				get(t, k) {
					if (k in t) return t[k];
					if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
					if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
					if (k === 'createPattern') return () => ({ setTransform() {} });
					if (k === 'getLineDash') return () => [];
					if (k === 'getImageData' || k === 'createImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(4 * (w ?? x) * (h ?? y)) });
					return () => {};
				},
				set(t, k, v) {
					t[k] = v;
					return true;
				},
			},
		);
	globalThis.OffscreenCanvas = class {
		constructor(w, h) {
			this.width = w;
			this.height = h;
		}
		getContext() {
			return noopCtx();
		}
	};
}
