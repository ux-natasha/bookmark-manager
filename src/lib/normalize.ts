// Turns a URL into a comparison key so the same page saved twice is caught as a duplicate,
// even when the links differ in tracking junk, www./m., http/https, or a trailing slash.
// The original URL is always kept for opening; this key is only used for matching.

const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'mc_cid', 'mc_eid',
  'igsh', 'igshid', 'si', 'ref_src', 'ref_url', 'utm_id', '_hsenc', '_hsmi',
  'mkt_tok', 'yclid',
  // Affiliate codes ("mobbin.com/?via=someone"): the same page whoever shared it.
  'via',
]);

// Short param names that are tracking on some sites but real content elsewhere (e.g. ?s= search),
// so they're only stripped on the sites where we know they're share junk.
const TRACKING_PARAMS_BY_HOST: Record<string, string[]> = {
  'x.com': ['s', 't', 'ref_src'],
  'linkedin.com': ['trk', 'trackingid', 'lipi'],
  'instagram.com': ['img_index'],
  'reddit.com': ['share_id', 'utm_name'],
  'threads.net': ['xmt'],
  'substack.com': ['r', 'triedredirect'],
};

function hostTrackingParams(host: string): Set<string> {
  for (const [h, params] of Object.entries(TRACKING_PARAMS_BY_HOST)) {
    if (host === h || host.endsWith('.' + h)) return new Set(params);
  }
  return new Set();
}

function isTrackingParam(key: string, hostParams: Set<string>): boolean {
  const k = key.toLowerCase();
  return k.startsWith('utm_') || TRACKING_PARAMS.has(k) || hostParams.has(k);
}

// Removes tracking junk from a link but otherwise keeps it exactly as it was, for saving.
// (Links found in posts usually carry "?utm_source=twitter" and the like.)
export function stripTracking(input: string): string {
  try {
    const url = new URL(input);
    const hostParams = hostTrackingParams(url.hostname.replace(/^(www\d*|m|mobile)\./, ''));
    for (const key of [...url.searchParams.keys()]) {
      if (isTrackingParam(key, hostParams) || key.toLowerCase() === 'trk') url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return input;
  }
}

export function normalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return input.trim().toLowerCase();
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return url.href;
  }

  let host = url.hostname.toLowerCase();
  host = host.replace(/^(www\d*|m|mobile)\./, '');
  if (host === 'youtu.be') {
    // youtu.be/ID → youtube.com/watch?v=ID
    const id = url.pathname.slice(1);
    url = new URL(`https://youtube.com/watch?v=${id}${url.search ? '&' + url.search.slice(1) : ''}`);
    host = 'youtube.com';
  }
  if (host === 'twitter.com') host = 'x.com';

  const hostParams = hostTrackingParams(host);
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key, hostParams))
    .sort(([a], [b]) => a.localeCompare(b));

  const path = url.pathname.replace(/\/+$/, '');

  const query = params.length
    ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';

  // Hash routes (#/page, #!/page) are real pages in single-page apps; plain anchors (#section) aren't.
  const hash = url.hash.startsWith('#/') || url.hash.startsWith('#!') ? url.hash : '';

  const port = url.port && url.port !== '80' && url.port !== '443' ? ':' + url.port : '';

  return `${host}${port}${path}${query}${hash}`;
}

export function isSaveableUrl(input: string | undefined): input is string {
  if (!input) return false;
  try {
    const { protocol } = new URL(input);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// The browser blocks all extensions from screenshotting or reading the extension stores,
// so we don't try (and don't offer "Retake screenshot") there.
export function isProtectedPage(input: string): boolean {
  try {
    const { hostname, pathname } = new URL(input);
    return (
      hostname === 'chromewebstore.google.com' ||
      (hostname === 'chrome.google.com' && pathname.startsWith('/webstore')) ||
      (hostname === 'microsoftedge.microsoft.com' && pathname.startsWith('/addons'))
    );
  } catch {
    return false;
  }
}

export function hostnameOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, '');
  } catch {
    return input;
  }
}
