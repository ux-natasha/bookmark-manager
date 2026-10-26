import { updateColor } from './colorPass';
import { db, kindOf, type Bookmark, type BookmarkSource, type ItemKind, type PreviewPreference } from './db';
import { normalizeUrl } from './normalize';
import { cleanTags } from './tagText';
import { markTagsUsed } from './tags';

export { cleanTags };

export interface NewBookmark {
  // Unset means a link.
  kind?: ItemKind;
  // Optional for notes.
  url: string;
  text?: string;
  imageUrl?: string;
  platform?: string;
  title?: string;
  source: BookmarkSource;
  tags?: string[];
  note?: string;
  importedFolder?: string[];
  foundInUrl?: string;
  foundInTitle?: string;
  createdAt?: number;
  // Counts as touched for ageing without counting as opened (db.ts). Imports use it to start fresh.
  dustedAt?: number;
}

export interface SaveResult {
  bookmark: Bookmark;
  // false when the page was already in the library, so nothing new was added.
  created: boolean;
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// The saved link for a page. Pictures and quotes from that page don't count.
export async function findByUrl(url: string): Promise<Bookmark | undefined> {
  const matches = await db.bookmarks.where('normalizedUrl').equals(normalizeUrl(url)).toArray();
  return matches.find((b) => !b.deletedAt && kindOf(b) === 'link');
}

// Pictures and quotes are duplicates when the same one is saved again; notes never are.
function isSameItem(b: Bookmark, input: NewBookmark, kind: ItemKind): boolean {
  if (kindOf(b) !== kind) return false;
  if (kind === 'image') return !!input.imageUrl && b.imageUrl === input.imageUrl;
  if (kind === 'quote') return b.text === input.text?.trim();
  return kind === 'link';
}

function firstLine(text: string | undefined): string {
  const line = text?.trim().split('\n')[0].trim() ?? '';
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

export async function saveBookmark(input: NewBookmark): Promise<SaveResult> {
  const kind = input.kind ?? 'link';
  const normalizedUrl = input.url ? normalizeUrl(input.url) : '';

  const result = await db.transaction('rw', db.bookmarks, async (): Promise<SaveResult> => {
    const matches =
      kind === 'note'
        ? []
        : (await db.bookmarks.where('normalizedUrl').equals(normalizedUrl).toArray()).filter((b) => isSameItem(b, input, kind));
    const live = matches.find((b) => !b.deletedAt);
    if (live) return { bookmark: live, created: false };

    const now = Date.now();
    const trashed = matches[0];
    if (trashed) {
      // Saving something that's in the trash brings it back, with its old tags and notes.
      const restored: Bookmark = {
        ...trashed,
        deletedAt: undefined,
        tags: cleanTags([...trashed.tags, ...(input.tags ?? [])]),
        updatedAt: now,
      };
      await db.bookmarks.put(restored);
      return { bookmark: restored, created: true };
    }

    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      // Saved only for the new kinds, so older records and backups stay as they were.
      ...(kind !== 'link' && { kind }),
      url: input.url,
      normalizedUrl,
      title: input.title?.trim() || input.url || firstLine(input.text) || 'Untitled note',
      text: input.text?.trim() || undefined,
      imageUrl: input.imageUrl,
      platform: input.platform,
      note: input.note ?? '',
      tags: cleanTags(input.tags ?? []),
      source: input.source,
      importedFolder: input.importedFolder,
      foundInUrl: input.foundInUrl,
      foundInTitle: input.foundInTitle,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
      openCount: 0,
      dustedAt: input.dustedAt,
    };
    await db.bookmarks.add(bookmark);
    return { bookmark, created: true };
  });
  // Tags given now count as used now, for the index's tidy-up.
  // Bookkeeping only: the item is saved either way.
  if (result.created && input.tags?.length) await markTagsUsed(cleanTags(input.tags), { revive: true }).catch(() => {});
  return result;
}

export async function updateBookmark(
  id: string,
  patch: Partial<Pick<Bookmark, 'title' | 'note' | 'tags' | 'text'>>,
): Promise<void> {
  const changes: Partial<Bookmark> = { ...patch, updatedAt: Date.now() };
  if (patch.tags) changes.tags = cleanTags(patch.tags);
  const before = patch.tags ? await db.bookmarks.get(id) : undefined;
  await db.bookmarks.update(id, changes);
  // Only tags that were added count as used; ones already there weren't touched.
  if (before && changes.tags) {
    await markTagsUsed(changes.tags.filter((t) => !before.tags.includes(t)), { revive: true }).catch(() => {});
  }
}

export async function deleteBookmark(id: string): Promise<void> {
  const now = Date.now();
  await db.bookmarks.update(id, { deletedAt: now, updatedAt: now });
}

export async function restoreBookmark(id: string): Promise<void> {
  await db.bookmarks.update(id, { deletedAt: undefined, updatedAt: Date.now() });
}

// Called whenever a bookmark is opened from the library, so "Refresh my memory" knows what's forgotten.
export async function markOpened(id: string): Promise<void> {
  const bookmark = await db.bookmarks.get(id);
  if (!bookmark) return;
  await db.bookmarks.update(id, { lastOpenedAt: Date.now(), openCount: bookmark.openCount + 1 });
}

// What dustedAt was before dusting off, so Undo can put it back (or clear it).
export interface DustSnapshot {
  id: string;
  dustedAt: number | undefined;
}

// Dusting off counts as touching an item without opening it: only dustedAt changes, so openCount and
// "Never opened" stay truthful. Every item goes in one transaction, so Undo never sees half of them.
export async function dustOff(ids: string[], now = Date.now()): Promise<DustSnapshot[]> {
  return db.transaction('rw', db.bookmarks, async () => {
    const found = (await db.bookmarks.bulkGet(ids)).filter((b): b is Bookmark => !!b);
    await Promise.all(found.map((b) => db.bookmarks.update(b.id, { dustedAt: now })));
    return found.map((b) => ({ id: b.id, dustedAt: b.dustedAt }));
  });
}

export async function undoDustOff(snapshot: DustSnapshot[]): Promise<void> {
  await db.transaction('rw', db.bookmarks, () =>
    Promise.all(snapshot.map(({ id, dustedAt }) => db.bookmarks.update(id, { dustedAt }))),
  );
}

export async function liveBookmarks(): Promise<Bookmark[]> {
  const all = await db.bookmarks.orderBy('createdAt').reverse().toArray();
  return all.filter((b) => !b.deletedAt);
}

export async function purgeOldTrash(): Promise<number> {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  return db.transaction('rw', db.bookmarks, db.previews, async () => {
    const ids = await db.bookmarks.where('deletedAt').below(cutoff).primaryKeys();
    await db.previews.where('bookmarkId').anyOf(ids).delete();
    return db.bookmarks.bulkDelete(ids).then(() => ids.length);
  });
}

export async function setPreviewPreference(id: string, preference: PreviewPreference | undefined): Promise<void> {
  await db.bookmarks.update(id, { previewPreference: preference, updatedAt: Date.now() });
  await updateColor(id);
}
