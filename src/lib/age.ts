import { kindOf, type Bookmark } from './db';

// How long things have gone untouched (docs/design/library-interactions.md, 5.2).
// The tag index uses it now; ageing and Look ahead (phase 3) build on it.

export const MONTH = 30.44 * 24 * 60 * 60 * 1000;

// Notes are "touched" when edited; links, pictures and quotes when opened.
// updatedAt is ignored for other kinds because background enrichment bumps it.
export function lastTouched(b: Bookmark): number {
  const base = Math.max(b.createdAt, b.lastOpenedAt ?? 0);
  return kindOf(b) === 'note' ? Math.max(base, b.updatedAt) : base;
}

// Never negative, so a clock moved back doesn't make anything younger than new.
export function monthsSince(timestamp: number, now: number): number {
  return Math.max(0, (now - timestamp) / MONTH);
}
