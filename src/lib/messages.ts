// The background script saves pages (icon click, shortcut, right-click) and records the latest save
// in session storage, so the side panel can show "Saved · Undo" even if it opened after the save.

export interface LastSave {
  bookmarkId: string;
  url: string;
  // false when the page was already in the library.
  created: boolean;
  at: number;
}

export interface EnrichProgress {
  done: number;
  total: number;
  running: boolean;
}

const LAST_SAVE_KEY = 'lastSave';
const PROGRESS_KEY = 'enrichProgress';

export async function setLastSave(save: LastSave): Promise<void> {
  await chrome.storage.session.set({ [LAST_SAVE_KEY]: save });
}

export async function getLastSave(): Promise<LastSave | undefined> {
  const result = await chrome.storage.session.get(LAST_SAVE_KEY);
  return result[LAST_SAVE_KEY] as LastSave | undefined;
}

export function onLastSave(callback: (save: LastSave) => void): () => void {
  return onSessionChange(LAST_SAVE_KEY, callback);
}

export async function setEnrichProgress(progress: EnrichProgress): Promise<void> {
  await chrome.storage.session.set({ [PROGRESS_KEY]: progress });
}

export async function getEnrichProgress(): Promise<EnrichProgress | undefined> {
  const result = await chrome.storage.session.get(PROGRESS_KEY);
  return result[PROGRESS_KEY] as EnrichProgress | undefined;
}

export function onEnrichProgress(callback: (progress: EnrichProgress) => void): () => void {
  return onSessionChange(PROGRESS_KEY, callback);
}

function onSessionChange<T>(key: string, callback: (value: T) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'session' && changes[key]?.newValue) callback(changes[key].newValue as T);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// Requests from the side panel and library to the background script, which owns fetching and screenshots.
export type BackgroundRequest =
  // Save the page that's showing in this window (the panel's "Save this page" button).
  | { type: 'save-active-tab'; windowId: number }
  // Take a fresh screenshot of the page that's showing (it must be this bookmark's page).
  | { type: 'retake-screenshot'; bookmarkId: string; windowId: number }
  // Fetch details for everything that doesn't have them yet (after an import or restore).
  | { type: 'enrich-pending' }
  // Fetch one bookmark's details again ("Refresh details").
  | { type: 'enrich-one'; bookmarkId: string }
  | { type: 'recheck-all' };

export function sendToBackground(request: BackgroundRequest): Promise<unknown> {
  return chrome.runtime.sendMessage(request);
}

export async function openLibrary(): Promise<void> {
  const libraryUrl = chrome.runtime.getURL('library.html');
  const [existing] = await chrome.tabs.query({ url: libraryUrl + '*' });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: libraryUrl });
}
