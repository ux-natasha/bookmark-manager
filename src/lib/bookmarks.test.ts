import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { patina } from './age';
import { db } from './db';
import { deleteBookmark, dustOff, findByUrl, liveBookmarks, markOpened, restoreBookmark, retitleNote, saveBookmark, trashDaysLeft, trashedBookmarks, undoDustOff, updateBookmark } from './bookmarks';
import { planImport, type FavoriteItem } from './importer';
import { normalizeUrl } from './normalize';
import { pickForgotten } from './resurface';

beforeEach(async () => {
  await db.bookmarks.clear();
});

describe('saveBookmark', () => {
  it('does not create a duplicate when the same page is saved twice', async () => {
    const first = await saveBookmark({ url: 'https://example.com/a?utm_source=x', title: 'A', source: 'panel' });
    const second = await saveBookmark({ url: 'http://www.example.com/a/', title: 'A again', source: 'panel' });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.bookmark.id).toBe(first.bookmark.id);
    expect(await liveBookmarks()).toHaveLength(1);
  });

  it('cleans tags: trims, lowercases, removes # and repeats', async () => {
    const { bookmark } = await saveBookmark({
      url: 'https://example.com',
      source: 'panel',
      tags: [' Design ', '#design', 'Type  Foundry', ''],
    });
    expect(bookmark.tags).toEqual(['design', 'type foundry']);
  });

  it('brings a deleted bookmark back, with its note, when saved again', async () => {
    const { bookmark } = await saveBookmark({ url: 'https://example.com', source: 'panel' });
    await updateBookmark(bookmark.id, { note: 'grid inspiration' });
    await deleteBookmark(bookmark.id);
    expect(await findByUrl('https://example.com')).toBeUndefined();

    const again = await saveBookmark({ url: 'https://example.com', source: 'context-menu' });
    expect(again.created).toBe(true);
    expect(again.bookmark.id).toBe(bookmark.id);
    expect(again.bookmark.note).toBe('grid inspiration');
  });
});

describe('pictures, quotes and notes', () => {
  it("don't count as the page being saved, and the page doesn't count as them", async () => {
    await saveBookmark({ kind: 'quote', url: 'https://example.com/post', text: 'Less, but better.', source: 'context-menu' });
    expect(await findByUrl('https://example.com/post')).toBeUndefined();

    const page = await saveBookmark({ url: 'https://example.com/post', source: 'panel' });
    expect(page.created).toBe(true);
    expect((await findByUrl('https://example.com/post'))?.id).toBe(page.bookmark.id);
  });

  it('keeps different quotes and pictures from one page, but not the same one twice', async () => {
    const url = 'https://example.com/post';
    const quote = (text: string) => saveBookmark({ kind: 'quote', url, text, source: 'context-menu' });
    const picture = (imageUrl: string) => saveBookmark({ kind: 'image', url, imageUrl, source: 'context-menu' });
    expect((await quote('First')).created).toBe(true);
    expect((await quote('Second')).created).toBe(true);
    expect((await quote(' First ')).created).toBe(false);
    expect((await picture('https://cdn.example.com/a.jpg')).created).toBe(true);
    expect((await picture('https://cdn.example.com/b.jpg')).created).toBe(true);
    expect((await picture('https://cdn.example.com/a.jpg')).created).toBe(false);
    expect(await liveBookmarks()).toHaveLength(4);
  });

  it('saves notes without a link, titled by their first line', async () => {
    const a = await saveBookmark({ kind: 'note', url: '', text: 'Call the printer\nAsk about paper stock', source: 'library' });
    const b = await saveBookmark({ kind: 'note', url: '', text: 'Call the printer', source: 'library' });
    expect(a.bookmark.title).toBe('Call the printer');
    expect(b.created).toBe(true);
    expect(await liveBookmarks()).toHaveLength(2);
  });
});

describe('planImport', () => {
  const item = (url: string, folder: string[] = []): FavoriteItem => ({
    url,
    title: url,
    folder,
    location: folder.join(' / '),
    normalizedUrl: normalizeUrl(url),
  });

  it('groups duplicates, skips non-web links and spots pages already saved', async () => {
    await saveBookmark({ url: 'https://saved.com', source: 'panel' });
    const plan = await planImport([
      item('https://a.com/page'),
      item('http://www.a.com/page/', ['Design']),
      item('https://saved.com/'),
      item('javascript:alert(1)'),
      item('https://b.com'),
    ]);
    expect(plan.toImport.map((i) => i.url)).toEqual(['https://a.com/page', 'https://b.com']);
    expect(plan.duplicateGroups).toHaveLength(1);
    expect(plan.alreadySaved).toHaveLength(1);
    expect(plan.skipped).toHaveLength(1);
  });
});

describe('dustOff', () => {
  const old = Date.now() - 400 * 24 * 60 * 60 * 1000;
  const saveOld = (url: string) => saveBookmark({ url, source: 'import', createdAt: old }).then((r) => r.bookmark);

  it('sets dustedAt on every item without touching openCount or lastOpenedAt', async () => {
    const a = await saveOld('https://a.com');
    const b = await saveOld('https://b.com');
    await markOpened(b.id);
    const openedAt = (await db.bookmarks.get(b.id))!.lastOpenedAt;

    const before = Date.now();
    await dustOff([a.id, b.id]);

    const [afterA, afterB] = await Promise.all([db.bookmarks.get(a.id), db.bookmarks.get(b.id)]);
    expect(afterA!.dustedAt).toBeGreaterThanOrEqual(before);
    expect(afterB!.dustedAt).toBeGreaterThanOrEqual(before);
    expect(afterA!.openCount).toBe(0);
    expect(afterA!.lastOpenedAt).toBeUndefined();
    expect(afterB!.openCount).toBe(1);
    expect(afterB!.lastOpenedAt).toBe(openedAt);
  });

  it('makes the item fresh again for ageing', async () => {
    const a = await saveOld('https://a.com');
    expect(patina(a, Date.now())).toBeGreaterThan(0.5);
    await dustOff([a.id]);
    expect(patina((await db.bookmarks.get(a.id))!, Date.now())).toBeLessThan(0.001);
  });

  it('puts the old values back on undo, or clears them', async () => {
    const fresh = await saveOld('https://fresh.com');
    const previous = await saveOld('https://previous.com');
    await db.bookmarks.update(previous.id, { dustedAt: old + 1000 });

    const snapshot = await dustOff([fresh.id, previous.id]);
    expect((await db.bookmarks.get(fresh.id))!.dustedAt).toBeGreaterThan(old);
    await undoDustOff(snapshot);

    const restored = await db.bookmarks.get(fresh.id);
    expect(restored!.dustedAt).toBeUndefined();
    expect('dustedAt' in restored!).toBe(false);
    expect((await db.bookmarks.get(previous.id))!.dustedAt).toBe(old + 1000);
    expect(restored!.openCount).toBe(0);
  });

  it('skips ids that are no longer in the library', async () => {
    const a = await saveOld('https://a.com');
    const snapshot = await dustOff([a.id, 'missing']);
    expect(snapshot.map((s) => s.id)).toEqual([a.id]);
  });
});

describe('pickForgotten', () => {
  it('returns distinct bookmarks, never more than asked for', async () => {
    const old = Date.now() - 100 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < 10; i++) {
      await saveBookmark({ url: `https://site${i}.com`, source: 'import', createdAt: old });
    }
    const picked = pickForgotten(await liveBookmarks(), 4);
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((b) => b.id)).size).toBe(4);
  });
});

describe('retitleNote', () => {
  const before = { title: 'Buy milk', text: 'Buy milk\nand eggs' };
  it('follows the first line when the title was only that', () => {
    expect(retitleNote(before, 'Buy milk', 'Call mum\nand eggs')).toBe('Call mum');
  });
  it('keeps a title that was written', () => {
    expect(retitleNote({ title: 'Shopping', text: 'Buy milk' }, 'Shopping', 'Call mum')).toBe('Shopping');
  });
  it('keeps a title changed in the same edit', () => {
    expect(retitleNote(before, 'Errands', 'Call mum')).toBe('Errands');
  });
  it('falls back when the text is emptied', () => {
    expect(retitleNote(before, 'Buy milk', '  ')).toBe('Untitled note');
  });
});

describe('recently deleted', () => {
  it('lists deleted items, newest deletion first, and restoring removes them', async () => {
    const a = (await saveBookmark({ url: 'https://a.com', source: 'panel' })).bookmark;
    const b = (await saveBookmark({ kind: 'note', url: '', text: 'a note', source: 'library' })).bookmark;
    await saveBookmark({ url: 'https://c.com', source: 'panel' });
    await deleteBookmark(a.id);
    await new Promise((r) => setTimeout(r, 5));
    await deleteBookmark(b.id);
    expect((await trashedBookmarks()).map((x) => x.id)).toEqual([b.id, a.id]);
    await restoreBookmark(b.id);
    expect((await trashedBookmarks()).map((x) => x.id)).toEqual([a.id]);
  });

  it('counts the days left of the 30', () => {
    const day = 24 * 60 * 60 * 1000;
    expect(trashDaysLeft(0, 0)).toBe(30);
    expect(trashDaysLeft(0, 10 * day + 1)).toBe(20);
    expect(trashDaysLeft(0, 40 * day)).toBe(0);
  });
});
