import { isDeadLink, kindOf, type Bookmark } from './db';
import { formatDate } from './formatDate';
import { hostnameOf } from './normalize';
import { platformById } from './platform';

// How long things have gone untouched, and how aged that makes them look
// (docs/design/library-interactions.md, 5.2). The tag index, cards and Look ahead all read it.

export const MONTH = 30.44 * 24 * 60 * 60 * 1000;

// Patina at which an item counts as faded: 12 months untouched.
export const FADED = 0.5;
// Months untouched at which patina reaches 1.
const FULLY_AGED_MONTHS = 24;

// Notes are "touched" when edited; links, pictures and quotes when opened.
// updatedAt is ignored for other kinds because background enrichment bumps it.
// Dusting off counts as touching without counting as opening, so openCount stays truthful.
export function lastTouched(b: Bookmark): number {
  const base = Math.max(b.createdAt, b.lastOpenedAt ?? 0, b.dustedAt ?? 0);
  return kindOf(b) === 'note' ? Math.max(base, b.updatedAt) : base;
}

// Never negative, so a clock moved back doesn't make anything younger than new.
export function monthsSince(timestamp: number, now: number): number {
  return Math.max(0, (now - timestamp) / MONTH);
}

export function monthsUntouched(b: Bookmark, now: number): number {
  return monthsSince(lastTouched(b), now);
}

// 0 = fresh, 1 = fully aged (24 months untouched). Dead links don't age; they have their own look.
export function patina(b: Bookmark, now: number): number {
  return isDeadLink(b) ? 0 : Math.min(1, monthsUntouched(b, now) / FULLY_AGED_MONTHS);
}

export function isFaded(b: Bookmark, now: number): boolean {
  return patina(b, now) >= FADED;
}

// Steps whole calendar months, so Look ahead names real months ("April 2027"). A day that doesn't
// exist in the new month lands on its last day: 31 Jan + 1 month is 28 (or 29) Feb, not 3 March.
export function addMonths(date: number | Date, months: number): number {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result.getTime();
}

// The age text on a card's meta row (docs/design/library-interactions.md, 6.10). Reads the page's `now`,
// so it moves when Look ahead steps forward. "Revived this session" text is the theme's own and is handled by callers.
export function ageLabel(b: Bookmark, now: number): { text: string; danger?: boolean } {
  if (isDeadLink(b)) {
    return { text: b.lastCheckedAt ? `stopped answering ${formatDate(b.lastCheckedAt)}` : 'stopped answering', danger: true };
  }
  const months = monthsUntouched(b, now);
  const note = kindOf(b) === 'note';
  if (months * 30.44 < 7) return { text: note ? 'written this week' : 'opened this week' };
  if (months < 1) return { text: note ? 'written this month' : 'opened this month' };
  const mo = `${Math.round(months)} mo.`;
  return { text: b.openCount === 0 && !note ? `never opened, ${mo}` : `untouched ${mo}` };
}

// What leads the age text on a Default card: where the item came from.
export function sourcePrefix(b: Bookmark): string {
  switch (kindOf(b)) {
    case 'link':
      return platformById(b.platform)?.label ?? hostnameOf(b.url);
    case 'image':
      return b.url ? `picture from ${platformById(b.platform)?.label ?? hostnameOf(b.url)}` : 'picture';
    case 'quote':
      return 'quote';
    case 'note':
      return 'your note';
  }
}
