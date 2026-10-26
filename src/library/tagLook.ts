import { createContext, useContext, type CSSProperties } from 'react';
import { topLevelOf } from '../lib/tags';

// How a tag is drawn wherever it appears: its colour slot (from its top-level tag) and whether it's archived.
export interface TagLook {
  slot?: number;
  archived: boolean;
}

export const TagLookContext = createContext<(tag: string) => TagLook>(() => ({ archived: false }));

export function useTagLook(): (tag: string) => TagLook {
  return useContext(TagLookContext);
}

export function lookupFor(slots: Map<string, number>, archived: Set<string>): (tag: string) => TagLook {
  return (tag) => ({ slot: archived.has(tag) ? undefined : slots.get(topLevelOf(tag)), archived: archived.has(tag) });
}

// --mark for squares and highlights, --mark-text for the tag's name. Uncoloured tags fall back to the theme's.
export function slotStyle(slot: number | undefined, extra?: Record<string, string | number>): CSSProperties | undefined {
  if (slot === undefined && !extra) return undefined;
  return {
    ...(slot !== undefined && { '--mark': `var(--tag-${slot})`, '--mark-text': `var(--tag-${slot}-text)` }),
    ...extra,
  } as CSSProperties;
}
