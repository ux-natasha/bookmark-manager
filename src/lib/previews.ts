import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, type Bookmark, type Preview, type PreviewKind } from './db';
import { pickPreview } from './previewChoice';
import { hostnameOf } from './normalize';

export { pickPreview, type PreviewChoice } from './previewChoice';

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
