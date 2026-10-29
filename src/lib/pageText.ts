// The readable words of a saved page, kept so a link that dies still has them, and so search can look inside pages.
// Works on raw HTML text because the background script has no DOM to parse with.

import { db } from './db';
import { decodeEntities } from './metadata';

// About 10,000 words. Enough for a long article; stops a huge page from filling the library.
export const MAX_TEXT_LENGTH = 60_000;
// Less than this is a login wall, a cookie notice or an app shell, not the page's words.
const MIN_TEXT_LENGTH = 200;

// Parts of a page that aren't its words.
const DROP = /<(script|style|noscript|svg|template|iframe|canvas|object|select|button)\b[\s\S]*?<\/\1\s*>/gi;
const CHROME = /<(nav|header|footer|aside|form|menu|dialog)\b[\s\S]*?<\/\1\s*>/gi;
// Tags that end a line of text.
const BREAKS = /<\/?(p|div|br|h[1-6]|li|ul|ol|tr|table|section|article|main|blockquote|pre|figure|figcaption|dt|dd|hr)\b[^>]*>/gi;

export function readableText(html: string): string {
  let body = html.replace(/<!--[\s\S]*?-->/g, '').replace(DROP, ' ');
  body = body.replace(/^[\s\S]*?<body\b[^>]*>/i, '').replace(/<\/body\s*>[\s\S]*$/i, '');
  // Where the page marks its own article, that's the part worth keeping. Some pages mark more than one (a feed).
  const articles = [...body.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/gi)].map((m) => m[1]);
  const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1];
  const part = [articles.join('\n'), main ?? ''].find((p) => toText(p).length >= MIN_TEXT_LENGTH) ?? body;
  return limit(toText(part.replace(CHROME, ' ')));
}

function toText(html: string): string {
  return decodeEntities(html.replace(BREAKS, '\n').replace(/<[^>]*>/g, ' '))
    .split('\n')
    .map((line) => line.replace(/[\s ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

// Trims to the cap at a line or word break, and tidies text read straight from a page (innerText).
export function limit(text: string): string {
  const tidy = text
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  if (tidy.length <= MAX_TEXT_LENGTH) return tidy;
  const cut = tidy.slice(0, MAX_TEXT_LENGTH);
  const at = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf(' '));
  return at > MAX_TEXT_LENGTH * 0.9 ? cut.slice(0, at) : cut;
}

// Keeps the first good copy of a page: later checks don't replace it, so a page that changes or dies keeps
// the words you saved it for. Returns whether there was enough text to keep.
export async function savePageText(bookmarkId: string, text: string | undefined): Promise<boolean> {
  const words = text ? limit(text) : '';
  if (words.length < MIN_TEXT_LENGTH) return false;
  if (await db.pageTexts.get(bookmarkId)) return true;
  await db.pageTexts.put({ bookmarkId, text: words, savedAt: Date.now() });
  return true;
}

// The bookmarks whose saved page text holds every one of the words (already lowercased).
export async function idsWithText(words: string[]): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!words.length) return ids;
  await db.pageTexts.each((page) => {
    const text = page.text.toLowerCase();
    if (words.every((w) => text.includes(w))) ids.add(page.bookmarkId);
  });
  return ids;
}

