import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { parseBookmarksHtml, parseCsv, parseExportCsv, readImportFile } from './importFile';
import { planImport, runImport } from './importer';

beforeEach(async () => {
  await db.bookmarks.clear();
  await db.tagMeta.clear();
});

const POCKET = `title,url,time_added,tags,status
"Grids, and why they work",https://example.com/grids,1700000000,design|type,unread
Colour notes,https://example.com/colour,1690000000,,archive
`;

const RAINDROP = `id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite
1,Poster archive,"Look at the 1960s ones",An archive of posters,https://posters.example/,Design/Posters,"print, posters",2024-03-01T10:00:00.000Z,,,false
2,Loose link,,,https://loose.example/,Unsorted,,2024-04-01T10:00:00.000Z,,,false
`;

const HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1600000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://bar.example/" ADD_DATE="1600000000">On the bar</A>
        <DT><H3>Design</H3>
        <DL><p>
            <DT><A HREF="https://type.example/?a=1&amp;b=2" ADD_DATE="1650000000" TAGS="type,fonts">Type &amp; layout</A>
            <DD>Good specimens
        </DL><p>
    </DL><p>
    <DT><A HREF="https://root.example/">At the root</A>
</DL><p>
`;

describe('parseCsv', () => {
  it('handles quoted commas, doubled quotes, line breaks inside quotes and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });
});

describe('parseExportCsv', () => {
  it('reads a Pocket export: | tags and dates in seconds', () => {
    const { kind, items } = parseExportCsv(POCKET);
    expect(kind).toBe('pocket');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      url: 'https://example.com/grids',
      title: 'Grids, and why they work',
      tags: ['design', 'type'],
      folder: [],
      dateAdded: 1700000000 * 1000,
    });
    expect(items[1].tags).toEqual([]);
  });

  it('reads a Raindrop export: nested folders, comma tags, notes and ISO dates', () => {
    const { kind, items } = parseExportCsv(RAINDROP);
    expect(kind).toBe('raindrop');
    expect(items[0]).toMatchObject({
      folder: ['Design', 'Posters'],
      tags: ['print', 'posters'],
      note: 'Look at the 1960s ones',
      dateAdded: Date.parse('2024-03-01T10:00:00.000Z'),
    });
    // "Unsorted" isn't a folder anyone made.
    expect(items[1].folder).toEqual([]);
  });

  it('refuses a CSV with no url column', () => {
    expect(() => parseExportCsv('name,age\nA,3\n')).toThrow(/no url column/);
  });
});

describe('parseBookmarksHtml', () => {
  it('keeps folders and tags, decodes entities and skips built-in containers', () => {
    const items = parseBookmarksHtml(HTML);
    expect(items.map((i) => i.url)).toEqual(['https://bar.example/', 'https://type.example/?a=1&b=2', 'https://root.example/']);
    expect(items[0]).toMatchObject({ folder: [], location: 'Bookmarks bar' });
    expect(items[1]).toMatchObject({
      title: 'Type & layout',
      folder: ['Design'],
      location: 'Bookmarks bar / Design',
      tags: ['type', 'fonts'],
      note: 'Good specimens',
      dateAdded: 1650000000 * 1000,
    });
    // Leaving the bookmarks bar leaves its container behind too.
    expect(items[2]).toMatchObject({ folder: [], location: 'a bookmarks file' });
  });
});

describe('readImportFile', () => {
  it('tells HTML from CSV by the contents, and asks for zips to be unzipped', async () => {
    expect((await readImportFile(new File([HTML], 'bookmarks.html'))).kind).toBe('html');
    expect((await readImportFile(new File(['﻿' + POCKET], 'part_000000.csv'))).label).toBe('Pocket');
    await expect(readImportFile(new File([''], 'pocket.zip'))).rejects.toThrow(/Unzip it first/);
  });
});

describe('importing a file', () => {
  it('saves tags and notes alongside folder tags', async () => {
    const { items } = parseExportCsv(RAINDROP);
    await runImport(await planImport(items), { foldersAsTags: true });
    const saved = await db.bookmarks.where('normalizedUrl').equals(items[0].normalizedUrl).first();
    expect(saved?.tags).toEqual(expect.arrayContaining(['print', 'posters']));
    expect(saved?.tags.length).toBeGreaterThanOrEqual(3);
    expect(saved?.note).toBe('Look at the 1960s ones');
    expect(saved?.source).toBe('import');
  });
});
