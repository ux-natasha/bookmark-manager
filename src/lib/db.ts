import Dexie, { type EntityTable } from 'dexie';
import { cleanTags } from './tagText';

// How a bookmark got into the library. Useful later for filters ("everything I imported").
export type BookmarkSource = 'panel' | 'context-menu' | 'import' | 'backup' | 'post' | 'library';

// ok: page loaded. gone: the site says it doesn't exist (404/410).
// unreachable: the site didn't answer at all (dead domain, or you were offline).
// restricted: the site refused us (login wall, bot protection, server error), so we can't tell.
export type LinkStatus = 'ok' | 'gone' | 'unreachable' | 'restricted';

export type PreviewKind = 'screenshot' | 'image';

// What a link shows: one of its previews, or (in the Covers theme) a cover typeset from its details.
export type PreviewPreference = PreviewKind | 'cover';

// What was saved. Records from before pictures, quotes and notes have no kind, and are links.
export type ItemKind = 'link' | 'image' | 'quote' | 'note';

export interface Bookmark {
  id: string;
  kind?: ItemKind;
  // The page itself for links; the page a picture or quote came from. Empty for notes.
  url: string;
  // Comparison key from normalizeUrl(); indexed so duplicate checks are instant.
  normalizedUrl: string;
  title: string;
  note: string;
  tags: string[];
  source: BookmarkSource;
  // Folder path in Edge favorites, kept so imported structure isn't lost.
  importedFolder?: string[];
  // The social post (or page) this link was found in, when it came from "Add from a post".
  foundInUrl?: string;
  foundInTitle?: string;
  // The words of a quote or note.
  text?: string;
  // The picture's own address, so it can be downloaded again after restoring a backup.
  imageUrl?: string;

  // Details read from the page itself. Filled in automatically in the background.
  description?: string;
  siteName?: string;
  platform?: string;
  author?: string;
  publishedAt?: number;
  themeColor?: string;
  // Extra details some covers use, read where they're cheap to get. Every template works without them.
  details?: BookmarkDetails;
  enrichedAt?: number;

  linkStatus?: LinkStatus;
  lastCheckedAt?: number;
  // Consecutive failed checks. One failure could be a blip, so "unreachable" only counts as dead after two.
  checkFailures?: number;

  // Which preview to show when both a screenshot and the site's own image exist. Unset = automatic.
  previewPreference?: PreviewPreference;

  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  openCount: number;

  // Soft delete: kept for undo now, and so a future sync can tell "deleted" from "never existed".
  deletedAt?: number;
}

export interface BookmarkDetails {
  // Video length in seconds.
  duration?: number;
  // From schema.org Recipe data. Present, even if empty, when the page is a recipe.
  recipe?: { totalTime?: string; yield?: string };
  language?: string[];
  // Position in a thread of posts.
  thread?: { index: number; count: number };
}

// What the library remembers about a tag beyond the items carrying it (docs/design/library-interactions.md, 5.3).
export interface TagMeta {
  // The full tag, including any parent ("recipes/weeknight").
  tag: string;
  // 1–8, top-level tags only. Stable once given, so colours never shuffle.
  colorSlot?: number;
  // Set when the tag is added to something or picked as a filter.
  lastUsedAt?: number;
  // Set by tidy-up. Archived tags stay on items but leave the index.
  archivedAt?: number;
}

// Preview images live in their own table so loading the bookmark list stays fast.
export interface Preview {
  bookmarkId: string;
  kind: PreviewKind;
  blob: Blob;
  createdAt: number;
}

export const db = new Dexie('bookmark-manager') as Dexie & {
  bookmarks: EntityTable<Bookmark, 'id'>;
  previews: Dexie.Table<Preview, [string, PreviewKind]>;
  tagMeta: EntityTable<TagMeta, 'tag'>;
};

db.version(1).stores({
  // Primary key first, then indexes. *tags = one index entry per tag.
  bookmarks: 'id, normalizedUrl, *tags, createdAt, updatedAt, lastOpenedAt, deletedAt',
});

db.version(2).stores({
  bookmarks: 'id, normalizedUrl, *tags, createdAt, updatedAt, lastOpenedAt, deletedAt, platform',
  previews: '[bookmarkId+kind], bookmarkId',
});

db.version(3).stores({
  bookmarks: 'id, normalizedUrl, *tags, createdAt, updatedAt, lastOpenedAt, deletedAt, platform',
  previews: '[bookmarkId+kind], bookmarkId',
  tagMeta: 'tag, archivedAt',
});

// Tags saved before nested tags were tidied ("recipes / weeknight") would otherwise index as a parent of their own.
// A separate version, so libraries already on version 3 get it too.
db.version(4)
  .stores({})
  .upgrade((tx) =>
    tx
      .table<Bookmark>('bookmarks')
      .toCollection()
      .modify((b) => {
        const tags = cleanTags(b.tags ?? []);
        if (tags.length !== b.tags?.length || tags.some((t, i) => t !== b.tags[i])) b.tags = tags;
      }),
  );

export function kindOf(b: Pick<Bookmark, 'kind'>): ItemKind {
  return b.kind ?? 'link';
}

export function isDeadLink(b: Bookmark): boolean {
  return b.linkStatus === 'gone' || (b.linkStatus === 'unreachable' && (b.checkFailures ?? 0) >= 2);
}
