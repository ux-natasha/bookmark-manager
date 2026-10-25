// Pulls the links out of a social post (or any text) and tidies them up for saving:
// unwraps redirect links, drops links back to the post's own site, and removes repeats.
// Everything here is plain text work, so it can be tested without a browser.

import { normalizeUrl, stripTracking } from './normalize';
import { detectPlatform } from './platform';

export interface FoundLink {
  url: string;
  // The post's text only showed the start of the address ("figma.com/commu…"),
  // so this is just the site's home page.
  truncated?: boolean;
}

// Bare domains ("figma.com/community") are only recognised with these endings,
// so ordinary words joined by a dot ("Node.js", "e.g.") aren't mistaken for links.
const BARE_TLDS = [
  'com', 'net', 'org', 'io', 'co', 'ai', 'app', 'dev', 'design', 'so', 'me', 'xyz', 'site', 'page', 'tools',
  'tech', 'studio', 'gg', 'fm', 'tv', 'ly', 'sh', 'info', 'biz', 'to', 'cc', 'us', 'uk', 'ca', 'de', 'fr', 'nl',
  'eu', 'in', 'au', 'jp', 'art', 'blog', 'link', 'fyi', 'ink', 'news', 'club', 'online', 'store', 'shop',
  'space', 'website', 'wiki', 'work', 'zone', 'systems', 'digital', 'agency', 'gallery', 'im', 'vc', 'lol',
  'fun', 'email', 'build', 'community', 'run', 'cafe', 'world', 'one', 'lt', 'am', 'is',
];

const FULL_URL = /https?:\/\/[^\s<>"'`{}|\\^[\]]+/gi;
const BARE_URL = new RegExp(
  String.raw`(?<![@\w.\/-])(www\.(?:[a-z0-9-]+\.)+[a-z]{2,}|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${BARE_TLDS.join('|')}))(?![a-z0-9-])(\/[^\s<>"'\x60{}|\\^[\]]*)?`,
  'gi',
);
const TRUNCATION = /(?:…|\.\.\.)$/;

// Link shorteners: the real address is only known after following the redirect.
const SHORTENERS = new Set([
  't.co', 'bit.ly', 'buff.ly', 'ow.ly', 'tinyurl.com', 'lnkd.in', 'dlvr.it', 'trib.al', 'is.gd', 'goo.gl',
  'rebrand.ly', 't.ly', 'shorturl.at', 'cutt.ly', 'tiny.cc', 'rb.gy', 'bl.ink', 'surl.li', 'kutt.it',
  'redd.it', 'amzn.to', 'spoti.fi', 'apple.co', 'flip.it', 'hubs.ly', 'mtr.cool', 'substack.com',
]);

// Platforms wrap outgoing links in a redirect page; the real address is in a query parameter.
const WRAPPERS: [RegExp, string][] = [
  [/^l\.(?:facebook|instagram|messenger)\.com$/, 'u'],
  [/^l\.threads\.(?:net|com)$/, 'u'],
  [/(?:^|\.)linkedin\.com$/, 'url'],
  [/(?:^|\.)youtube\.com$/, 'q'],
  [/(?:^|\.)google\.[a-z.]+$/, 'q'],
  [/^t\.umblr\.com$/, 'z'],
  [/^out\.reddit\.com$/, 'url'],
  [/^href\.li$/, ''],
];

// Image and video servers of the big platforms: these are a post's attachments, not sites it mentions.
const ASSET_HOSTS = /(?:^|\.)(?:twimg\.com|fbcdn\.net|cdninstagram\.com|licdn\.com|redditmedia\.com|redditstatic\.com|cdn\.bsky\.app|video\.bsky\.app|ytimg\.com|ggpht\.com|googleusercontent\.com|gravatar\.com)$/;
const ASSET_PATH = /\.(?:jpe?g|png|gif|webp|avif|svg|mp4|mov|webm)$/i;
const MEDIA_HOSTS = new Set(['i.redd.it', 'v.redd.it', 'preview.redd.it', 'i.imgur.com', 'pic.twitter.com', 'pic.x.com']);

// "Share this on…" buttons, which are links to post the page, not links the page mentions.
const SHARE_LINK =
  /^https?:\/\/(?:www\.)?(?:(?:twitter|x)\.com\/(?:intent|share)|facebook\.com\/(?:sharer|share|dialog)|linkedin\.com\/(?:shareArticle|sharing|cws\/share)|pinterest\.[a-z.]+\/pin\/create|reddit\.com\/submit|wa\.me\/|api\.whatsapp\.com\/send|t\.me\/share|news\.ycombinator\.com\/submitlink|bsky\.app\/intent|threads\.(?:net|com)\/intent|mastodonshare\.com|getpocket\.com\/(?:save|edit)|flipboard\.com\/bookmarklet)/i;

// Share buttons also come as a site's own counter link carrying the page's address (?uri=/this/page).
function sharesPost(url: string, postUrl: string): boolean {
  try {
    const post = new URL(postUrl);
    const target = (post.hostname.replace(/^www\./, '') + post.pathname).replace(/\/+$/, '').toLowerCase();
    if (target.length < 8) return false;
    return [...new URL(url).searchParams.values()].some((v) => v.toLowerCase().includes(target));
  } catch {
    return false;
  }
}

function trimTrailing(url: string): string {
  let result = url.replace(/[.,;:!?'"’”*_~]+$/, '');
  // Keep a closing bracket only if the link opened one, as in Wikipedia's "Foo_(bar)" pages.
  while (/[)\]]$/.test(result)) {
    const open = result.endsWith(')') ? '(' : '[';
    const close = result.endsWith(')') ? ')' : ']';
    if (result.split(open).length >= result.split(close).length) break;
    result = result.slice(0, -1).replace(/[.,;:!?'"’”]+$/, '');
  }
  return result;
}

function toLink(raw: string, assumeHttps: boolean): FoundLink | undefined {
  const truncated = TRUNCATION.test(raw);
  const text = trimTrailing(raw.replace(TRUNCATION, ''));
  try {
    const url = new URL(assumeHttps ? `https://${text}` : text);
    if (truncated) return { url: url.origin + '/', truncated: url.pathname.length > 1 || url.search !== '' };
    return { url: url.href };
  } catch {
    return undefined;
  }
}

// Finds web addresses in text: full links and bare ones like "figma.com/community".
export function findUrlsInText(text: string): FoundLink[] {
  const found: FoundLink[] = [];
  const withoutFull = text.replace(FULL_URL, (match) => {
    const link = toLink(match, false);
    if (link) found.push(link);
    return ' ';
  });
  for (const match of withoutFull.matchAll(BARE_URL)) {
    const link = toLink(match[0], true);
    if (link) found.push(link);
  }
  return found;
}

// Turns a platform's "you're leaving our site" redirect back into the real link.
export function unwrapRedirect(input: string): string {
  try {
    const url = new URL(input);
    for (const [host, param] of WRAPPERS) {
      if (!host.test(url.hostname)) continue;
      // href.li puts the whole address after the "?".
      const target = param ? url.searchParams.get(param) : decodeURIComponent(url.search.slice(1));
      const isRedirectPath = param === '' || /redir|redirect|^\/safety\/go|^\/l(?:\.php)?\/?$|^\/url\/?$|^\/$/.test(url.pathname);
      if (target && isRedirectPath && /^https?:\/\//i.test(target)) return unwrapRedirect(target);
    }
    return url.href;
  } catch {
    return input;
  }
}

export function isShortener(input: string): boolean {
  try {
    const { hostname, pathname } = new URL(input);
    const host = hostname.replace(/^www\./, '');
    // substack.com/redirect/… is a newsletter's tracked link; the rest of substack.com is real pages.
    if (host === 'substack.com') return pathname.startsWith('/redirect/');
    return SHORTENERS.has(host) && pathname.length > 1;
  } catch {
    return false;
  }
}

// Some shorteners answer browsers with a page instead of a redirect: a tiny one that forwards on (t.co),
// or a "you're leaving LinkedIn" page with the real address on its button (lnkd.in).
export function redirectTargetFromHtml(html: string): string | undefined {
  const refresh = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*?url=([^"'>\s]+)/i)?.[1];
  const title = html.match(/<title[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/title>/i)?.[1];
  const button = anchorsFromHtml(html, 'https://lnkd.in/', /external_url_click/)[0];
  const target = refresh ?? title ?? button;
  return target && /^https?:\/\//i.test(target) ? target.replace(/&amp;/g, '&') : undefined;
}

// Social platforms count as one site across their domains (x.com, twitter.com). Other platforms don't:
// a Substack post pointing to another Substack is a real recommendation.
function siteKey(input: string): string | undefined {
  try {
    const url = new URL(input);
    const platform = detectPlatform(url.href);
    return platform?.social ? platform.id : url.hostname.replace(/^(www\d*|m|mobile)\./, '');
  } catch {
    return undefined;
  }
}

// Links back to the post's own site are profiles, hashtags and buttons, not things the post mentions.
export function isSameSite(link: string, postUrl: string): boolean {
  const a = siteKey(link);
  return a !== undefined && a === siteKey(postUrl);
}

export function isAttachment(link: string): boolean {
  try {
    const { hostname, pathname } = new URL(link);
    return ASSET_HOSTS.test(hostname) || MEDIA_HOSTS.has(hostname) || ASSET_PATH.test(pathname);
  } catch {
    return true;
  }
}

// Unwraps, filters and de-duplicates raw links found in a post. Shorteners are kept as they are
// (they get followed later); everything else that points back at the post's own site is dropped.
export function tidyLinks(links: FoundLink[], postUrl?: string): FoundLink[] {
  const seen = new Set<string>();
  if (postUrl) seen.add(normalizeUrl(postUrl));
  const result: FoundLink[] = [];
  for (const link of links) {
    const url = unwrapRedirect(link.url);
    if (!/^https?:\/\//i.test(url) || isAttachment(url) || SHARE_LINK.test(url)) continue;
    if (postUrl && !isShortener(url) && (isSameSite(url, postUrl) || sharesPost(url, postUrl))) continue;
    const key = normalizeUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...link, url: stripTracking(url) });
  }
  return result;
}

// Collects href values from HTML. Mentions and hashtags are skipped when marked as such (Mastodon does).
// `only` keeps just the links whose tag matches it (e.g. LinkedIn marks the ones in a post's text).
export function anchorsFromHtml(html: string, base: string, only?: RegExp): string[] {
  const hrefs: string[] = [];
  for (const [tag] of html.matchAll(/<a\b[^>]*>/gi)) {
    if (/class=["'][^"']*\b(?:mention|hashtag)\b/i.test(tag)) continue;
    if (only && !only.test(tag)) continue;
    const href = tag.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const value = href?.[1] ?? href?.[2];
    if (!value) continue;
    try {
      hrefs.push(new URL(value.replace(/&amp;/g, '&'), base).href);
    } catch {
      // Not a usable address.
    }
  }
  return hrefs;
}

// The main article of a page, when it marks one; links outside it are menus and footers.
export function articleHtml(html: string): string | undefined {
  const start = html.search(/<article\b/i);
  if (start === -1) return undefined;
  const end = html.lastIndexOf('</article>');
  return html.slice(start, end > start ? end : undefined);
}

// Tab titles make clumsy labels: "(3) Someone on X: "the whole post…" / X" becomes "Someone on X".
export function cleanPostTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  let clean = title.replace(/^\(\d+\+?\)\s*/, '').trim();
  const onX = clean.match(/^(.+? on X): [“"]/);
  if (onX) clean = onX[1];
  clean = clean.replace(/\s*[|/•·-]\s*(?:X|Twitter|LinkedIn|Instagram|Threads|Facebook|Reddit)$/i, '');
  // LinkedIn's tab just says "Post", which says nothing.
  if (!clean || /^post$/i.test(clean)) return undefined;
  return clean.length > 90 ? clean.slice(0, 89) + '…' : clean;
}
