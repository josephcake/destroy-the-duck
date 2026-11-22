// A phone held upright gets a friendly nudge to turn sideways: the board has
// far more room in landscape. It goes away on its own when the phone turns,
// and "Continue anyway" hides it for good (remembered in localStorage).
import { useState } from 'react';

export const PORTRAIT_PHONE = '(pointer: coarse) and (max-width: 599px) and (orientation: portrait)';
export const ROTATE_KEY = 'dtd.rotate.dismissed';

export const rotateDismissed = () => {
	try {
		return localStorage.getItem(ROTATE_KEY) === '1';
	} catch {
		return false;
	}
};

/** Shown on a touch phone in portrait, until dismissed once. */
export const shouldPromptRotate = (portraitPhone: boolean, dismissed: boolean) => portraitPhone && !dismissed;

export function RotatePrompt({ portraitPhone }: { portraitPhone: boolean }) {
	const [dismissed, setDismissed] = useState(rotateDismissed);
	if (!shouldPromptRotate(portraitPhone, dismissed)) return null;
	const dismiss = () => {
		try {
			localStorage.setItem(ROTATE_KEY, '1');
		} catch {
			/* private mode: hide for this visit only */
		}
		setDismissed(true);
	};
	return (
		<div className="rotate" role="dialog" aria-modal="true" aria-labelledby="rotate-title" data-testid="rotate-prompt">
			<div className="rotate__card pk-lifted">
				<svg className="rotate__icon" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
					<rect x="30" y="14" width="36" height="62" rx="7" />
					<path d="M44 68h8" />
					<rect className="rotate__ghost" x="17" y="30" width="62" height="36" rx="7" strokeDasharray="5 5" />
					<path d="M76 20a26 26 0 0 1 8 18" />
					<path d="M86 31l-2 8-7-4" />
				</svg>
				<h2 id="rotate-title">Turn your phone sideways</h2>
				<p>The duck hunt has much more room in landscape. Drawing, panning and pinch-zoom work either way.</p>
				<button className="go" onClick={dismiss} data-testid="rotate-continue" autoFocus>
					Continue anyway
				</button>
			</div>
		</div>
	);
}
