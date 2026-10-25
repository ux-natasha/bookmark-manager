import type { Bookmark } from './db';

const DAY = 24 * 60 * 60 * 1000;
// Anything saved more recently than this is still fresh in your mind, so it isn't resurfaced.
const MIN_AGE = 3 * DAY;

// Picks bookmarks you've most likely forgotten: never-opened ones and the ones untouched longest
// are far more likely to come up, but it stays random so each refresh shows something different.
export function pickForgotten(bookmarks: Bookmark[], count: number, now = Date.now()): Bookmark[] {
  const old = bookmarks.filter((b) => now - b.createdAt >= MIN_AGE);
  const pool = old.length >= count ? old : bookmarks;

  const weighted = pool.map((b) => {
    const lastTouched = b.lastOpenedAt ?? b.createdAt;
    const daysForgotten = Math.max(1, (now - lastTouched) / DAY);
    const neverOpened = b.openCount === 0 ? 2 : 1;
    return { b, weight: daysForgotten * neverOpened };
  });

  const picked: Bookmark[] = [];
  while (picked.length < count && weighted.length > 0) {
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * total;
    const index = weighted.findIndex((w) => (roll -= w.weight) <= 0);
    const [chosen] = weighted.splice(index === -1 ? weighted.length - 1 : index, 1);
    picked.push(chosen.b);
  }
  return picked;
}
