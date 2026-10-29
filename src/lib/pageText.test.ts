import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreBackup } from './backup';
import { purgeOldTrash, saveBookmark } from './bookmarks';
import { db } from './db';
import { enrichBookmark } from './enrich';
import { idsWithText, MAX_TEXT_LENGTH, readableText, savePageText } from './pageText';
import { needsEnrichment } from './queue';

beforeEach(async () => {
  await db.bookmarks.clear();
  await db.pageTexts.clear();
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const LONG = 'Grids give a page its rhythm, and the best ones are felt rather than seen. '.repeat(6);

const PAGE = `<!doctype html><html><head><title>Grids</title><style>p { color: red }</style></head>
<body>
  <nav><a href="/">Home</a> <a href="/about">About</a></nav>
  <header>Site name</header>
  <article>
    <h1>Why grids work</h1>
    <!-- a comment -->
    <p>${LONG}</p>
    <p>Type &amp; space<br>belong together.</p>
    <script>track()</script>
  </article>
  <footer>© Someone</footer>
</body></html>`;

function respondWith(html: string, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(html, { status, headers: { 'content-type': 'text/html' } })),
  );
}

describe('readableText', () => {
  it("keeps the article's words and drops scripts, styles, comments and the site's navigation", () => {
    const text = readableText(PAGE);
    expect(text.startsWith('Why grids work\n')).toBe(true);
    expect(text).toContain('Type & space\nbelong together.');
    expect(text).not.toMatch(/track\(\)|color: red|a comment|Home|Site name|Someone/);
  });

  it('uses the whole body when nothing is marked as the article, still without navigation', () => {
    const text = readableText(`<body><nav>Menu</nav><div>${LONG}</div></body>`);
    expect(text).toContain('felt rather than seen');
    expect(text).not.toContain('Menu');
  });

  it('caps very long pages at a word break', () => {
    const text = readableText(`<p>${'word '.repeat(MAX_TEXT_LENGTH)}</p>`);
    expect(text.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
    expect(text.endsWith('word')).toBe(true);
  });
});

describe('keeping a page’s words', () => {
  it('reads the whole page once, keeps its words, and only reads the <head> after that', async () => {
    respondWith(PAGE);
    const { bookmark } = await saveBookmark({ url: 'https://grids.example/', source: 'panel' });
    await enrichBookmark(bookmark.id);
    const saved = await db.pageTexts.get(bookmark.id);
    expect(saved?.text).toContain('felt rather than seen');
    expect((await db.bookmarks.get(bookmark.id))?.textSavedAt).toBeTypeOf('number');

    // A later check finds a different page: the first copy stays.
    respondWith(`<body><article>${'Something else entirely. '.repeat(20)}</article></body>`);
    await enrichBookmark(bookmark.id);
    expect((await db.pageTexts.get(bookmark.id))?.text).toBe(saved?.text);
  });

  it('keeps nothing from an error page, and leaves the link to be tried again', async () => {
    respondWith(`<body><article>${LONG}</article></body>`, 503);
    const { bookmark } = await saveBookmark({ url: 'https://busy.example/', source: 'panel' });
    await enrichBookmark(bookmark.id);
    expect(await db.pageTexts.get(bookmark.id)).toBeUndefined();
    expect((await db.bookmarks.get(bookmark.id))?.textSavedAt).toBeUndefined();
  });

  it("marks a page with too few words as read, so it isn't fetched again and again", async () => {
    respondWith('<body><div id="app"></div></body>');
    const { bookmark } = await saveBookmark({ url: 'https://app.example/', source: 'panel' });
    await enrichBookmark(bookmark.id);
    const after = (await db.bookmarks.get(bookmark.id))!;
    expect(await db.pageTexts.get(bookmark.id)).toBeUndefined();
    expect(needsEnrichment(after)).toBe(false);
  });

  it('prefers the words read from the live page', async () => {
    const { bookmark } = await saveBookmark({ url: 'https://live.example/', source: 'panel' });
    await enrichBookmark(bookmark.id, { liveHead: '<title>Live</title>', liveText: LONG });
    expect((await db.pageTexts.get(bookmark.id))?.text).toBe(LONG.trim());
    expect((await db.bookmarks.get(bookmark.id))?.textSavedAt).toBeTypeOf('number');
  });

  it('queues links saved before page text was kept', () => {
    const old = { id: '1', url: 'https://a.example', normalizedUrl: 'a.example', title: 'A', note: '', tags: [], source: 'panel' as const, createdAt: 0, updatedAt: 0, openCount: 0, enrichedAt: 1 };
    expect(needsEnrichment({ ...old, linkStatus: 'ok' })).toBe(true);
    expect(needsEnrichment({ ...old, linkStatus: 'ok', textSavedAt: 2 })).toBe(false);
    expect(needsEnrichment({ ...old, linkStatus: 'restricted' })).toBe(false);
  });
});

describe('searching saved pages', () => {
  it('finds pages holding every word, in any case', async () => {
    await savePageText('a', LONG);
    await savePageText('b', 'Colour theory for people who print things. '.repeat(10));
    expect([...(await idsWithText(['rhythm', 'felt']))]).toEqual(['a']);
    expect((await idsWithText(['rhythm', 'print'])).size).toBe(0);
  });
});

describe('page text in backups and the bin', () => {
  it('restores the words with the item, under the id it merges into', async () => {
    await db.bookmarks.add({
      id: 'here', url: 'https://a.com', normalizedUrl: 'a.com', title: 'A', note: '', tags: [], source: 'panel',
      createdAt: 1, updatedAt: 1, openCount: 0,
    });
    const base = { tags: [], createdAt: 1, updatedAt: 1, openCount: 0, textSavedAt: 5 };
    const file = new File(
      [JSON.stringify({
        format: 'bookmark-manager-backup', version: 3, exportedAt: '',
        bookmarks: [
          { ...base, id: 'there', url: 'https://a.com', title: 'A' },
          { ...base, id: 'new', url: 'https://b.com', title: 'B' },
          { ...base, id: 'bare', url: 'https://c.com', title: 'C' },
        ],
        pageTexts: [
          { bookmarkId: 'there', text: 'words of a', savedAt: 5 },
          { bookmarkId: 'new', text: 'words of b', savedAt: 5 },
        ],
      })],
      'b.json',
    );
    await restoreBackup(file);
    expect((await db.pageTexts.get('here'))?.text).toBe('words of a');
    expect((await db.bookmarks.get('here'))?.textSavedAt).toBe(5);
    expect((await db.pageTexts.get('new'))?.text).toBe('words of b');
    // Its words weren't in the file, so the page is read again.
    expect((await db.bookmarks.get('bare'))?.textSavedAt).toBeUndefined();
  });

  it('empties the words along with the item when the bin is emptied', async () => {
    await db.bookmarks.add({
      id: 'old', url: 'https://a.com', normalizedUrl: 'a.com', title: 'A', note: '', tags: [], source: 'panel',
      createdAt: 1, updatedAt: 1, openCount: 0, deletedAt: 1,
    });
    await savePageText('old', LONG);
    await purgeOldTrash();
    expect(await db.pageTexts.get('old')).toBeUndefined();
  });
});
