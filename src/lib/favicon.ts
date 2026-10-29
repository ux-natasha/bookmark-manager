import { IS_FIREFOX } from './browserKind';

// Uses the browser's own favicon cache (needs the "favicon" permission), so no network request is made.
// Firefox has no such cache for extensions, and asking every site for its icon would tell them what you keep, so none.
export function faviconUrl(pageUrl: string, size = 32): string | undefined {
  if (IS_FIREFOX) return undefined;
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}
