// Drives the real legacy TableContextProvider (timers, DOM classes, toast)
// and records every cell class change tick by tick.
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { TableContext, TableContextProvider } from '../Context/TableContext';
import Main from '../Main/Main';
import { mulberry32 } from './legacyDom';

// eslint-disable-next-line no-undef
export const T = typeof vi !== 'undefined' ? vi : jest;

export function mountLegacy(Shell) {
	const ref = { ctx: null };
	const Capture = () => (
		<TableContext.Consumer>
			{(ctx) => {
				ref.ctx = ctx;
				return null;
			}}
		</TableContext.Consumer>
	);
	const utils = render(
		Shell ? (
			<Shell>
				<Capture />
			</Shell>
		) : (
			<TableContextProvider>
				<Main rows={35} cols={80} />
				<Capture />
			</TableContextProvider>
		),
	);
	return { ref, utils };
}

// Keep only the legacy semantic tokens (theme_state, preview); styled-components
// adds hashed classes that change with library versions.
export const semantic = (className) =>
	className
		.split(/\s+/)
		.filter((t) => /^(light|dark|neon)_/.test(t) || t === 'preview')
		.join(' ');

// Runs pending timers until none remain; returns ["id>class ...", ...] per tick.
// Uses a MutationObserver + takeRecords() so each tick costs only its changes.
export function drain(ref, maxTicks = 20000) {
	const tbody = document.querySelector('tbody');
	const observer = new MutationObserver(() => {});
	observer.observe(tbody, { subtree: true, attributes: true, attributeFilter: ['class'] });
	const ticks = [];
	let toastSeen = false;
	for (let i = 0; i < maxTicks && T.getTimerCount() > 0; i++) {
		act(() => {
			T.runOnlyPendingTimers();
		});
		toastSeen = toastSeen || !!ref.ctx.isToastVisible;
		const changed = [];
		const seen = new Set();
		for (const rec of observer.takeRecords()) {
			if (seen.has(rec.target)) continue;
			seen.add(rec.target);
			changed.push(rec.target);
		}
		const changes = changed
			.map((td) => `${td.id}>${semantic(td.className)}`)
			.filter((s, k) => semantic(changed[k].className) !== '' );
		if (changes.length) ticks.push(changes.join(' '));
	}
	observer.disconnect();
	return { ticks, toastSeen, running: ref.ctx.running };
}

export function withSeededRandom(seed, fn) {
	const original = Math.random;
	Math.random = mulberry32(seed);
	try {
		return fn();
	} finally {
		Math.random = original;
	}
}

export function paintWalls(walls) {
	for (const id of walls) {
		const td = document.getElementById(id);
		td.className = td.className.replace('unvisited', 'wall');
	}
}

export { act, cleanup };
