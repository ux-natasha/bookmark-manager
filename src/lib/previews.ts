import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, type Bookmark, type Preview, type PreviewKind } from './db';
import { hostnameOf } from './normalize';
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

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

export function usePreviews(bookmarkId: string): Preview[] | undefined {
  return useLiveQuery(() => db.previews.where('bookmarkId').equals(bookmarkId).toArray(), [bookmarkId]);
}

// The image URL to show on a bookmark's card, or undefined to show the designed fallback.
export function usePreviewUrl(bookmark: Bookmark): string | undefined {
  const previews = usePreviews(bookmark.id);
  return useObjectUrl(previews ? pickPreview(bookmark, previews)?.blob : undefined);
}

// No kind: nothing to show (and no object URL made).
export function usePreviewUrlOfKind(previews: Preview[] | undefined, kind: PreviewKind | undefined): string | undefined {
  return useObjectUrl(previews?.find((p) => p.kind === kind)?.blob);
}

// A stable, pleasant color per site for cards without a preview (until the design pass replaces it).
export function fallbackColor(bookmark: Bookmark): string {
  if (bookmark.themeColor && /^#[0-9a-f]{3,8}$|^rgb/i.test(bookmark.themeColor)) return bookmark.themeColor;
  let hash = 0;
  for (const ch of hostnameOf(bookmark.url)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 45% 55%)`;
}
