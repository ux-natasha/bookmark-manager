import { describe, expect, it } from 'vitest';
import { addMonths, FADED, isFaded, lastTouched, MONTH, monthsUntouched, patina } from './age';
import type { Bookmark } from './db';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 26);

function make(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: 'a',
    url: 'https://example.com',
    normalizedUrl: 'example.com',
    title: 'A',
    note: '',
    tags: [],
    source: 'panel',
    createdAt: NOW - 100 * DAY,
    updatedAt: NOW - 100 * DAY,
    openCount: 0,
    ...overrides,
  };
}

describe('lastTouched', () => {
  it('is the later of saved and opened for links, pictures and quotes', () => {
    for (const kind of [undefined, 'link', 'image', 'quote'] as const) {
      expect(lastTouched(make({ kind }))).toBe(NOW - 100 * DAY);
      expect(lastTouched(make({ kind, lastOpenedAt: NOW - 10 * DAY }))).toBe(NOW - 10 * DAY);
      // Imported favourites can be opened "before" they were saved; it's never in the future.
      expect(lastTouched(make({ kind, lastOpenedAt: NOW - 400 * DAY }))).toBe(NOW - 100 * DAY);
    }
  });

  it("ignores updatedAt for anything but notes, because background enrichment bumps it", () => {
    expect(lastTouched(make({ updatedAt: NOW }))).toBe(NOW - 100 * DAY);
    expect(lastTouched(make({ kind: 'image', updatedAt: NOW }))).toBe(NOW - 100 * DAY);
  });

  it('counts a note as touched when it was edited', () => {
    expect(lastTouched(make({ kind: 'note', url: '', updatedAt: NOW - 5 * DAY }))).toBe(NOW - 5 * DAY);
    expect(lastTouched(make({ kind: 'note', url: '', updatedAt: NOW - 200 * DAY }))).toBe(NOW - 100 * DAY);
  });

  it('counts dusting off as touched, for every kind', () => {
    for (const kind of [undefined, 'image', 'quote', 'note'] as const) {
      expect(lastTouched(make({ kind, dustedAt: NOW - 3 * DAY }))).toBe(NOW - 3 * DAY);
    }
  });

  it('takes the latest of opened and dusted', () => {
    const b = make({ lastOpenedAt: NOW - 20 * DAY, dustedAt: NOW - 30 * DAY });
    expect(lastTouched(b)).toBe(NOW - 20 * DAY);
  });
});

describe('monthsUntouched', () => {
  it('measures in months of 30.44 days', () => {
    expect(monthsUntouched(make({ createdAt: NOW - 3 * MONTH }), NOW)).toBeCloseTo(3);
  });

  it('floors at zero when the clock has moved back', () => {
    expect(monthsUntouched(make({ createdAt: NOW + 5 * DAY }), NOW)).toBe(0);
  });
});

describe('patina', () => {
  it('is 0 when fresh and 1 at 24 months', () => {
    expect(patina(make({ createdAt: NOW }), NOW)).toBe(0);
    expect(patina(make({ createdAt: NOW - 24 * MONTH }), NOW)).toBeCloseTo(1);
  });

  it('is 0.5 at 12 months, which is where an item counts as faded', () => {
    // A day past 12 months, so rounding in the month length can't land it just under.
    const b = make({ createdAt: NOW - 12 * MONTH - DAY });
    expect(patina(b, NOW)).toBeCloseTo(FADED, 1);
    expect(isFaded(b, NOW)).toBe(true);
    expect(isFaded(make({ createdAt: NOW - 11 * MONTH }), NOW)).toBe(false);
  });

  it('stays between 0 and 1, whatever the dates', () => {
    expect(patina(make({ createdAt: NOW - 100 * MONTH }), NOW)).toBe(1);
    expect(patina(make({ createdAt: NOW + 10 * MONTH }), NOW)).toBe(0);
    for (let months = -5; months <= 60; months++) {
      const value = patina(make({ createdAt: NOW - months * MONTH }), NOW);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("is 0 for dead links, however long they've sat", () => {
    const old = NOW - 30 * MONTH;
    expect(patina(make({ createdAt: old, linkStatus: 'gone' }), NOW)).toBe(0);
    expect(patina(make({ createdAt: old, linkStatus: 'unreachable', checkFailures: 2 }), NOW)).toBe(0);
    // One failed check could be a blip, so it still ages.
    expect(patina(make({ createdAt: old, linkStatus: 'unreachable', checkFailures: 1 }), NOW)).toBe(1);
  });

  it('goes back to fresh when dusted off', () => {
    const b = make({ createdAt: NOW - 20 * MONTH });
    expect(patina(b, NOW)).toBeGreaterThan(FADED);
    expect(patina({ ...b, dustedAt: NOW }, NOW)).toBe(0);
  });

  it('ages further when looking ahead', () => {
    const b = make({ createdAt: NOW });
    expect(patina(b, addMonths(NOW, 6))).toBeGreaterThan(0.2);
    expect(patina(b, addMonths(NOW, 12))).toBeGreaterThanOrEqual(FADED - 0.02);
  });
});

describe('addMonths', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
  const ymd = (ts: number) => {
    const d = new Date(ts);
    return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  };

  it('steps whole calendar months', () => {
    expect(ymd(addMonths(at(2026, 10, 26), 1))).toEqual([2026, 11, 26]);
    expect(ymd(addMonths(at(2026, 10, 26), 0))).toEqual([2026, 10, 26]);
  });

  it('crosses a year boundary', () => {
    expect(ymd(addMonths(at(2026, 11, 15), 2))).toEqual([2027, 1, 15]);
    expect(ymd(addMonths(at(2026, 12, 31), 1))).toEqual([2027, 1, 31]);
    expect(ymd(addMonths(at(2026, 10, 26), 24))).toEqual([2028, 10, 26]);
  });

  it("lands on the last day when the day doesn't exist in the new month", () => {
    expect(ymd(addMonths(at(2026, 1, 31), 1))).toEqual([2026, 2, 28]);
    expect(ymd(addMonths(at(2027, 12, 31), 2))).toEqual([2028, 2, 29]);
    expect(ymd(addMonths(at(2026, 8, 31), 1))).toEqual([2026, 9, 30]);
  });

  it('keeps the time of day and accepts a Date', () => {
    const start = new Date(2026, 9, 26, 15, 30, 10);
    const result = new Date(addMonths(start, 3));
    expect([result.getHours(), result.getMinutes(), result.getSeconds()]).toEqual([15, 30, 10]);
  });
});
