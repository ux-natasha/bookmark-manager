import { kindOf, type Bookmark } from './db';

// Catalogue codes for the Contact sheet theme: "LNK·014", "QTE·003".

export type SubKind = 'video' | 'post' | 'repo';
export type CodeKind = 'LNK' | 'VID' | 'PST' | 'REP' | 'QTE' | 'PIC' | 'NTE';

const VIDEO_PLATFORMS = new Set(['youtube', 'vimeo']);
const POST_PLATFORMS = new Set(['x', 'bluesky', 'threads', 'mastodon', 'linkedin', 'reddit']);
const REPO_PLATFORMS = new Set(['github', 'gitlab']);

// A link's sub-kind, from its platform. Everything else is a plain link.
export function subKind(b: Pick<Bookmark, 'kind' | 'platform'>): SubKind | undefined {
  if (kindOf(b) !== 'link' || !b.platform) return undefined;
  if (VIDEO_PLATFORMS.has(b.platform)) return 'video';
  if (POST_PLATFORMS.has(b.platform)) return 'post';
  if (REPO_PLATFORMS.has(b.platform)) return 'repo';
  return undefined;
}

export function codeKind(b: Pick<Bookmark, 'kind' | 'platform'>): CodeKind {
  switch (kindOf(b)) {
    case 'quote':
      return 'QTE';
    case 'image':
      return 'PIC';
    case 'note':
      return 'NTE';
  }
  return ({ video: 'VID', post: 'PST', repo: 'REP' } as const)[subKind(b)!] ?? 'LNK';
}

// sequence is the item's position in save order, oldest = 1. Padded to three digits, unpadded past 999.
export function itemCode(b: Pick<Bookmark, 'kind' | 'platform'>, sequence: number): string {
  return `${codeKind(b)}·${String(sequence).padStart(3, '0')}`;
}

// Each item's save-order number, oldest = 1. Computed, not stored, so deleting an item renumbers later ones.
export function saveSequence(bookmarks: Pick<Bookmark, 'id' | 'createdAt'>[]): Map<string, number> {
  const sorted = [...bookmarks].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return new Map(sorted.map((b, i) => [b.id, i + 1]));
}
