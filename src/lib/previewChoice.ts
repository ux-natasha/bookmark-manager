import type { Bookmark, Preview, PreviewKind } from './db';
import { platformById } from './platform';

export interface PreviewChoice {
  kind: PreviewKind;
  url: string;
}

// Which preview a card shows: your choice if you made one; otherwise the screenshot for social posts
// (their site image is usually just an avatar) and the site's own image for everything else.
export function pickPreview(bookmark: Bookmark, available: Preview[]): Preview | undefined {
  const byKind = (kind: PreviewKind) => available.find((p) => p.kind === kind);
  // "Cover" only means something in the Covers theme; everywhere else it's automatic.
  const choice = bookmark.previewPreference === 'cover' ? undefined : bookmark.previewPreference;
  const preferred: PreviewKind = choice ?? (platformById(bookmark.platform)?.social ? 'screenshot' : 'image');
  return byKind(preferred) ?? byKind(preferred === 'image' ? 'screenshot' : 'image');
}
