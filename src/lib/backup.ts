import { db, kindOf, type Bookmark, type TagMeta } from './db';
import { cleanTags } from './bookmarks';
import { normalizeUrl } from './normalize';

const FORMAT = 'bookmark-manager-backup';
// 2 adds tagMeta. Version 1 files still restore.
const FORMAT_VERSION = 2;

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  bookmarks: Bookmark[];
  tagMeta?: TagMeta[];
}

export async function exportBackup(): Promise<void> {
  const bookmarks = (await db.bookmarks.toArray()).filter((b) => !b.deletedAt);
  const file: BackupFile = {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks,
    tagMeta: await db.tagMeta.toArray(),
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
  await db.transaction('rw', db.bookmarks, db.tagMeta, async () => {
    if (Array.isArray(parsed.tagMeta)) await mergeTagMeta(parsed.tagMeta);
    for (const incoming of incomingList) {
      // Notes have no link; everything else does.
      if (!incoming.url && kindOf(incoming) !== 'note') continue;
      const normalizedUrl = incoming.url ? normalizeUrl(incoming.url) : '';
      const sameId = incoming.id ? await db.bookmarks.get(incoming.id) : undefined;
      // Only links are matched by address: one page can have many saved pictures and quotes.
      const sameUrl = sameId || kindOf(incoming) !== 'link'
        ? undefined
        : (await db.bookmarks.where('normalizedUrl').equals(normalizedUrl).toArray()).find((b) => !b.deletedAt && kindOf(b) === 'link');
      const current = sameId ?? sameUrl;

      if (!current) {
        await db.bookmarks.add({
          ...incoming,
          id: incoming.id ?? crypto.randomUUID(),
          normalizedUrl,
          title: incoming.title || incoming.url || 'Untitled note',
          note: incoming.note ?? '',
          tags: cleanTags(incoming.tags ?? []),
          openCount: incoming.openCount ?? 0,
          createdAt: incoming.createdAt ?? Date.now(),
          updatedAt: incoming.updatedAt ?? Date.now(),
          source: incoming.source ?? 'backup',
          // Backups don't include pictures, so saved pictures are downloaded again.
          enrichedAt: kindOf(incoming) === 'image' ? undefined : incoming.enrichedAt,
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
        text: newer.text || current.text,
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

// An un-archive on either side wins; the latest use wins; the local colour wins, so colours here don't shuffle.
async function mergeTagMeta(incomingList: TagMeta[]): Promise<void> {
  const valid = incomingList.filter((m) => typeof m?.tag === 'string' && m.tag);
  const current = await db.tagMeta.bulkGet(valid.map((m) => m.tag));
  await db.tagMeta.bulkPut(
    valid.map((incoming, i) => {
      const local = current[i];
      if (!local) return { tag: incoming.tag, lastUsedAt: incoming.lastUsedAt, archivedAt: incoming.archivedAt, colorSlot: incoming.colorSlot };
      return {
        tag: local.tag,
        colorSlot: local.colorSlot ?? incoming.colorSlot,
        lastUsedAt: Math.max(local.lastUsedAt ?? 0, incoming.lastUsedAt ?? 0) || undefined,
        archivedAt: local.archivedAt && incoming.archivedAt ? Math.min(local.archivedAt, incoming.archivedAt) : undefined,
      };
    }),
  );
}
