// Reads an item's colour from the preview its card shows (docs/design/theme-colour-field.md, 3).
// Runs when a preview is stored, and as a slow pass over items saved before colours existed.

import { dominantColor } from './color';
import { db } from './db';
import { pickPreview } from './previewChoice';

const SIZE = 16;

export async function colorOfImage(blob: Blob): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(blob, { resizeWidth: SIZE, resizeHeight: SIZE, resizeQuality: 'medium' });
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return dominantColor(context.getImageData(0, 0, SIZE, SIZE).data);
  } catch {
    // SVGs and broken images can't be drawn here. The theme falls back to the site's colour.
    return undefined;
  }
}

// Stores '' when there's a preview but no colour could be read, so the pass doesn't try it again.
export async function updateColor(bookmarkId: string): Promise<void> {
  const bookmark = await db.bookmarks.get(bookmarkId);
  if (!bookmark) return;
  const preview = pickPreview(bookmark, await db.previews.where('bookmarkId').equals(bookmarkId).toArray());
  if (!preview) return;
  const color = (await colorOfImage(preview.blob)) ?? '';
  // Not an edit, so updatedAt stays as it is.
  if (color !== bookmark.color) await db.bookmarks.update(bookmarkId, { color });
}

let filling: Promise<void> | null = null;

// Items with a preview and no colour yet, one at a time so the page stays responsive.
export function fillMissingColors(): Promise<void> {
  filling ??= (async () => {
    const withPreview = new Set((await db.previews.orderBy('bookmarkId').uniqueKeys()) as string[]);
    const missing = await db.bookmarks.filter((b) => b.color === undefined && !b.deletedAt && withPreview.has(b.id)).primaryKeys();
    for (const id of missing) await updateColor(id);
  })().finally(() => {
    filling = null;
  });
  return filling;
}
