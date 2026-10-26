import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBookmark } from './bookmarks';
import { db } from './db';
import { enrichBookmark } from './enrich';

beforeEach(async () => {
  await db.bookmarks.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enrichBookmark when the site does not answer', () => {
  it('counts a failure when we are online', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const { bookmark } = await saveBookmark({ url: 'https://gone.example', source: 'panel' });
    await enrichBookmark(bookmark.id);
    const after = await db.bookmarks.get(bookmark.id);
    expect(after?.linkStatus).toBe('unreachable');
    expect(after?.checkFailures).toBe(1);
  });

  it('counts nothing and leaves the bookmark to be tried again when we are offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { bookmark } = await saveBookmark({ url: 'https://gone.example', source: 'panel' });
    await enrichBookmark(bookmark.id);
    const after = await db.bookmarks.get(bookmark.id);
    expect(after?.linkStatus).toBeUndefined();
    expect(after?.checkFailures).toBeUndefined();
    expect(after?.enrichedAt).toBeUndefined();
  });
});
