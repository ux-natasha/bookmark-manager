import { db, type Bookmark, type BookmarkSource, type PreviewKind } from './db';
import { normalizeUrl } from './normalize';

export interface NewBookmark {
  url: string;
  title?: string;
  source: BookmarkSource;
  tags?: string[];
  note?: string;
  importedFolder?: string[];
  foundInUrl?: string;
  foundInTitle?: string;
  createdAt?: number;
}

export interface SaveResult {
  bookmark: Bookmark;
  // false when the page was already in the library, so nothing new was added.
  created: boolean;
}

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

export async function findByUrl(url: string): Promise<Bookmark | undefined> {
  const matches = await db.bookmarks.where('normalizedUrl').equals(normalizeUrl(url)).toArray();
  return matches.find((b) => !b.deletedAt);
}

export async function saveBookmark(input: NewBookmark): Promise<SaveResult> {
  const normalizedUrl = normalizeUrl(input.url);

  return db.transaction('rw', db.bookmarks, async () => {
    const matches = await db.bookmarks.where('normalizedUrl').equals(normalizedUrl).toArray();
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
      url: input.url,
      normalizedUrl,
      title: input.title?.trim() || input.url,
      note: input.note ?? '',
      tags: cleanTags(input.tags ?? []),
      source: input.source,
      importedFolder: input.importedFolder,
      foundInUrl: input.foundInUrl,
      foundInTitle: input.foundInTitle,
      createdAt: input.createdAt ?? now,
      updatedAt: now,
      openCount: 0,
    };
    await db.bookmarks.add(bookmark);
    return { bookmark, created: true };
  });
}

export async function updateBookmark(
  id: string,
  patch: Partial<Pick<Bookmark, 'title' | 'note' | 'tags'>>,
): Promise<void> {
  const changes: Partial<Bookmark> = { ...patch, updatedAt: Date.now() };
  if (patch.tags) changes.tags = cleanTags(patch.tags);
  await db.bookmarks.update(id, changes);
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

export async function setPreviewPreference(id: string, preference: PreviewKind | undefined): Promise<void> {
  await db.bookmarks.update(id, { previewPreference: preference, updatedAt: Date.now() });
}
