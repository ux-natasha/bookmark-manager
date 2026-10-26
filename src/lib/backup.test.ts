import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { restoreBackup } from './backup';
import { db } from './db';

beforeEach(async () => {
  await db.bookmarks.clear();
  await db.tagMeta.clear();
});

function backupFile(contents: object): File {
  return new File([JSON.stringify({ format: 'bookmark-manager-backup', exportedAt: '', bookmarks: [], ...contents })], 'b.json');
}

describe('restoreBackup', () => {
  it('still restores version 1 files, which have no tag metadata', async () => {
    const result = await restoreBackup(backupFile({ version: 1, bookmarks: [{ url: 'https://example.com', title: 'A', tags: ['a'] }] }));
    expect(result.added).toBe(1);
    expect(await db.tagMeta.count()).toBe(0);
  });

  it('carries dustedAt for new items, and keeps the later one when merging', async () => {
    const item = (id: string, dustedAt?: number) => ({
      id,
      url: `https://${id}.com`,
      title: id,
      tags: [],
      createdAt: 1,
      updatedAt: 1,
      openCount: 0,
      dustedAt,
    });
    await db.bookmarks.add({ ...item('b', 100), normalizedUrl: 'b.com', note: '', source: 'panel' });
    await db.bookmarks.add({ ...item('c'), normalizedUrl: 'c.com', note: '', source: 'panel' });

    await restoreBackup(backupFile({ version: 2, bookmarks: [item('a', 50), item('b', 40), item('c', 70)] }));

    expect((await db.bookmarks.get('a'))?.dustedAt).toBe(50);
    expect((await db.bookmarks.get('b'))?.dustedAt).toBe(100);
    expect((await db.bookmarks.get('c'))?.dustedAt).toBe(70);
  });

  it('merges tag metadata: un-archive wins, latest use wins, local colour wins', async () => {
    await db.tagMeta.bulkPut([
      { tag: 'a', colorSlot: 1, lastUsedAt: 10, archivedAt: 5 },
      { tag: 'b', archivedAt: 7 },
    ]);
    await restoreBackup(
      backupFile({
        version: 2,
        tagMeta: [
          { tag: 'a', colorSlot: 4, lastUsedAt: 20 },
          { tag: 'b', archivedAt: 3 },
          { tag: 'c', colorSlot: 2 },
        ],
      }),
    );
    expect(await db.tagMeta.get('a')).toEqual({ tag: 'a', colorSlot: 1, lastUsedAt: 20, archivedAt: undefined });
    expect((await db.tagMeta.get('b'))?.archivedAt).toBe(3);
    expect((await db.tagMeta.get('c'))?.colorSlot).toBe(2);
  });
});
