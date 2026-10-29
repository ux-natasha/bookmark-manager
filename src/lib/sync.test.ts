import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Bookmark, type TagMeta } from './db';
import { buildSyncFile, mergeSyncFile, parseSyncFile, SYNC_FOLDER_NAME, syncNow, type SyncFile } from './sync';

beforeEach(async () => {
  await db.bookmarks.clear();
  await db.tagMeta.clear();
  await db.settings.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A real folder handle can be stored in IndexedDB; this stand-in can't, so the stored setup is stubbed.
function useFolder(folder: object) {
  vi.spyOn(db.settings, 'get').mockResolvedValue({ key: 'sync', folder, deviceId: 'me' });
  vi.spyOn(db.settings, 'update').mockResolvedValue(1);
}

const item = (id: string, overrides: Partial<Bookmark> = {}): Bookmark => ({
  id,
  url: `https://${id}.example/`,
  normalizedUrl: `${id}.example`,
  title: id.toUpperCase(),
  note: '',
  tags: [],
  source: 'panel',
  createdAt: 10,
  updatedAt: 10,
  openCount: 0,
  ...overrides,
});

const fileOf = (bookmarks: Bookmark[], tagMeta: TagMeta[] = []): SyncFile => ({
  format: 'bookmark-manager-sync',
  version: 1,
  deviceId: 'other',
  writtenAt: 0,
  bookmarks,
  tagMeta,
});

describe('mergeSyncFile', () => {
  it('adds new items, to be read again here, and skips ones already deleted there', async () => {
    const result = await mergeSyncFile(fileOf([item('a', { enrichedAt: 5, textSavedAt: 5 }), item('b', { deletedAt: 20 })]));
    expect(result).toEqual({ added: 1, changed: 0 });
    expect(await db.bookmarks.get('a')).toMatchObject({ title: 'A', enrichedAt: undefined, textSavedAt: undefined });
    expect(await db.bookmarks.get('b')).toBeUndefined();
  });

  it('takes edits, including deletes and removed tags, from whichever side changed last', async () => {
    await db.bookmarks.bulkAdd([
      item('a', { tags: ['x', 'y'], note: 'here', updatedAt: 10, enrichedAt: 3, description: 'read here' }),
      item('b', { title: 'Edited here', updatedAt: 50 }),
      item('c'),
    ]);
    await mergeSyncFile(
      fileOf([
        item('a', { tags: ['x'], note: 'there', updatedAt: 20 }),
        item('b', { title: 'Older there', updatedAt: 30 }),
        item('c', { deletedAt: 40, updatedAt: 40 }),
      ]),
    );
    // Details read from the page here are kept.
    expect(await db.bookmarks.get('a')).toMatchObject({ tags: ['x'], note: 'there', updatedAt: 20, enrichedAt: 3, description: 'read here' });
    expect((await db.bookmarks.get('b'))?.title).toBe('Edited here');
    expect((await db.bookmarks.get('c'))?.deletedAt).toBe(40);
  });

  it('adds up use from both sides without counting as an edit', async () => {
    await db.bookmarks.add(item('a', { openCount: 2, lastOpenedAt: 100, dustedAt: 7 }));
    await mergeSyncFile(fileOf([item('a', { openCount: 5, lastOpenedAt: 90, dustedAt: 9, createdAt: 4 })]));
    expect(await db.bookmarks.get('a')).toMatchObject({ openCount: 5, lastOpenedAt: 100, dustedAt: 9, createdAt: 4, updatedAt: 10 });
  });

  it('treats a link saved in both browsers before syncing as one item', async () => {
    await db.bookmarks.add(item('here', { url: 'https://same.example/', normalizedUrl: 'same.example' }));
    const result = await mergeSyncFile(fileOf([item('there', { url: 'https://same.example/', title: 'Newer', updatedAt: 99 })]));
    expect(result).toEqual({ added: 0, changed: 1 });
    expect(await db.bookmarks.count()).toBe(1);
    expect((await db.bookmarks.get('here'))?.title).toBe('Newer');
  });

  it('reports nothing changed when the file matches', async () => {
    await db.bookmarks.add(item('a'));
    expect(await mergeSyncFile(fileOf([item('a')]))).toEqual({ added: 0, changed: 0 });
  });

  it('takes the latest archive or un-archive of a tag, and keeps colours here', async () => {
    await db.tagMeta.bulkPut([
      { tag: 'old', colorSlot: 2, archiveChangedAt: 5 },
      { tag: 'back', archivedAt: 5, archiveChangedAt: 5 },
      { tag: 'kept', archivedAt: 50, archiveChangedAt: 50 },
    ]);
    await mergeSyncFile(
      fileOf([], [
        { tag: 'old', archivedAt: 10, archiveChangedAt: 10, lastUsedAt: 8 },
        { tag: 'back', archiveChangedAt: 20 },
        { tag: 'kept', archiveChangedAt: 20 },
        { tag: 'new', colorSlot: 4 },
      ]),
    );
    expect(await db.tagMeta.get('old')).toMatchObject({ archivedAt: 10, colorSlot: undefined, lastUsedAt: 8 });
    expect((await db.tagMeta.get('back'))?.archivedAt).toBeUndefined();
    expect((await db.tagMeta.get('kept'))?.archivedAt).toBe(50);
    expect((await db.tagMeta.get('new'))?.colorSlot).toBe(4);
  });
});

describe('the sync file', () => {
  it('leaves out what each browser reads for itself', async () => {
    await db.bookmarks.add(item('a', { description: 'from the page', linkStatus: 'ok', enrichedAt: 3, deletedAt: 9 }));
    const [saved] = (await buildSyncFile('me')).bookmarks;
    expect(saved).toMatchObject({ id: 'a', title: 'A', deletedAt: 9 });
    expect(saved).not.toHaveProperty('description');
    expect(saved).not.toHaveProperty('enrichedAt');
  });

  it('ignores files that are cut off, foreign, or from a newer version', () => {
    expect(parseSyncFile('{"format":"bookmark-manager-sync","deviceId":"x","bookm')).toBeUndefined();
    expect(parseSyncFile('{"format":"something-else","deviceId":"x","bookmarks":[]}')).toBeUndefined();
    expect(parseSyncFile('{"format":"bookmark-manager-sync","version":9,"deviceId":"x","bookmarks":[]}')).toBeUndefined();
  });
});

// An in-memory stand-in for a folder picked with showDirectoryPicker.
function fakeFolder(files = new Map<string, string>(), permission: PermissionState = 'granted') {
  const writes: string[] = [];
  const fileHandle = (name: string) => ({
    kind: 'file' as const,
    name,
    getFile: async () => new File([files.get(name) ?? ''], name),
    createWritable: async () => {
      let text = '';
      return {
        write: async (chunk: string) => void (text += chunk),
        close: async () => {
          files.set(name, text);
          writes.push(name);
        },
      };
    },
  });
  const inner = {
    values: async function* () {
      for (const name of files.keys()) yield fileHandle(name);
    },
    getFileHandle: async (name: string) => fileHandle(name),
  };
  const folder = {
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    getDirectoryHandle: async (name: string) => {
      expect(name).toBe(SYNC_FOLDER_NAME);
      return inner;
    },
  };
  return { folder, files, writes };
}

describe('syncNow', () => {
  it("merges the other browsers' files, then writes its own only when it changed", async () => {
    const other = JSON.stringify(fileOf([item('there')]));
    const { folder, files, writes } = fakeFolder(new Map([['other.json', other]]));
    useFolder(folder);
    await db.bookmarks.add(item('here'));

    const first = await syncNow();
    expect(first).toMatchObject({ status: 'synced', added: 1, devices: 1 });
    expect(JSON.parse(files.get('me.json')!).bookmarks.map((b: Bookmark) => b.id).sort()).toEqual(['here', 'there']);

    await syncNow();
    expect(writes).toEqual(['me.json']);
  });

  it('waits for a click when the browser wants permission again', async () => {
    const { folder } = fakeFolder(new Map(), 'prompt');
    useFolder(folder);
    expect(await syncNow()).toEqual({ status: 'needs-permission' });
  });

  it('does nothing when no folder is set', async () => {
    expect(await syncNow()).toEqual({ status: 'off' });
  });
});
