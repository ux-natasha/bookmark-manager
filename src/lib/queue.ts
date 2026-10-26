// Works through every bookmark that still needs details, a few at a time, in the background script.
// Big imports can take a while, so progress is published for the library to show.

import { db, kindOf, type Bookmark } from './db';
import { enrichBookmark } from './enrich';
import { setEnrichProgress } from './messages';
import { hostnameOf } from './normalize';

const CONCURRENCY = 4;
// Wait between two requests to the same site, so a big import doesn't look like an attack.
const SAME_HOST_GAP_MS = 1500;
// A site that didn't answer gets one more try later before it's flagged as dead.
const RETRY_UNREACHABLE_AFTER_MS = 6 * 60 * 60 * 1000;

export function needsEnrichment(b: Bookmark, now = Date.now()): boolean {
  if (b.deletedAt) return false;
  const kind = kindOf(b);
  if (kind === 'quote' || kind === 'note') return false;
  if (!b.enrichedAt) return true;
  if (kind === 'image') return false;
  return (
    b.linkStatus === 'unreachable' &&
    (b.checkFailures ?? 0) < 2 &&
    now - (b.lastCheckedAt ?? 0) > RETRY_UNREACHABLE_AFTER_MS
  );
}

let running: Promise<void> | null = null;

// Safe to call any time: if a run is already going, this joins it, and anything saved
// meanwhile is picked up because each run re-reads the list when it finishes.
export function processPending(): Promise<void> {
  if (!running) {
    running = run().finally(() => {
      running = null;
    });
  }
  return running;
}

async function run(): Promise<void> {
  let pending = (await db.bookmarks.toArray()).filter((b) => needsEnrichment(b));
  while (pending.length) {
    await processBatch(pending);
    pending = (await db.bookmarks.toArray()).filter((b) => needsEnrichment(b) && !attempted.has(b.id));
  }
  attempted.clear();
  await setEnrichProgress({ done: 0, total: 0, running: false });
}

// Bookmarks tried during this run, so one that keeps failing isn't retried in a loop.
const attempted = new Set<string>();

async function processBatch(items: Bookmark[]): Promise<void> {
  // Newest first: what you just saved or imported matters most.
  const queue = [...items].sort((a, b) => b.createdAt - a.createdAt);
  const total = queue.length;
  let done = 0;
  const busyHosts = new Set<string>();
  const lastHit = new Map<string, number>();
  await setEnrichProgress({ done, total, running: true });

  const takeNext = (): Bookmark | undefined => {
    const now = Date.now();
    const index = queue.findIndex((b) => {
      const host = hostnameOf(b.url);
      return !busyHosts.has(host) && now - (lastHit.get(host) ?? 0) >= SAME_HOST_GAP_MS;
    });
    return index === -1 ? undefined : queue.splice(index, 1)[0];
  };

  const worker = async () => {
    while (queue.length) {
      const next = takeNext();
      if (!next) {
        // Everything left is on a site we just hit; wait a moment.
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      const host = hostnameOf(next.url);
      busyHosts.add(host);
      attempted.add(next.id);
      try {
        await enrichBookmark(next.id);
      } catch (err) {
        console.warn('Could not fetch details for', next.url, err);
        await db.bookmarks.update(next.id, { enrichedAt: Date.now() });
      } finally {
        busyHosts.delete(host);
        lastHit.set(host, Date.now());
        done++;
        // Also keeps the background script awake: each storage call resets its idle timer.
        await setEnrichProgress({ done, total, running: true });
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// "Check links again": forget the last check for every bookmark, then re-run.
// Failure counts are kept, so a link that was already dead and still fails stays flagged.
export async function recheckAll(): Promise<void> {
  await db.bookmarks.toCollection().modify((b) => {
    if (!b.deletedAt && kindOf(b) === 'link') b.enrichedAt = undefined;
  });
  await processPending();
}
