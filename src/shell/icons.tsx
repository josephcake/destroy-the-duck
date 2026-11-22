// Line icons drawn to match the duck logo's rounded 2px strokes.
import type { ReactNode } from 'react';

const I = ({ children }: { children: ReactNode }) => (
	<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		{children}
	</svg>
);

export const Icon = {
	collapse: () => <I><path d="M5 5v14M19 6l-6 6 6 6" /></I>,
	menu: () => <I><path d="M4 7h16M4 12h16M4 17h16" /></I>,
	step: () => <I><path d="M6 6l8 6-8 6zM18 6v12" /></I>,
	back: () => <I><path d="M18 6l-8 6 8 6zM6 6v12" /></I>,
	first: () => <I><path d="M6 6v12M18 6l-8 6 8 6" /></I>,
	last: () => <I><path d="M18 6v12M6 6l8 6-8 6" /></I>,
	play: () => <I><path d="M7 5l12 7-12 7z" /></I>,
	pause: () => <I><path d="M8 5v14M16 5v14" /></I>,
	reset: () => <I><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></I>,
	minus: () => <I><path d="M5 12h14" /></I>,
	plus: () => <I><path d="M12 5v14M5 12h14" /></I>,
	fit: () => <I><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></I>,
	home: () => <I><path d="M4 11l8-7 8 7M6 10v10h12V10" /></I>,
	wall: () => <I><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 12h16M12 4v8M8 12v8M16 12v8" /></I>,
	weight: () => <I><path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" /></I>,
	oneway: () => <I><path d="M4 12h12M12 7l5 5-5 5" /><path d="M4 7l3 5-3 5" /></I>,
	pad: () => <I><circle cx="7" cy="12" r="3.5" /><circle cx="17" cy="12" r="3.5" /><path d="M10.5 12h3" strokeDasharray="1.5 1.5" /></I>,
	duck: () => <I><path d="M5 14c0 3 3 5 7 5s7-2 7-6c-2 1-4 1-5 0 1-1 2-2 2-4a4 4 0 0 0-8 0c0 1 .5 2 1 2.5C7 12 5 12 5 14z" /><path d="M14 8h3" /></I>,
	erase: () => <I><path d="M8 20h12M5 15l9-9 5 5-9 9H8z" /></I>,
	hand: () => <I><path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 13" /></I>,
	pin: () => <I><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" /></I>,
	chevron: () => <I><path d="M6 9l6 6 6-6" /></I>,
	foot: () => <I><path d="M12 20c-3 0-5-2-5-5 0-2 1-3 2-5l3-6 3 6c1 2 2 3 2 5 0 3-2 5-5 5z" /></I>,
};
