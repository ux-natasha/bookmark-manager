import { purgeOldTrash, saveBookmark } from './lib/bookmarks';
import { db, type BookmarkSource } from './lib/db';
import { captureScreenshot, enrichBookmark, makeThumbnail, readLiveHead, savePicture, savePreview } from './lib/enrich';
import { setLastSave, type BackgroundRequest } from './lib/messages';
import { isProtectedPage, isSaveableUrl, normalizeUrl } from './lib/normalize';
import { detectPlatform } from './lib/platform';
import { processPending, recheckAll } from './lib/queue';

const MENU_SAVE_LINK = 'save-link';
const MENU_SAVE_PAGE = 'save-page';
const MENU_SAVE_IMAGE = 'save-image';
const MENU_SAVE_VIDEO = 'save-video';
const MENU_SAVE_QUOTE = 'save-quote';
const ENRICH_ALARM = 'enrich';

chrome.runtime.onInstalled.addListener(() => {
  // We open the panel ourselves on click, so the click can also save the page.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SAVE_LINK,
      title: 'Save link to Bookmark Manager',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_PAGE,
      title: 'Save this page to Bookmark Manager',
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_IMAGE,
      title: 'Save picture to Bookmark Manager',
      contexts: ['image'],
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_VIDEO,
      title: 'Save video to Bookmark Manager',
      contexts: ['video'],
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_QUOTE,
      title: 'Save quote to Bookmark Manager',
      contexts: ['selection'],
    });
  });

  startBackgroundWork();
});

chrome.runtime.onStartup.addListener(() => {
  purgeOldTrash();
  startBackgroundWork();
});

// Picks up anything still missing details (e.g. an import interrupted by closing the browser),
// and retries sites that didn't answer, once an hour.
function startBackgroundWork() {
  chrome.alarms.create(ENRICH_ALARM, { periodInMinutes: 60 });
  processPending();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ENRICH_ALARM) processPending();
});

// Fires for the toolbar icon and for the Alt+Shift+S shortcut.
chrome.action.onClicked.addListener((tab) => {
  // sidePanel.open must run before any await, while the browser still counts this as a user click.
  if (tab.windowId !== undefined) chrome.sidePanel.open({ windowId: tab.windowId });
  savePage(tab, 'panel');
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_SAVE_LINK && isSaveableUrl(info.linkUrl)) {
    // We're not on that page, so no screenshot; details are fetched in the background.
    const { bookmark, created } = await saveBookmark({ url: info.linkUrl, title: info.selectionText, source: 'context-menu' });
    await setLastSave({ bookmarkId: bookmark.id, url: info.linkUrl, created, at: Date.now() });
    if (tab?.id !== undefined) flashBadge(tab.id, created);
    if (created) enrichBookmark(bookmark.id);
  } else if (info.menuItemId === MENU_SAVE_PAGE && tab) {
    savePage(tab, 'context-menu');
  } else if (info.menuItemId === MENU_SAVE_IMAGE && info.srcUrl && tab?.id !== undefined) {
    saveImage(info.srcUrl, info, tab);
  } else if (info.menuItemId === MENU_SAVE_VIDEO && tab) {
    // Players on YouTube and the like hand out a blob: address that only works in the page, so save the page instead.
    const url = isSaveableUrl(info.srcUrl) ? info.srcUrl : info.pageUrl ?? tab.url;
    if (!isSaveableUrl(url)) return;
    const video = tab.id !== undefined ? await readVideo({ tabId: tab.id, frameIds: [info.frameId ?? 0] }, info.srcUrl) : undefined;
    const title = video?.caption || (url === info.pageUrl ? tab.title : undefined);
    const { bookmark, created } = await saveBookmark({ url, title, source: 'context-menu' });
    await setLastSave({ bookmarkId: bookmark.id, url, created, at: Date.now() });
    if (tab.id !== undefined) flashBadge(tab.id, created);
    if (created) {
      await saveVideoPreview(bookmark.id, video, tab);
      enrichBookmark(bookmark.id);
    }
  } else if (info.menuItemId === MENU_SAVE_QUOTE && tab?.id !== undefined) {
    saveQuote(info, tab);
  }
});

// The page a picture or quote came from, so its card can link back to it.
function sourcePage(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  const url = info.pageUrl ?? tab.url;
  return isSaveableUrl(url)
    ? { url, title: tab.title, platform: detectPlatform(url)?.id }
    : { url: '', title: tab.title, platform: undefined };
}

async function saveImage(srcUrl: string, info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  const page = sourcePage(info, tab);
  const target = { tabId: tab.id!, frameIds: [info.frameId ?? 0] };
  const alt = await runInPage(target, (src: string) => {
    const image = [...document.images].find((img) => img.currentSrc === src || img.src === src);
    return image?.alt.trim() ?? '';
  }, srcUrl);

  const { bookmark, created } = await saveBookmark({
    kind: 'image',
    url: page.url,
    title: alt || page.title,
    // data: and blob: addresses only work inside the page, so there's nothing to keep for those.
    imageUrl: isSaveableUrl(srcUrl) ? srcUrl : undefined,
    platform: page.platform,
    source: 'context-menu',
  });
  flashBadge(tab.id!, created);
  if (!created) return;

  const blob = await downloadPicture(srcUrl, target);
  if (blob) {
    await savePicture(bookmark.id, blob);
    await db.bookmarks.update(bookmark.id, { enrichedAt: Date.now() });
  } else {
    // Leaves it for the background queue to try once more.
    processPending();
  }
}

interface VideoRead {
  // The frame on screen, as a data: URL. Missing when the site doesn't let the page read its video.
  frame?: string;
  // The still the site shows before the video plays.
  poster?: string;
  // The post it's in, on X (a GIF's file name is just an id).
  caption?: string;
}

// Reads the video you right-clicked: what it's showing, its poster, and the post around it.
async function readVideo(target: chrome.scripting.InjectionTarget, srcUrl: string | undefined): Promise<VideoRead | undefined> {
  return runInPage(target, (src: string | undefined) => {
    const videos = [...document.querySelectorAll('video')];
    const video = videos.find((v) => src && (v.currentSrc === src || v.src === src)) ?? videos.find((v) => !v.paused) ?? videos[0];
    if (!video) return {};
    const caption = (video.closest('article')?.querySelector('[data-testid="tweetText"]') as HTMLElement | null)?.innerText;
    let frame: string | undefined;
    if (video.videoWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
        frame = canvas.toDataURL('image/jpeg', 0.85);
      } catch {
        // Videos from other sites that don't allow it can't be read.
      }
    }
    return { frame, poster: video.poster || undefined, caption: caption?.replace(/\s+/g, ' ').trim().slice(0, 300) || undefined };
  }, srcUrl);
}

// A preview for a video you right-clicked: the frame it's showing right now, else the site's
// poster for it, else a screenshot of the tab. The site's own image still fills in later for pages that have one.
async function saveVideoPreview(bookmarkId: string, video: VideoRead | undefined, tab: chrome.tabs.Tab) {
  for (const source of [video?.frame, video?.poster]) {
    if (!source) continue;
    try {
      const thumbnail = await makeThumbnail(await (await fetch(source, { credentials: 'omit' })).blob(), 800);
      if (thumbnail) return savePreview(bookmarkId, 'screenshot', thumbnail);
    } catch {
      // Try the next one.
    }
  }
  if (tab.windowId !== undefined && !(tab.url && isProtectedPage(tab.url))) await captureScreenshot(bookmarkId, tab.windowId);
}

async function downloadPicture(srcUrl: string, target: chrome.scripting.InjectionTarget): Promise<Blob | undefined> {
  try {
    const response = await fetch(srcUrl);
    const blob = await response.blob();
    if (response.ok && !blob.type.includes('html')) return blob;
  } catch {
    // Falls through to reading it from the page.
  }
  // Pictures only the page can read (logged-in sites, blob: addresses): fetch them from inside the page.
  const dataUrl = await runInPage(target, async (src: string) => {
    const blob = await (await fetch(src)).blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, srcUrl);
  return dataUrl ? (await fetch(dataUrl)).blob() : undefined;
}

async function saveQuote(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  // Read from the page, because the menu's copy of the selection loses its line breaks.
  const selected = await runInPage({ tabId: tab.id!, frameIds: [info.frameId ?? 0] }, () => window.getSelection()?.toString() ?? '');
  const text = selected?.trim() || info.selectionText?.trim();
  if (!text) return;
  const page = sourcePage(info, tab);
  const { created } = await saveBookmark({ kind: 'quote', text, ...page, source: 'context-menu' });
  flashBadge(tab.id!, created);
}

// Runs a small function in the page. Fails quietly on pages extensions can't touch.
async function runInPage<Args extends unknown[], Result>(
  target: chrome.scripting.InjectionTarget,
  func: (...args: Args) => Result | Promise<Result>,
  ...args: Args
): Promise<Result | undefined> {
  try {
    const [result] = await chrome.scripting.executeScript({ target, func, args });
    return (result?.result as Result | undefined) || undefined;
  } catch {
    return undefined;
  }
}

// Saves the page in a tab you're looking at: screenshot it, and read its details from the live page.
async function savePage(tab: chrome.tabs.Tab, source: BookmarkSource) {
  if (!isSaveableUrl(tab.url)) return;
  const { bookmark, created } = await saveBookmark({ url: tab.url, title: tab.title, source });
  await setLastSave({ bookmarkId: bookmark.id, url: tab.url, created, at: Date.now() });
  if (tab.id !== undefined) flashBadge(tab.id, created);

  // On protected pages both would fail; the background fetch still gets the page's details.
  const isProtected = isProtectedPage(tab.url);
  const hasScreenshot = await db.previews.get([bookmark.id, 'screenshot']);
  if (!hasScreenshot && !isProtected && tab.windowId !== undefined) await captureScreenshot(bookmark.id, tab.windowId);
  if (created || !bookmark.enrichedAt) {
    const liveHead = tab.id !== undefined && !isProtected ? await readLiveHead(tab.id) : undefined;
    await enrichBookmark(bookmark.id, { liveHead });
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, _sender, sendResponse) => {
  handleRequest(request).then(sendResponse, (err: Error) => sendResponse({ error: err.message }));
  // Keeps the message channel open for the async response.
  return true;
});

async function handleRequest(request: BackgroundRequest): Promise<unknown> {
  switch (request.type) {
    case 'save-active-tab': {
      const [tab] = await chrome.tabs.query({ active: true, windowId: request.windowId });
      if (tab) await savePage(tab, 'panel');
      return { ok: !!tab };
    }
    case 'retake-screenshot': {
      const [tab] = await chrome.tabs.query({ active: true, windowId: request.windowId });
      const bookmark = await db.bookmarks.get(request.bookmarkId);
      // Only screenshot if the tab is still showing that bookmark's page.
      if (!tab?.url || !bookmark || normalizeUrl(tab.url) !== bookmark.normalizedUrl) return { ok: false };
      return { ok: await captureScreenshot(bookmark.id, request.windowId) };
    }
    case 'enrich-pending':
      processPending();
      return { ok: true };
    case 'enrich-one':
      await enrichBookmark(request.bookmarkId);
      return { ok: true };
    case 'recheck-all':
      recheckAll();
      return { ok: true };
  }
}

// A brief tick on the toolbar icon, so right-click saves give feedback without opening anything.
async function flashBadge(tabId: number, created: boolean) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: created ? '#2f9e44' : '#868e96' });
  await chrome.action.setBadgeText({ tabId, text: created ? '✓' : '=' });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 2500);
}
