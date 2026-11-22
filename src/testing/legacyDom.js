// Builds the legacy 35x80 <table> in jsdom with the exact class strings
// src/Table/Td.js produces, so the unmodified classic helpers can run on it.
export const ROWS = 35;
export const COLS = 80;

export function buildLegacyDom({ starting, ending, walls = [], theme = 'light' }) {
	const wallSet = new Set(walls);
	let html = '<div id="main" class="main"><table><tbody class="tbody">';
	for (let r = 0; r < ROWS; r++) {
		html += '<tr>';
		for (let c = 0; c < COLS; c++) {
			const id = `${r}-${c}`;
			const state =
				id === ending
					? 'ending'
					: id === starting
					? 'starting'
					: wallSet.has(id)
					? 'wall'
					: 'unvisited';
			html += `<td id="${id}" class="${theme}_${state}"></td>`;
		}
		html += '</tr>';
	}
	document.body.innerHTML = html + '</tbody></table></div>';
}

// Deterministic Math.random replacement (mulberry32).
export function mulberry32(seed) {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
