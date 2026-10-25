import { db, type Bookmark } from './db';
import { cleanTags } from './bookmarks';
import { normalizeUrl } from './normalize';

const FORMAT = 'bookmark-manager-backup';
const FORMAT_VERSION = 1;

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  bookmarks: Bookmark[];
}

export async function exportBackup(): Promise<void> {
  const bookmarks = (await db.bookmarks.toArray()).filter((b) => !b.deletedAt);
  const file: BackupFile = {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `bookmarks-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export interface RestoreResult {
  added: number;
  merged: number;
}

// Merges a backup into the library: nothing already here is deleted or overwritten with older data.
export async function restoreBackup(file: File): Promise<RestoreResult> {
  const parsed = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (parsed.format !== FORMAT || !Array.isArray(parsed.bookmarks)) {
    throw new Error("This file isn't a Bookmark Manager backup.");
  }
  const incomingList = parsed.bookmarks;

  let added = 0;
  let merged = 0;
  await db.transaction('rw', db.bookmarks, async () => {
    for (const incoming of incomingList) {
      if (!incoming.url) continue;
      const normalizedUrl = normalizeUrl(incoming.url);
      const sameId = incoming.id ? await db.bookmarks.get(incoming.id) : undefined;
      const sameUrl = sameId
        ? undefined
        : (await db.bookmarks.where('normalizedUrl').equals(normalizedUrl).toArray()).find((b) => !b.deletedAt);
      const current = sameId ?? sameUrl;

      if (!current) {
        await db.bookmarks.add({
          ...incoming,
          id: incoming.id ?? crypto.randomUUID(),
          normalizedUrl,
          title: incoming.title || incoming.url,
          note: incoming.note ?? '',
          tags: cleanTags(incoming.tags ?? []),
          openCount: incoming.openCount ?? 0,
          createdAt: incoming.createdAt ?? Date.now(),
          updatedAt: incoming.updatedAt ?? Date.now(),
          source: incoming.source ?? 'backup',
          deletedAt: undefined,
        });
        added++;
        continue;
      }

      const newer = (incoming.updatedAt ?? 0) > current.updatedAt ? incoming : current;
      await db.bookmarks.put({
        ...current,
        title: newer.title || current.title,
        note: newer.note || current.note,
        tags: cleanTags([...current.tags, ...(incoming.tags ?? [])]),
        openCount: Math.max(current.openCount, incoming.openCount ?? 0),
        lastOpenedAt: Math.max(current.lastOpenedAt ?? 0, incoming.lastOpenedAt ?? 0) || undefined,
        createdAt: Math.min(current.createdAt, incoming.createdAt ?? current.createdAt),
        updatedAt: Math.max(current.updatedAt, incoming.updatedAt ?? 0),
        deletedAt: undefined,
      });
      merged++;
    }
  });
  return { added, merged };
}
