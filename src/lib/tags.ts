import { lastTouched, monthsSince } from './age';
import { db, type Bookmark, type TagMeta } from './db';

// Tags as the index at the back of a book (docs/design/library-interactions.md, 5.3, 5.4, 6.5–6.7).
// Everything here but the last few writes is pure, so the index can be memoised and tested.

export const COLOR_SLOTS = 8;
export const MOST_USED = 6;
// Tags used this recently never fade.
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const FADE_MONTHS = 18;
// Past this fade a tag's colour square turns hollow.
export const HOLLOW_FADE = 0.4;

export type TidyThreshold = 0 | 3 | 6 | 12;

// Nested tags by convention: filtering by "recipes" includes "recipes/weeknight", but not "recipes-old".
export function hasTag(b: Pick<Bookmark, 'tags'>, tag: string): boolean {
  return b.tags.some((t) => t === tag || t.startsWith(tag + '/'));
}

export function topLevelOf(tag: string): string {
  return tag.split('/')[0];
}

// How a tag reads: dashes as spaces. `leaf` drops the parents ("weeknight").
export function tagName(tag: string, leaf = false): string {
  return (leaf ? tag.split('/').pop()! : tag).replace(/-/g, ' ');
}

export interface TagStat {
  // Items carrying exactly this tag.
  own: number;
  // Distinct items carrying this tag or anything under it.
  all: number;
  // The latest lastTouched() of those items.
  lastTouched: number;
}

// One entry per tag in use, plus every parent implied by a nested tag.
export function tagStats(bookmarks: Bookmark[]): Map<string, TagStat> {
  const stats = new Map<string, TagStat>();
  const stat = (tag: string) => {
    let s = stats.get(tag);
    if (!s) stats.set(tag, (s = { own: 0, all: 0, lastTouched: 0 }));
    return s;
  };
  for (const b of bookmarks) {
    const touched = lastTouched(b);
    const prefixes = new Set<string>();
    for (const tag of b.tags) {
      stat(tag).own++;
      const parts = tag.split('/');
      for (let i = 1; i <= parts.length; i++) prefixes.add(parts.slice(0, i).join('/'));
    }
    for (const p of prefixes) {
      const s = stat(p);
      s.all++;
      s.lastTouched = Math.max(s.lastTouched, touched);
    }
  }
  return stats;
}

export interface IndexEntry {
  tag: string;
  // Sub-entries show the path under the top level, joined with " / ".
  name: string;
  count: number;
  monthsUnused: number;
  // 0 fresh … 1 unused for 18 months. Selected tags never fade.
  fade: number;
  stale: boolean;
  slot?: number;
  selected: boolean;
  children: IndexEntry[];
}

export interface IndexGroup {
  // "A", "#", or a non-Latin letter.
  letter: string;
  id: string;
  entries: IndexEntry[];
  // Tags used once with nothing under them, run together on one line.
  once: IndexEntry[];
  tagCount: number;
  staleCount: number;
}

export interface TagIndex {
  groups: IndexGroup[];
  // A–Z always, with '#' before and other scripts after when they have tags.
  letters: { letter: string; id: string; present: boolean }[];
  mostUsed: IndexEntry[];
  // Tags in use and not archived.
  liveCount: number;
  // Tags tidy-up would archive now.
  stale: string[];
  // Archived tags still on something, so they can be brought back.
  archived: string[];
}

export interface IndexInput {
  stats: Map<string, TagStat>;
  meta: TagMeta[];
  selected: string[];
  query: string;
  now: number;
  threshold: TidyThreshold;
}

export function tagLastUsed(tag: string, stats: Map<string, TagStat>, meta: Map<string, TagMeta>): number {
  return Math.max(stats.get(tag)?.lastTouched ?? 0, meta.get(tag)?.lastUsedAt ?? 0);
}

// What a stale check needs to know. A tag's own use includes everything under it, so a parent never goes
// stale while one of its children is in use.
export function isStale(monthsUnused: number, threshold: TidyThreshold, selected: boolean): boolean {
  return threshold > 0 && !selected && monthsUnused >= threshold;
}

// Live tags: in use and not archived.
function liveTags(stats: Map<string, TagStat>, metaByTag: Map<string, TagMeta>): string[] {
  return [...stats].filter(([tag, s]) => s.own > 0 && !metaByTag.get(tag)?.archivedAt).map(([tag]) => tag);
}

// Top-level index entries and their live children. A parent shows when it's live itself or has a live child.
function liveTree(live: string[]): Map<string, string[]> {
  const tree = new Map<string, string[]>();
  for (const tag of live) {
    const top = topLevelOf(tag);
    if (!tree.has(top)) tree.set(top, []);
    if (tag !== top) tree.get(top)!.push(tag);
  }
  return tree;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function matches(tag: string, query: string): boolean {
  return tag.includes(query) || tag.replace(/-/g, ' ').includes(query);
}

// Accented Latin letters file under their base letter ("école" under E); other scripts keep their own.
function groupLetter(tag: string): string {
  const first = [...tag][0]?.toLocaleUpperCase() ?? '#';
  const base = first.normalize('NFD').replace(/\p{M}/gu, '');
  if (ALPHABET.includes(base)) return base;
  return /\p{L}/u.test(first) ? first : '#';
}

function letterOrder(a: string, b: string): number {
  const rank = (l: string) => (l === '#' ? 0 : ALPHABET.includes(l) ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
}

function letterId(letter: string): string {
  return letter === '#' ? 'num' : letter.toLowerCase();
}

export function buildTagIndex({ stats, meta, selected, query, now, threshold }: IndexInput): TagIndex {
  const metaByTag = new Map(meta.map((m) => [m.tag, m]));
  const live = liveTags(stats, metaByTag);
  const tree = liveTree(live);
  const q = query.trim().toLowerCase();
  const liveSet = new Set(live);

  const entry = (tag: string, name: string, count: number, children: IndexEntry[] = []): IndexEntry => {
    const lastUsed = tagLastUsed(tag, stats, metaByTag);
    const monthsUnused = monthsSince(lastUsed, now);
    const isSelected = selected.includes(tag);
    const fade = isSelected || now - lastUsed < FRESH_MS ? 0 : Math.min(1, monthsUnused / FADE_MONTHS);
    return {
      tag,
      name,
      count,
      monthsUnused,
      fade,
      // An implied parent (or an archived one with live children) has nothing of its own to archive.
      stale: liveSet.has(tag) && isStale(monthsUnused, threshold, isSelected),
      slot: tag.includes('/') ? undefined : metaByTag.get(tag)?.colorSlot,
      selected: isSelected,
      children,
    };
  };

  const byName = (a: IndexEntry, b: IndexEntry) => a.name.localeCompare(b.name);
  const tops = [...tree].map(([top, kids]) =>
    entry(
      top,
      tagName(top),
      stats.get(top)?.all ?? 0,
      kids.map((k) => entry(k, tagName(k.slice(top.length + 1)).replace(/\//g, ' / '), stats.get(k)?.own ?? 0)).sort(byName),
    ),
  );

  const stale = tops.flatMap((t) => [t, ...t.children]).filter((e) => e.stale).map((e) => e.tag);

  const groupMap = new Map<string, IndexGroup>();
  for (const top of tops) {
    const topHit = !q || matches(top.tag, q);
    const children = topHit ? top.children : top.children.filter((c) => matches(c.tag, q));
    if (!topHit && !children.length) continue;
    const shown = { ...top, children };
    const letter = groupLetter(top.tag);
    let group = groupMap.get(letter);
    if (!group) groupMap.set(letter, (group = { letter, id: letterId(letter), entries: [], once: [], tagCount: 0, staleCount: 0 }));
    // Used once, with nothing under it: it runs in.
    if (top.count === 1 && !top.children.length) group.once.push(shown);
    else group.entries.push(shown);
    const counted = [shown, ...children].filter((e) => liveSet.has(e.tag));
    group.tagCount += counted.length;
    group.staleCount += counted.filter((e) => e.stale).length;
  }
  const groups = [...groupMap.values()].sort((a, b) => letterOrder(a.letter, b.letter));
  for (const g of groups) {
    g.entries.sort(byName);
    g.once.sort(byName);
  }

  const present = new Set(groups.map((g) => g.letter));
  const letters = [...(present.has('#') ? ['#'] : []), ...ALPHABET, ...[...present].filter((l) => l !== '#' && !ALPHABET.includes(l)).sort()];

  return {
    groups,
    letters: letters.map((letter) => ({ letter, id: letterId(letter), present: present.has(letter) })),
    mostUsed: [...tops].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, MOST_USED),
    liveCount: live.length,
    stale,
    archived: [...stats]
      .filter(([tag, s]) => s.own > 0 && metaByTag.get(tag)?.archivedAt)
      .map(([tag]) => tag)
      .sort((a, b) => a.localeCompare(b)),
  };
}

// Colour slots go to the eight most-used top-level tags, and a tag keeps its slot once given.
// Returns only the records that change. A slot is freed when its tag is archived or no longer on anything.
export function assignColorSlots(stats: Map<string, TagStat>, meta: TagMeta[]): TagMeta[] {
  const metaByTag = new Map(meta.map((m) => [m.tag, m]));
  const tops = [...liveTree(liveTags(stats, metaByTag)).keys()]
    .map((tag) => ({ tag, count: stats.get(tag)?.all ?? 0 }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  const liveTops = new Set(tops.map((t) => t.tag));

  const changes = new Map<string, TagMeta>();
  const taken = new Set<number>();
  // Most-used first, so if two tags somehow share a slot (an undone archive), the busier one keeps it.
  const holders = meta
    .filter((m) => m.colorSlot !== undefined)
    .sort((a, b) => (stats.get(b.tag)?.all ?? 0) - (stats.get(a.tag)?.all ?? 0));
  for (const m of holders) {
    if (liveTops.has(m.tag) && !taken.has(m.colorSlot!)) taken.add(m.colorSlot!);
    else changes.set(m.tag, { ...m, colorSlot: undefined });
  }

  const free = Array.from({ length: COLOR_SLOTS }, (_, i) => i + 1).filter((s) => !taken.has(s));
  for (const { tag } of tops) {
    if (!free.length) break;
    const current = changes.get(tag) ?? metaByTag.get(tag);
    if (current?.colorSlot !== undefined) continue;
    changes.set(tag, { ...(current ?? { tag }), colorSlot: free.shift() });
  }
  return [...changes.values()];
}

// Writes. Each returns once Dexie has the change; useLiveQuery picks it up from there.

async function patchMeta(tags: string[], patch: (current: TagMeta) => TagMeta): Promise<void> {
  if (!tags.length) return;
  await db.transaction('rw', db.tagMeta, async () => {
    const current = await db.tagMeta.bulkGet(tags);
    await db.tagMeta.bulkPut(tags.map((tag, i) => patch(current[i] ?? { tag })));
  });
}

// Picking a tag as a filter uses it. Adding it to something also brings it back if it was archived:
// archived tags aren't suggested, so typing one in is deliberate.
export function markTagsUsed(tags: string[], { revive = false, now = Date.now() } = {}): Promise<void> {
  return patchMeta(tags, (m) => ({ ...m, lastUsedAt: now, ...(revive && { archivedAt: undefined }) }));
}

// Writes only the colour of each changed record, so a use or archive written meanwhile isn't undone.
export function applyColorSlots(changes: TagMeta[]): Promise<void> {
  const slots = new Map(changes.map((m) => [m.tag, m.colorSlot]));
  return patchMeta([...slots.keys()], (m) => ({ ...m, colorSlot: slots.get(m.tag) }));
}

// Archives the tags and frees their colours. Resolves to an undo that puts every record back as it was.
export async function archiveTags(tags: string[], now = Date.now()): Promise<() => Promise<void>> {
  const before = await db.tagMeta.bulkGet(tags);
  await patchMeta(tags, (m) => ({ ...m, archivedAt: now, colorSlot: undefined }));
  return async () => {
    await db.transaction('rw', db.tagMeta, async () => {
      await db.tagMeta.bulkDelete(tags.filter((_, i) => !before[i]));
      await db.tagMeta.bulkPut(before.filter((m): m is TagMeta => !!m));
    });
  };
}

export function unarchiveTags(tags: string[]): Promise<void> {
  return patchMeta(tags, (m) => ({ ...m, archivedAt: undefined }));
}
