import { db, kindOf } from './db';
import { saveBookmark } from './bookmarks';
import { isSaveableUrl, normalizeUrl } from './normalize';

export interface FavoriteItem {
  url: string;
  title: string;
  folder: string[];
  // Where it lives in Edge, including the built-in container, e.g. "Favorites bar / Design".
  location: string;
  dateAdded?: number;
  normalizedUrl: string;
}

export interface ImportPlan {
  // One entry per unique page that isn't in the library yet.
  toImport: FavoriteItem[];
  // Pages saved more than once in Edge favorites. Only the first copy of each is imported.
  duplicateGroups: FavoriteItem[][];
  alreadySaved: FavoriteItem[];
  // Things like javascript: bookmarklets, edge:// pages and local files.
  skipped: FavoriteItem[];
  total: number;
}

// Reads Edge/Chrome favorites. Read-only: nothing in the browser's own favorites is changed.
export async function readFavorites(): Promise<FavoriteItem[]> {
  const [root] = await chrome.bookmarks.getTree();
  const items: FavoriteItem[] = [];

  const walk = (node: chrome.bookmarks.BookmarkTreeNode, folder: string[], container: string) => {
    if (node.url) {
      items.push({
        url: node.url,
        title: node.title,
        folder,
        location: [container, ...folder].filter(Boolean).join(' / '),
        dateAdded: node.dateAdded,
        normalizedUrl: normalizeUrl(node.url),
      });
      return;
    }
    for (const child of node.children ?? []) {
      walk(child, child.url ? folder : [...folder, child.title], container);
    }
  };

  // The root's children are the built-in containers ("Favorites bar", "Other favorites"),
  // which aren't meaningful folders, so paths start below them.
  for (const container of root.children ?? []) walk(container, [], container.title);
  return items;
}

export async function planImport(items: FavoriteItem[]): Promise<ImportPlan> {
  const existing = await db.bookmarks.toArray();
  const savedKeys = new Set(existing.filter((b) => !b.deletedAt && kindOf(b) === 'link').map((b) => b.normalizedUrl));

  const groups = new Map<string, FavoriteItem[]>();
  const skipped: FavoriteItem[] = [];
  for (const item of items) {
    if (!isSaveableUrl(item.url)) {
      skipped.push(item);
      continue;
    }
    const group = groups.get(item.normalizedUrl);
    if (group) group.push(item);
    else groups.set(item.normalizedUrl, [item]);
  }

  const toImport: FavoriteItem[] = [];
  const alreadySaved: FavoriteItem[] = [];
  const duplicateGroups: FavoriteItem[][] = [];
  for (const [key, group] of groups) {
    if (group.length > 1) duplicateGroups.push(group);
    if (savedKeys.has(key)) alreadySaved.push(group[0]);
    else toImport.push(group[0]);
  }

  return { toImport, duplicateGroups, alreadySaved, skipped, total: items.length };
}

export function folderTags(folder: string[]): string[] {
  return folder.map((name) => name.trim()).filter(Boolean);
}

export async function runImport(
  plan: ImportPlan,
  options: { foldersAsTags: boolean },
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  let added = 0;
  // Imports start fresh and age from the day they arrive. Edge's date_added is kept as createdAt,
  // but would otherwise make a long-kept favourites list arrive fully faded.
  const importedAt = Date.now();
  const total = plan.toImport.length;
  for (const [i, item] of plan.toImport.entries()) {
    const { created } = await saveBookmark({
      url: item.url,
      title: item.title,
      source: 'import',
      importedFolder: item.folder,
      tags: options.foldersAsTags ? folderTags(item.folder) : [],
      createdAt: item.dateAdded,
      dustedAt: importedAt,
    });
    if (created) added++;
    if (i % 25 === 0 || i === total - 1) onProgress?.(i + 1, total);
  }
  return added;
}
