// §6: a legend swatch is the real canvas sprite at 22 px, not a CSS square. It is
// drawn on a detached canvas and shown as an <img>, so the board stays the page's
// only <canvas>.
import React, { useEffect, useState } from 'react';
import { drawSwatch, SwatchKind } from '../canvas/render';
import { Palette } from '../canvas/palette';

export function Swatch({ kind, palette, size = 22, className = 'swatch' }: { kind: SwatchKind; palette: Palette; size?: number; className?: string }) {
	const [src, setSrc] = useState<string | undefined>();
	useEffect(() => {
		let live = true;
		const draw = () => {
			const cv = document.createElement('canvas');
			const ctx = cv.getContext?.('2d');
			if (!ctx) return; // jsdom
			const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
			cv.width = size * dpr;
			cv.height = size * dpr;
			drawSwatch(ctx, kind, palette, dpr, size);
			if (live) setSrc(cv.toDataURL());
		};
		try {
			draw();
		} catch {
			/* no canvas */
		}
		document.fonts?.ready.then(() => live && draw()).catch(() => {}); // stamps and stickers use web fonts
		return () => {
			live = false;
		};
	}, [kind, palette, size]);
	return <img className={className} src={src} width={size} height={size} alt="" aria-hidden="true" data-swatch={kind} />;
}
