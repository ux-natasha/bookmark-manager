import { db, kindOf, type Bookmark, type PageText, type TagMeta } from './db';
import { cleanTags } from './bookmarks';
import { normalizeUrl } from './normalize';

const FORMAT = 'bookmark-manager-backup';
// 2 adds tagMeta, 3 adds the pages' saved words. Older files still restore.
const FORMAT_VERSION = 3;

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  bookmarks: Bookmark[];
  tagMeta?: TagMeta[];
  pageTexts?: PageText[];
}

export async function exportBackup(): Promise<void> {
  const bookmarks = (await db.bookmarks.toArray()).filter((b) => !b.deletedAt);
  const kept = new Set(bookmarks.map((b) => b.id));
  const file: BackupFile = {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    bookmarks,
    tagMeta: await db.tagMeta.toArray(),
    // The words of pages that may since have died are the one thing a refetch can't bring back.
    pageTexts: (await db.pageTexts.toArray()).filter((p) => kept.has(p.bookmarkId)),
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

  // Page text is filed under the id the item had in the backup, which changes when it merges into one here.
  const texts = new Map((Array.isArray(parsed.pageTexts) ? parsed.pageTexts : []).filter(validText).map((p) => [p.bookmarkId, p]));

  let added = 0;
  let merged = 0;
  await db.transaction('rw', db.bookmarks, db.tagMeta, db.pageTexts, async () => {
    if (Array.isArray(parsed.tagMeta)) await mergeTagMeta(parsed.tagMeta);
    const keepText = async (fromId: string | undefined, toId: string) => {
      const text = fromId ? texts.get(fromId) : undefined;
      if (text && !(await db.pageTexts.get(toId))) await db.pageTexts.put({ ...text, bookmarkId: toId });
      return !!text;
    };
    for (const incoming of incomingList) {
      // Only links need an address. Notes, and quotes and pictures saved from pages with none (local files), don't.
      if (!incoming.url && kindOf(incoming) === 'link') continue;
      const normalizedUrl = incoming.url ? normalizeUrl(incoming.url) : '';
      const sameId = incoming.id ? await db.bookmarks.get(incoming.id) : undefined;
      // Only links are matched by address: one page can have many saved pictures and quotes.
      const sameUrl = sameId || kindOf(incoming) !== 'link'
        ? undefined
        : (await db.bookmarks.where('normalizedUrl').equals(normalizedUrl).toArray()).find((b) => !b.deletedAt && kindOf(b) === 'link');
      const current = sameId ?? sameUrl;

      if (!current) {
        const id = incoming.id ?? crypto.randomUUID();
        const hasText = await keepText(incoming.id, id);
        await db.bookmarks.add({
          ...incoming,
          id,
          normalizedUrl,
          title: incoming.title || incoming.url || 'Untitled note',
          note: incoming.note ?? '',
          tags: cleanTags(incoming.tags ?? []),
          openCount: incoming.openCount ?? 0,
          createdAt: incoming.createdAt ?? Date.now(),
          updatedAt: incoming.updatedAt ?? Date.now(),
          source: incoming.source ?? 'backup',
          // Backups don't include previews or pictures, so links and pictures are fetched again.
          enrichedAt: kindOf(incoming) === 'link' || kindOf(incoming) === 'image' ? undefined : incoming.enrichedAt,
          // Without its words in the file, the page is read again.
          textSavedAt: hasText ? incoming.textSavedAt : undefined,
          deletedAt: undefined,
        });
        added++;
        continue;
      }

      const newer = (incoming.updatedAt ?? 0) > current.updatedAt ? incoming : current;
      const hasText = await keepText(incoming.id, current.id);
      await db.bookmarks.put({
        ...current,
        textSavedAt: current.textSavedAt ?? (hasText ? incoming.textSavedAt : undefined),
        title: newer.title || current.title,
        note: newer.note || current.note,
        text: newer.text || current.text,
        tags: cleanTags([...current.tags, ...(incoming.tags ?? [])]),
        color: current.color ?? incoming.color,
        openCount: Math.max(current.openCount, incoming.openCount ?? 0),
        lastOpenedAt: Math.max(current.lastOpenedAt ?? 0, incoming.lastOpenedAt ?? 0) || undefined,
        dustedAt: Math.max(current.dustedAt ?? 0, incoming.dustedAt ?? 0) || undefined,
        createdAt: Math.min(current.createdAt, incoming.createdAt ?? current.createdAt),
        updatedAt: Math.max(current.updatedAt, incoming.updatedAt ?? 0),
        // Something deleted here stays deleted: an older backup doesn't bring it back.
        deletedAt: current.deletedAt,
      });
      merged++;
    }
  });
  return { added, merged };
}

function validText(p: PageText): boolean {
  return typeof p?.bookmarkId === 'string' && typeof p.text === 'string' && !!p.text;
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
