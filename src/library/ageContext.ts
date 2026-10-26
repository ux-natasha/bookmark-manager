import { createContext, useContext, type CSSProperties } from 'react';
import { FADED, monthsUntouched, patina } from '../lib/age';
import type { Bookmark } from '../lib/db';

// What every card needs to age: the page's one `now` (which Look ahead moves), and what has been
// brought back this session. Passed by context so the four themes' layouts don't each thread it through.

export interface Revived {
  // How long it had gone untouched, in whole months, when it was brought back.
  months: number;
  // Brought back by Refresh my memory rather than by its own button.
  batch: boolean;
}

export interface AgeState {
  now: number;
  lookingAhead: boolean;
  // Brought back this session. The after-state (shine, circle, band, text) stays until reload or Undo.
  revived: ReadonlyMap<string, Revived>;
  // Items whose bring-back animation is playing right now, with their stagger delay in ms.
  playing: ReadonlyMap<string, number>;
  onDust: (bookmark: Bookmark) => void;
}

export const AgeContext = createContext<AgeState>({
  now: Date.now(),
  lookingAhead: false,
  revived: new Map(),
  playing: new Map(),
  onDust: () => {},
});

export interface ItemAge {
  // 0 fresh … 1 fully aged (lib/age.ts).
  t: number;
  months: number;
  faded: boolean;
  // Faded, and the page isn't a preview of the future: the faded-item button shows.
  canDust: boolean;
  dust: () => void;
  // Brought back this session. Stays for the whole session, even while looking ahead.
  revived: Revived | undefined;
  lookingAhead: boolean;
  // Set while the bring-back animation plays: the delay before it starts.
  delay: number | undefined;
  // `--t`, which the theme's CSS turns into its look.
  style: CSSProperties;
}

export function useItemAge(bookmark: Bookmark): ItemAge {
  const { now, lookingAhead, revived, playing, onDust } = useContext(AgeContext);
  const t = patina(bookmark, now);
  const faded = t >= FADED;
  const delay = playing.get(bookmark.id);
  return {
    t,
    months: Math.round(monthsUntouched(bookmark, now)),
    faded,
    canDust: faded && !lookingAhead,
    dust: () => onDust(bookmark),
    revived: revived.get(bookmark.id),
    lookingAhead,
    delay,
    style: { '--t': t.toFixed(3), ...(delay !== undefined && { '--delay': `${delay}ms` }) } as CSSProperties,
  };
}
