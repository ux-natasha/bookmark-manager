import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { liveBookmarks } from './bookmarks';
import type { Bookmark } from './db';
import { getEnrichProgress, onEnrichProgress, type EnrichProgress } from './messages';

// All non-deleted bookmarks, newest first. Re-renders automatically when anything changes,
// including saves made by the background script or another open tab.
export function useBookmarks(): Bookmark[] | undefined {
  return useLiveQuery(liveBookmarks, []);
}

export interface TagCount {
  tag: string;
  count: number;
}

export function useTagCounts(bookmarks: Bookmark[] | undefined): TagCount[] {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bookmarks ?? []) for (const t of b.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [bookmarks]);
}

export function useEnrichProgress(): EnrichProgress | undefined {
  const [progress, setProgress] = useState<EnrichProgress>();
  useEffect(() => {
    getEnrichProgress().then(setProgress);
    return onEnrichProgress(setProgress);
  }, []);
  return progress;
}

export interface Toast {
  message: string;
  // A small dot glowing in this colour before the message (Colour field: the item that came back).
  dot?: string;
  action?: { label: string; run: () => void };
}

export function useToast(durationMs = 5000) {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);
  return { toast, showToast: setToast, hideToast: () => setToast(null) };
}

export { formatDate } from './formatDate';
