// Sync through a folder you already sync (Dropbox, iCloud Drive, Google Drive, OneDrive…): no account, no server.
// Each browser writes the whole library into its own file in that folder and reads the others' files. No file is ever
// written by two browsers, so the sync service never has two edits of one file to reconcile; the merging happens here.
// Pictures, previews and saved page text stay out of the files to keep them small; each browser fetches its own.

import { cleanTags } from './bookmarks';
import { db, kindOf, type Bookmark, type TagMeta } from './db';
import { normalizeUrl } from './normalize';

const FORMAT = 'bookmark-manager-sync';
const FORMAT_VERSION = 1;
// The folder made inside the one you pick, so the files don't mix with yours.
export const SYNC_FOLDER_NAME = 'Bookmark Manager sync';

export interface SyncFile {
  format: typeof FORMAT;
  version: number;
  deviceId: string;
  writtenAt: number;
  // Deleted items too, so a delete here reaches the other browsers.
  bookmarks: Bookmark[];
  tagMeta: TagMeta[];
}

// The fields a person changes. The side changed last wins them all; the rest (details read from the page, link checks)
// each browser works out for itself.
const EDITED_FIELDS = [
  'kind', 'url', 'normalizedUrl', 'title', 'note', 'text', 'tags', 'imageUrl', 'foundInUrl', 'foundInTitle',
  'importedFolder', 'previewPreference', 'deletedAt', 'updatedAt',
] as const satisfies readonly (keyof Bookmark)[];

export interface MergeResult {
  added: number;
  changed: number;
}

// Merges another browser's file into the library. Unlike restoring a backup, deletes and removed tags carry over:
// whichever side changed an item last is how it ends up.
export async function mergeSyncFile(file: SyncFile): Promise<MergeResult> {
  let added = 0;
  let changed = 0;
  await db.transaction('rw', db.bookmarks, db.tagMeta, async () => {
    await mergeTagMeta(file.tagMeta ?? []);
    for (const incoming of file.bookmarks) {
      if (!incoming?.id || (!incoming.url && kindOf(incoming) === 'link')) continue;
      const current = await findMatch(incoming);

      if (!current) {
        // Something deleted there that never reached here has nothing to delete.
        if (incoming.deletedAt) continue;
        await db.bookmarks.add({
          ...incoming,
          normalizedUrl: incoming.url ? normalizeUrl(incoming.url) : '',
          tags: cleanTags(incoming.tags ?? []),
          // Previews, pictures and page text aren't in the file, so this browser fetches its own.
          enrichedAt: kindOf(incoming) === 'link' || kindOf(incoming) === 'image' ? undefined : incoming.enrichedAt,
          textSavedAt: undefined,
        });
        added++;
        continue;
      }

      const next: Bookmark = { ...current };
      if (incoming.updatedAt > current.updatedAt) {
        for (const field of EDITED_FIELDS) (next as unknown as Record<string, unknown>)[field] = incoming[field];
        next.tags = cleanTags(next.tags ?? []);
        next.normalizedUrl = next.url ? normalizeUrl(next.url) : '';
        // A new address is a new page to read.
        if (next.url !== current.url) next.enrichedAt = next.textSavedAt = undefined;
      }
      // Use adds up across browsers.
      next.openCount = Math.max(current.openCount, incoming.openCount ?? 0);
      next.lastOpenedAt = Math.max(current.lastOpenedAt ?? 0, incoming.lastOpenedAt ?? 0) || undefined;
      next.dustedAt = Math.max(current.dustedAt ?? 0, incoming.dustedAt ?? 0) || undefined;
      next.createdAt = Math.min(current.createdAt, incoming.createdAt ?? current.createdAt);
      if (!sameRecord(next, current)) {
        await db.bookmarks.put(next);
        changed++;
      }
    }
  });
  return { added, changed };
}

// The same item, by id once it has synced before; before that, a link saved in both browsers is one item.
async function findMatch(incoming: Bookmark): Promise<Bookmark | undefined> {
  const sameId = await db.bookmarks.get(incoming.id);
  if (sameId || kindOf(incoming) !== 'link') return sameId;
  const matches = await db.bookmarks.where('normalizedUrl').equals(normalizeUrl(incoming.url)).toArray();
  return matches.find((b) => !b.deletedAt && kindOf(b) === 'link');
}

function sameRecord(a: Bookmark, b: Bookmark): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Bookmark>;
  return [...keys].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
}

const TAG_FIELDS = ['colorSlot', 'lastUsedAt', 'archivedAt', 'archiveChangedAt'] as const;

// The latest archive or un-archive wins, the latest use wins, and colours stay as they are here.
async function mergeTagMeta(incomingList: TagMeta[]): Promise<void> {
  const valid = incomingList.filter((m) => typeof m?.tag === 'string' && m.tag);
  const current = await db.tagMeta.bulkGet(valid.map((m) => m.tag));
  const updates: TagMeta[] = [];
  valid.forEach((incoming, i) => {
    const local = current[i];
    const theirs = (incoming.archiveChangedAt ?? 0) > (local?.archiveChangedAt ?? 0);
    const next: TagMeta = {
      tag: incoming.tag,
      colorSlot: local ? local.colorSlot : incoming.colorSlot,
      lastUsedAt: Math.max(local?.lastUsedAt ?? 0, incoming.lastUsedAt ?? 0) || undefined,
      archivedAt: theirs ? incoming.archivedAt : local?.archivedAt,
      archiveChangedAt: theirs ? incoming.archiveChangedAt : local?.archiveChangedAt,
    };
    if (theirs && next.archivedAt) next.colorSlot = undefined;
    const same = local && TAG_FIELDS.every((k) => local[k] === next[k]);
    if (!same) updates.push(next);
  });
  if (updates.length) await db.tagMeta.bulkPut(updates);
}

// What goes in the file: what people change and how they use things. Details read from pages are left out, so
// background link checks don't rewrite the file (and set the sync service uploading) every few minutes.
const SYNCED_FIELDS = [...EDITED_FIELDS, 'id', 'source', 'createdAt', 'openCount', 'lastOpenedAt', 'dustedAt'] as const;

export async function buildSyncFile(deviceId: string, now = Date.now()): Promise<SyncFile> {
  const bookmarks = (await db.bookmarks.toArray()).map(
    (b) => Object.fromEntries(SYNCED_FIELDS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])) as unknown as Bookmark,
  );
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    deviceId,
    writtenAt: now,
    bookmarks,
    tagMeta: await db.tagMeta.toArray(),
  };
}

export function parseSyncFile(text: string): SyncFile | undefined {
  try {
    const parsed = JSON.parse(text) as Partial<SyncFile>;
    if (parsed.format !== FORMAT || typeof parsed.deviceId !== 'string' || !Array.isArray(parsed.bookmarks)) return undefined;
    // A file from a newer version may mean things this one doesn't know about; leave it for that version.
    if ((parsed.version ?? 0) > FORMAT_VERSION) return undefined;
    return { ...parsed, tagMeta: Array.isArray(parsed.tagMeta) ? parsed.tagMeta : [] } as SyncFile;
  } catch {
    // A file the sync service is still writing reads as cut off; it's read again next time.
    return undefined;
  }
}

// ---- The folder itself (File System Access, so Chrome and Edge only, and only in the library page) ----

interface PermissionHandle {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
}
type DirectoryHandle = FileSystemDirectoryHandle & PermissionHandle & { values(): AsyncIterable<FileSystemHandle> };

export interface SyncSetup {
  key: 'sync';
  folder: DirectoryHandle;
  deviceId: string;
  lastSyncedAt?: number;
}

export function syncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getSyncSetup(): Promise<SyncSetup | undefined> {
  return (await db.settings.get('sync')) as SyncSetup | undefined;
}

// Asks for the folder (a click must lead here). The browser keeps the same id across folder changes.
export async function chooseSyncFolder(): Promise<void> {
  const pick = (window as unknown as { showDirectoryPicker(o: object): Promise<DirectoryHandle> }).showDirectoryPicker;
  const folder = await pick.call(window, { id: 'bookmark-manager-sync', mode: 'readwrite' });
  const existing = await getSyncSetup();
  await db.settings.put({ key: 'sync', folder, deviceId: existing?.deviceId ?? crypto.randomUUID() } satisfies SyncSetup);
}

// Leaves the files in the folder as they are; the other browsers keep syncing with each other.
export async function stopSync(): Promise<void> {
  await db.settings.delete('sync');
}

export type SyncOutcome =
  | { status: 'off' }
  // The browser wants a click before it lets the library use the folder again (after a restart, usually).
  | { status: 'needs-permission' }
  | { status: 'synced'; at: number; added: number; changed: number; devices: number }
  | { status: 'failed'; message: string };

let running: Promise<SyncOutcome> | null = null;

// Safe to call any time; a sync already going is joined rather than doubled. `ask` may show the browser's
// permission prompt, so it's only set when a click led here.
export function syncNow({ ask = false } = {}): Promise<SyncOutcome> {
  if (!running) running = run(ask).finally(() => (running = null));
  return running;
}

async function run(ask: boolean): Promise<SyncOutcome> {
  const setup = await getSyncSetup();
  if (!setup) return { status: 'off' };
  try {
    let permission = await setup.folder.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted' && ask) permission = await setup.folder.requestPermission({ mode: 'readwrite' });
    if (permission !== 'granted') return { status: 'needs-permission' };

    const dir = (await setup.folder.getDirectoryHandle(SYNC_FOLDER_NAME, { create: true })) as DirectoryHandle;
    const ownName = `${setup.deviceId}.json`;
    let added = 0;
    let changed = 0;
    let devices = 0;
    for await (const entry of dir.values()) {
      if (entry.kind !== 'file' || entry.name === ownName || !entry.name.endsWith('.json')) continue;
      const file = parseSyncFile(await (await (entry as FileSystemFileHandle).getFile()).text());
      if (!file || file.deviceId === setup.deviceId) continue;
      const result = await mergeSyncFile(file);
      added += result.added;
      changed += result.changed;
      devices++;
    }

    const at = Date.now();
    const own = await dir.getFileHandle(ownName, { create: true });
    const file = await buildSyncFile(setup.deviceId, at);
    const written = parseSyncFile(await (await own.getFile()).text());
    // Rewritten only when something in it changed.
    if (!written || JSON.stringify({ ...written, writtenAt: at }) !== JSON.stringify(file)) {
      const writable = await own.createWritable();
      await writable.write(JSON.stringify(file));
      await writable.close();
    }
    await db.settings.update('sync', { lastSyncedAt: at });
    return { status: 'synced', at, added, changed, devices };
  } catch (err) {
    // The folder was moved or deleted, or the disk is full.
    return { status: 'failed', message: err instanceof Error ? err.message : String(err) };
  }
}
