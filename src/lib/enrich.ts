// Fills in a bookmark's details (description, site, platform, preview image, link status)
// by fetching the page in the background. Runs in the background script.

import { db, kindOf, type Bookmark, type LinkStatus, type PreviewKind } from './db';
import { decodeEntities, MAX_HTML_BYTES, parseHtmlMeta, type PageMeta } from './metadata';
import { detectPlatform } from './platform';

const FETCH_TIMEOUT_MS = 15_000;
const THUMBNAIL_WIDTH = 640;
// Images narrower than this are usually logos or avatars, not real previews.
const MIN_PREVIEW_WIDTH = 200;
// Saved pictures are the thing itself, so they're kept larger than previews.
const PICTURE_WIDTH = 1600;

export function classifyStatus(status: number): LinkStatus {
  // 202 is what bot-protection services answer with while they "check your browser".
  if (status === 202) return 'restricted';
  if (status >= 200 && status < 400) return 'ok';
  if (status === 404 || status === 410) return 'gone';
  return 'restricted';
}

export interface FetchedPage {
  status: LinkStatus;
  finalUrl: string;
  html?: string;
}

// Reads only the <head> unless `full` is set (finding links inside an article needs the body).
export async function fetchPage(url: string, { full = false } = {}): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    });
    const status = classifyStatus(response.status);
    const isHtml = (response.headers.get('content-type') ?? '').includes('html');
    const html = isHtml && response.body ? await readHtml(response.body, full) : undefined;
    return { status, finalUrl: response.url || url, html };
  } catch {
    return { status: 'unreachable', finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

// Reads the response only until </head> (or the size cap), so a huge page doesn't get downloaded in full.
async function readHtml(body: ReadableStream<Uint8Array>, full: boolean): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  try {
    while (html.length < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (!full && /<\/head\s*>/i.test(html)) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return html;
}

// X pages are built by JavaScript, so a plain fetch gets nothing useful.
// Its public embed service returns the post's text and author instead.
async function fetchXPost(url: string): Promise<Partial<PageMeta> | undefined> {
  if (!/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+/i.test(url)) return undefined;
  try {
    const endpoint = `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { credentials: 'omit' });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { author_name?: string; html?: string };
    const text = data.html
      ?.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    const description = text ? decodeEntities(text) : undefined;
    return {
      title: data.author_name && description ? `${data.author_name}: “${description.slice(0, 120)}”` : undefined,
      description,
      author: data.author_name,
      siteName: 'X',
    };
  } catch {
    return undefined;
  }
}

// YouTube sometimes answers a plain fetch with a cookie-consent page instead of the video.
// Its embed service always gives the video's title and channel.
async function fetchYouTubeVideo(url: string): Promise<Partial<PageMeta> | undefined> {
  if (!/^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch|shorts\/)|youtu\.be\/)/i.test(url)) return undefined;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { credentials: 'omit' });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { title?: string; author_name?: string };
    return { title: data.title, author: data.author_name, siteName: 'YouTube' };
  } catch {
    return undefined;
  }
}

// Details from the platforms whose pages don't give them to a plain fetch.
export async function fetchKnownDetails(url: string): Promise<Partial<PageMeta> | undefined> {
  return (await fetchXPost(url)) ?? (await fetchYouTubeVideo(url));
}

// Shrinks an image to a small WebP thumbnail so thousands of previews stay light.
export async function makeThumbnail(blob: Blob, width = THUMBNAIL_WIDTH, minWidth = MIN_PREVIEW_WIDTH): Promise<Blob | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    if (bitmap.width < minWidth) return undefined;
    const scale = Math.min(1, width / bitmap.width);
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
  } catch {
    // SVGs and broken images can't be decoded here; the card falls back to its designed placeholder.
    return undefined;
  }
}

async function downloadPreviewImage(imageUrl: string): Promise<Blob | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(imageUrl, { credentials: 'omit', signal: controller.signal });
    if (!response.ok || !(response.headers.get('content-type') ?? 'image/').startsWith('image/')) return undefined;
    return makeThumbnail(await response.blob());
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

export async function savePreview(bookmarkId: string, kind: PreviewKind, blob: Blob): Promise<void> {
  await db.previews.put({ bookmarkId, kind, blob, createdAt: Date.now() });
}

// Stores a saved picture, shrunk if it's huge. Pictures that can't be decoded here (SVGs) are kept as they are.
export async function savePicture(bookmarkId: string, blob: Blob): Promise<void> {
  const resized = blob.size > 300_000 ? await makeThumbnail(blob, PICTURE_WIDTH, 0) : undefined;
  await savePreview(bookmarkId, 'image', resized ?? blob);
}

// Downloads a saved picture again, e.g. after restoring a backup (backups don't include images).
async function refetchPicture(bookmark: Bookmark): Promise<void> {
  if (bookmark.imageUrl && !(await db.previews.get([bookmark.id, 'image']))) {
    try {
      const response = await fetch(bookmark.imageUrl);
      const blob = await response.blob();
      if (response.ok && blob.type.startsWith('image/')) await savePicture(bookmark.id, blob);
    } catch {
      // The card shows its placeholder; the picture's page link still works.
    }
  }
  await db.bookmarks.update(bookmark.id, { enrichedAt: Date.now() });
}

function looksUntitled(b: Bookmark): boolean {
  return !b.title.trim() || b.title === b.url || /^https?:\/\//.test(b.title);
}

export interface EnrichOptions {
  // The <head> of the live page, when saving the page you're on. Better than a fetch:
  // it includes what you see while logged in, after the site's JavaScript has run.
  liveHead?: string;
}

export async function enrichBookmark(id: string, options: EnrichOptions = {}): Promise<void> {
  const bookmark = await db.bookmarks.get(id);
  if (!bookmark || bookmark.deletedAt) return;
  if (kindOf(bookmark) === 'image') return refetchPicture(bookmark);
  // Quotes and notes are your own words: nothing to fetch.
  if (kindOf(bookmark) !== 'link') return;

  const page: FetchedPage = options.liveHead
    ? { status: 'ok', finalUrl: bookmark.url, html: options.liveHead }
    : await fetchPage(bookmark.url);

  // Error and "checking your browser" pages have their own titles and descriptions; those aren't the page's.
  let meta: Partial<PageMeta> = page.html && page.status === 'ok' ? parseHtmlMeta(page.html, page.finalUrl) : {};
  const known = await fetchKnownDetails(bookmark.url);
  if (known) meta = { ...meta, ...Object.fromEntries(Object.entries(known).filter(([, v]) => v)) };

  const platform = detectPlatform(page.finalUrl, meta as PageMeta) ?? detectPlatform(bookmark.url);
  const now = Date.now();
  const failed = page.status === 'unreachable';

  const patch: Partial<Bookmark> = {
    linkStatus: page.status,
    lastCheckedAt: now,
    checkFailures: failed ? (bookmark.checkFailures ?? 0) + 1 : 0,
    enrichedAt: now,
  };
  // When a check fails, keep whatever details we already had.
  if (!failed) {
    Object.assign(patch, {
      description: meta.description ?? bookmark.description,
      siteName: meta.siteName ?? bookmark.siteName,
      platform: platform?.id ?? bookmark.platform,
      author: meta.author ?? bookmark.author,
      publishedAt: meta.publishedAt ?? bookmark.publishedAt,
      themeColor: meta.themeColor ?? bookmark.themeColor,
    });
    if (meta.duration || meta.recipe) {
      patch.details = {
        ...bookmark.details,
        ...(meta.duration && { duration: meta.duration }),
        ...(meta.recipe && { recipe: meta.recipe }),
      };
    }
    // Only replace titles that are just a link; never overwrite one you or your favorites gave it.
    if (meta.title && looksUntitled(bookmark)) patch.title = meta.title;
  }
  await db.bookmarks.update(id, patch);

  if (meta.image && !(await db.previews.get([id, 'image']))) {
    const thumbnail = await downloadPreviewImage(meta.image);
    if (thumbnail) await savePreview(id, 'image', thumbnail);
  }
}

// Captures what's on screen in the given window (the page you're saving) as a thumbnail.
export async function captureScreenshot(bookmarkId: string, windowId: number): Promise<boolean> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 85 });
    const blob = await (await fetch(dataUrl)).blob();
    const thumbnail = await makeThumbnail(blob, 800);
    if (!thumbnail) return false;
    await savePreview(bookmarkId, 'screenshot', thumbnail);
    return true;
  } catch {
    // Some pages can't be captured (browser pages, the extension store, PDFs).
    return false;
  }
}

// Reads the rendered <head> of the tab you're on. Fails quietly on pages extensions can't touch.
export async function readLiveHead(tabId: number): Promise<string | undefined> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (max: number) => (document.head ? document.head.outerHTML.slice(0, max) : ''),
      args: [MAX_HTML_BYTES],
    });
    return (result?.result as string | undefined) || undefined;
  } catch {
    return undefined;
  }
}
