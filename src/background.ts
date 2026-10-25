import { purgeOldTrash, saveBookmark } from './lib/bookmarks';
import { db, type BookmarkSource } from './lib/db';
import { captureScreenshot, enrichBookmark, readLiveHead } from './lib/enrich';
import { setLastSave, type BackgroundRequest } from './lib/messages';
import { isSaveableUrl, normalizeUrl } from './lib/normalize';
import { processPending, recheckAll } from './lib/queue';

const MENU_SAVE_LINK = 'save-link';
const MENU_SAVE_PAGE = 'save-page';
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
  }
});

// Saves the page in a tab you're looking at: screenshot it, and read its details from the live page.
async function savePage(tab: chrome.tabs.Tab, source: BookmarkSource) {
  if (!isSaveableUrl(tab.url)) return;
  const { bookmark, created } = await saveBookmark({ url: tab.url, title: tab.title, source });
  await setLastSave({ bookmarkId: bookmark.id, url: tab.url, created, at: Date.now() });
  if (tab.id !== undefined) flashBadge(tab.id, created);

  const hasScreenshot = await db.previews.get([bookmark.id, 'screenshot']);
  if (!hasScreenshot && tab.windowId !== undefined) await captureScreenshot(bookmark.id, tab.windowId);
  if (created || !bookmark.enrichedAt) {
    const liveHead = tab.id !== undefined ? await readLiveHead(tab.id) : undefined;
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
