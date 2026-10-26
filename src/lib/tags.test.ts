import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MONTH } from './age';
import { cleanTags, saveBookmark, updateBookmark } from './bookmarks';
import { db, type Bookmark, type TagMeta } from './db';
import { archiveTags, assignColorSlots, buildTagIndex, hasTag, tagStats, type IndexInput } from './tags';

const NOW = Date.UTC(2026, 9, 26);

let n = 0;
function item(tags: string[], monthsAgo = 0): Bookmark {
  const at = NOW - monthsAgo * MONTH;
  return { id: `b${n++}`, url: `https://example.com/${n}`, normalizedUrl: '', title: 't', note: '', tags, source: 'panel', createdAt: at, updatedAt: at, openCount: 0 };
}

function index(bookmarks: Bookmark[], overrides: Partial<IndexInput> = {}) {
  return buildTagIndex({ stats: tagStats(bookmarks), meta: [], selected: [], query: '', now: NOW, threshold: 12, ...overrides });
}

describe('hasTag', () => {
  it('matches the tag and its children, not other tags sharing a prefix', () => {
    const b = { tags: ['recipes/weeknight'] };
    expect(hasTag(b, 'recipes')).toBe(true);
    expect(hasTag(b, 'recipes/weeknight')).toBe(true);
    expect(hasTag(b, 'recipe')).toBe(false);
    expect(hasTag({ tags: ['recipes-old'] }, 'recipes')).toBe(false);
  });
});

describe('cleanTags', () => {
  it('tidies slashes in nested tags', () => {
    expect(cleanTags(['Recipes / Weeknight', '/recipes//x/', 'a/ b /c'])).toEqual(['recipes/weeknight', 'recipes/x', 'a/b/c']);
  });
});

describe('tagStats', () => {
  it('counts a parent once per item across its children, and a child by its own items', () => {
    const stats = tagStats([item(['recipes', 'recipes/weeknight']), item(['recipes/weeknight', 'recipes/baking']), item(['recipes/baking'])]);
    expect(stats.get('recipes')).toMatchObject({ own: 1, all: 3 });
    expect(stats.get('recipes/weeknight')).toMatchObject({ own: 2, all: 2 });
  });
});

describe('buildTagIndex', () => {
  it('groups by letter, nests children, and runs in tags used once', () => {
    const ix = index([item(['design']), item(['design']), item(['dumplings']), item(['recipes/weeknight']), item(['1password'])]);
    expect(ix.groups.map((g) => g.letter)).toEqual(['#', 'D', 'R']);
    const d = ix.groups[1];
    expect(d.entries.map((e) => e.tag)).toEqual(['design']);
    expect(d.once.map((e) => e.tag)).toEqual(['dumplings']);
    // A child whose parent isn't used alone still shows the parent, counted by the children's items.
    const r = ix.groups[2].entries[0];
    expect(r).toMatchObject({ tag: 'recipes', count: 1 });
    expect(r.children.map((c) => c.name)).toEqual(['weeknight']);
    expect(ix.letters.find((l) => l.letter === 'Q')?.present).toBe(false);
    expect(ix.letters[0].letter).toBe('#');
  });

  it('keeps a parent when a child matches the search, showing only the matching children', () => {
    const ix = index([item(['recipes/weeknight']), item(['recipes/baking']), item(['travel'])], { query: 'week' });
    expect(ix.groups).toHaveLength(1);
    expect(ix.groups[0].entries[0].children.map((c) => c.tag)).toEqual(['recipes/weeknight']);
  });

  it('reads dashes as spaces when searching', () => {
    expect(index([item(['side-project'])], { query: 'side proj' }).groups).toHaveLength(1);
  });

  it('marks tags stale by the threshold, never when selected, and not while a child is in use', () => {
    const books = [item(['old'], 13), item(['old'], 14), item(['recent'], 2), item(['home', 'home/lamps'], 20), item(['home/garden'], 1)];
    expect(index(books).stale.sort()).toEqual(['home/lamps', 'old']);
    expect(index(books, { threshold: 0 }).stale).toEqual([]);
    expect(index(books, { selected: ['old'] }).stale).toEqual(['home/lamps']);
    // Looking further ahead makes more tags stale.
    expect(index(books, { now: NOW + 12 * MONTH }).stale.sort()).toEqual(['home', 'home/garden', 'home/lamps', 'old', 'recent']);
  });

  it('fades by disuse, but not selected tags', () => {
    const books = [item(['a'], 9), item(['a'], 9)];
    expect(index(books).groups[0].entries[0].fade).toBeCloseTo(0.5);
    expect(index(books, { selected: ['a'] }).groups[0].entries[0].fade).toBe(0);
  });

  it('counts picking a tag as using it', () => {
    const books = [item(['a'], 20), item(['a'], 20)];
    const meta: TagMeta[] = [{ tag: 'a', lastUsedAt: NOW - MONTH }];
    expect(index(books, { meta }).stale).toEqual([]);
  });

  it('leaves archived tags out, and lists them for bringing back', () => {
    const books = [item(['a']), item(['a']), item(['b']), item(['b'])];
    const ix = index(books, { meta: [{ tag: 'b', archivedAt: NOW }] });
    expect(ix.groups.map((g) => g.letter)).toEqual(['A']);
    expect(ix.liveCount).toBe(1);
    expect(ix.archived).toEqual(['b']);
  });

  it('picks the most-used top-level tags', () => {
    const books = [item(['a', 'b/c']), item(['b/d']), item(['b']), item(['a'])];
    expect(index(books).mostUsed.map((e) => [e.tag, e.count])).toEqual([
      ['b', 3],
      ['a', 2],
    ]);
  });
});

describe('assignColorSlots', () => {
  const books = (counts: Record<string, number>) => Object.entries(counts).flatMap(([tag, c]) => Array.from({ length: c }, () => item([tag])));

  it('gives the most-used top-level tags slots in order', () => {
    const changes = assignColorSlots(tagStats(books({ a: 3, b: 5, c: 1 })), []);
    expect(Object.fromEntries(changes.map((m) => [m.tag, m.colorSlot]))).toEqual({ b: 1, a: 2, c: 3 });
  });

  it('keeps slots when counts change', () => {
    const meta: TagMeta[] = [
      { tag: 'b', colorSlot: 1 },
      { tag: 'a', colorSlot: 2 },
    ];
    expect(assignColorSlots(tagStats(books({ a: 9, b: 1 })), meta)).toEqual([]);
  });

  it('frees the slot of an archived or unused tag and gives it to the next tag', () => {
    const meta: TagMeta[] = [
      { tag: 'a', colorSlot: 1, archivedAt: NOW },
      { tag: 'gone', colorSlot: 2 },
    ];
    const changes = assignColorSlots(tagStats(books({ a: 3, b: 2 })), meta);
    expect(Object.fromEntries(changes.map((m) => [m.tag, m.colorSlot]))).toEqual({ a: undefined, gone: undefined, b: 1 });
  });

  it('stops at eight', () => {
    const counts = Object.fromEntries('abcdefghij'.split('').map((t, i) => [t, 10 - i]));
    expect(assignColorSlots(tagStats(books(counts)), []).map((m) => m.tag)).toEqual('abcdefgh'.split(''));
  });

  it('resolves two tags sharing a slot in favour of the busier one', () => {
    const meta: TagMeta[] = [
      { tag: 'a', colorSlot: 1 },
      { tag: 'b', colorSlot: 1 },
    ];
    const changes = assignColorSlots(tagStats(books({ a: 1, b: 4 })), meta);
    expect(Object.fromEntries(changes.map((m) => [m.tag, m.colorSlot]))).toEqual({ a: 2 });
  });
});

describe('tag writes', () => {
  beforeEach(async () => {
    await db.bookmarks.clear();
    await db.tagMeta.clear();
  });

  it('records tags as used when saved or added, not when already there', async () => {
    const { bookmark } = await saveBookmark({ url: 'https://example.com', source: 'panel', tags: ['a'] });
    expect((await db.tagMeta.get('a'))?.lastUsedAt).toBeTypeOf('number');
    await db.tagMeta.clear();
    await updateBookmark(bookmark.id, { tags: ['a', 'b'] });
    expect(await db.tagMeta.get('a')).toBeUndefined();
    expect((await db.tagMeta.get('b'))?.lastUsedAt).toBeTypeOf('number');
  });

  it('archives with an undo that restores every record as it was', async () => {
    await db.tagMeta.put({ tag: 'a', colorSlot: 3, lastUsedAt: 5 });
    const undo = await archiveTags(['a', 'b'], NOW);
    expect(await db.tagMeta.get('a')).toEqual({ tag: 'a', lastUsedAt: 5, archivedAt: NOW, colorSlot: undefined });
    expect((await db.tagMeta.get('b'))?.archivedAt).toBe(NOW);
    await undo();
    expect(await db.tagMeta.get('a')).toEqual({ tag: 'a', colorSlot: 3, lastUsedAt: 5 });
    expect(await db.tagMeta.get('b')).toBeUndefined();
  });
});
