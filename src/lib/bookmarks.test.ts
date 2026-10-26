import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteBookmark, findByUrl, liveBookmarks, saveBookmark, updateBookmark } from './bookmarks';
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
