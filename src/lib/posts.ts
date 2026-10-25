// Gets the links mentioned in a social post: from its link (using each platform's public data
// where there is one), from pasted text, or from the post you have open in a tab.

import { findByUrl } from './bookmarks';
import type { Bookmark } from './db';
import { parseHtmlMeta } from './metadata';
import { fetchKnownDetails, fetchPage } from './enrich';
import {
  anchorsFromHtml,
  articleHtml,
  cleanPostTitle,
  findUrlsInText,
  isAttachment,
  isSameSite,
  isShortener,
  redirectTargetFromHtml,
  tidyLinks,
  unwrapRedirect,
  type FoundLink,
} from './linkfinder';
import { isSaveableUrl, normalizeUrl, stripTracking } from './normalize';
import { detectPlatform } from './platform';

export interface PostLinks {
  links: FoundLink[];
  // The post itself, when known: links found in it remember where they came from.
  post?: { url: string; title?: string };
  // Links in the post were found by reading the whole page, not just the post (so expect some noise).
  wholePage?: boolean;
  // Why nothing (or not much) could be read, in words for the person.
  hint?: string;
}

const OPEN_IT_HINT =
  "This site only shows posts to people who are logged in. Open the post, click the extension icon, and choose “Find links in this post” in the side panel.";

async function getJson<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  try {
    const response = await fetch(url, { credentials: 'omit', ...init });
    return response.ok ? ((await response.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

// X: the public embed service returns the post's text with its links (as t.co short links).
async function readXPost(url: string): Promise<PostLinks | undefined> {
  if (!/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+/i.test(url)) return undefined;
  const data = await getJson<{ author_name?: string; html?: string }>(
    `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`,
  );
  if (!data?.html) return { links: [], post: { url }, hint: OPEN_IT_HINT };
  const text = data.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
  return {
    links: anchorsFromHtml(text, url).map((href) => ({ url: href })),
    post: { url, title: data.author_name ? `${data.author_name}'s post on X` : undefined },
  };
}

interface BlueskyThread {
  thread?: {
    post?: {
      author?: { handle?: string; displayName?: string };
      record?: { text?: string; facets?: { features?: { $type?: string; uri?: string }[] }[]; embed?: BlueskyEmbed };
    };
  };
}
interface BlueskyEmbed {
  $type?: string;
  external?: { uri?: string };
  media?: BlueskyEmbed;
}

// Bluesky: its public API gives the post with every link spelled out in full.
async function readBlueskyPost(url: string): Promise<PostLinks | undefined> {
  const match = url.match(/^https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/i);
  if (!match) return undefined;
  const uri = `at://${match[1]}/app.bsky.feed.post/${match[2]}`;
  const data = await getJson<BlueskyThread>(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?depth=0&parentHeight=0&uri=${encodeURIComponent(uri)}`,
  );
  const post = data?.thread?.post;
  if (!post?.record) return { links: [], post: { url }, hint: "Couldn't load this Bluesky post. It may have been deleted." };

  const links: FoundLink[] = [];
  for (const facet of post.record.facets ?? []) {
    for (const feature of facet.features ?? []) {
      if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) links.push({ url: feature.uri });
    }
  }
  const embed = post.record.embed;
  for (const e of [embed, embed?.media]) if (e?.external?.uri) links.push({ url: e.external.uri });
  links.push(...findUrlsInText(post.record.text ?? ''));

  const name = post.author?.displayName || post.author?.handle;
  return { links, post: { url, title: name ? `${name}'s post on Bluesky` : undefined } };
}

// Mastodon (any server): every server has the same public API for posts.
async function readMastodonPost(url: string): Promise<PostLinks | undefined> {
  const match = url.match(/^(https?:\/\/[^/]+)\/@[^/]+\/(\d+)\/?$/i);
  if (!match) return undefined;
  const data = await getJson<{ content?: string; card?: { url?: string }; account?: { display_name?: string; acct?: string } }>(
    `${match[1]}/api/v1/statuses/${match[2]}`,
  );
  if (!data?.content) return undefined;
  const links = anchorsFromHtml(data.content, url).map((href) => ({ url: href }));
  if (data.card?.url) links.push({ url: data.card.url });
  const name = data.account?.display_name || data.account?.acct;
  return { links, post: { url, title: name ? `${name}'s post on Mastodon` : undefined } };
}

interface RedditListing {
  data?: { children?: { data?: { title?: string; is_self?: boolean; url?: string; selftext?: string; author?: string } }[] };
}

// Reddit: adding .json to a post's address returns the post. Reddit sometimes refuses
// requests that aren't logged in, so this one is sent with your Reddit login.
async function readRedditPost(url: string): Promise<PostLinks | undefined> {
  const id = url.match(/reddit\.com\/(?:r\/[^/]+\/)?comments\/([a-z0-9]+)/i)?.[1] ?? url.match(/redd\.it\/([a-z0-9]+)/i)?.[1];
  if (!id) return undefined;
  const data = await getJson<RedditListing[]>(`https://www.reddit.com/comments/${id}.json?raw_json=1&limit=1`, {
    credentials: 'include',
  });
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post) return { links: [], post: { url }, hint: OPEN_IT_HINT };
  const links = findUrlsInText(post.selftext ?? '');
  if (!post.is_self && post.url) links.unshift({ url: post.url });
  return { links, post: { url, title: post.title } };
}

// Hacker News: the official API gives the submitted link and the post's text.
async function readHackerNewsPost(url: string): Promise<PostLinks | undefined> {
  const id = url.match(/news\.ycombinator\.com\/item\?id=(\d+)/i)?.[1];
  if (!id) return undefined;
  const data = await getJson<{ title?: string; url?: string; text?: string }>(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
  );
  if (!data) return undefined;
  const links: FoundLink[] = data.url ? [{ url: data.url }] : [];
  if (data.text) links.push(...anchorsFromHtml(data.text, url).map((href) => ({ url: href })));
  return { links, post: { url, title: data.title } };
}

// LinkedIn: public posts can be read without logging in, and the page marks which links are in the post's text
// (the rest are menus, comments and sign-up buttons).
async function readLinkedInPost(url: string): Promise<PostLinks | undefined> {
  if (!/^https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:posts|feed\/update|pulse)\//i.test(url)) return undefined;
  const page = await fetchPage(url, { full: true });
  if (page.status !== 'ok' || !page.html) return { links: [], post: { url }, hint: OPEN_IT_HINT };
  const meta = parseHtmlMeta(page.html, page.finalUrl);
  const links = anchorsFromHtml(page.html, page.finalUrl, /public_post-text|article-body/).map((href) => ({ url: href }));
  if (!links.length) links.push(...findUrlsInText(meta.description ?? ''));
  return { links, post: { url, title: cleanPostTitle(meta.title) }, hint: OPEN_IT_HINT };
}

const PLATFORM_READERS = [readXPost, readBlueskyPost, readMastodonPost, readRedditPost, readHackerNewsPost, readLinkedInPost];

async function readWithPlatformReader(url: string): Promise<PostLinks | undefined> {
  for (const read of PLATFORM_READERS) {
    const result = await read(url);
    if (result) return result;
  }
  return undefined;
}

// Anything else: the page's own summary (which on LinkedIn and Threads holds the post's text),
// plus, for articles, the links inside the article.
async function readGenericPage(url: string): Promise<PostLinks> {
  const page = await fetchPage(url, { full: true });
  if (!page.html) {
    return { links: [], post: { url }, hint: page.status === 'unreachable' ? "Couldn't reach this page." : OPEN_IT_HINT };
  }
  const meta = parseHtmlMeta(page.html, page.finalUrl);
  const social = detectPlatform(page.finalUrl)?.social;
  const links = findUrlsInText(meta.description ?? '');
  const article = social ? undefined : articleHtml(page.html);
  if (article) links.push(...anchorsFromHtml(article, page.finalUrl).map((href) => ({ url: href })));
  return {
    links,
    post: { url, title: meta.title },
    wholePage: !social,
    hint: social ? OPEN_IT_HINT : undefined,
  };
}

function finish(result: PostLinks): PostLinks {
  const links = tidyLinks(result.links, result.post?.url);
  // A hint is only worth showing when it explains an empty result.
  return { ...result, links, hint: links.length ? undefined : result.hint };
}

// From a post's link pasted into the library.
export async function linksFromPostUrl(url: string): Promise<PostLinks> {
  const resolved = isShortener(url) ? (await followShortLink(url)) ?? url : unwrapRedirect(url);
  return finish((await readWithPlatformReader(resolved)) ?? (await readGenericPage(resolved)));
}

// From a post's text pasted into the library.
export function linksFromText(text: string): PostLinks {
  return finish({ links: findUrlsInText(text), hint: 'No links found in this text.' });
}

// True when the pasted text is just one link (to a post), rather than a post's text.
export function isSingleLink(text: string): boolean {
  const trimmed = text.trim();
  return !/\s/.test(trimmed) && isSaveableUrl(trimmed);
}

interface LiveRead {
  anchors: string[];
  text: string;
  wholePage: boolean;
}

// Runs inside the page you're looking at. It can't use anything from outside this function.
function readOpenPost(): LiveRead {
  const host = location.hostname;
  let root: Element | null = null;
  if (/(^|\.)(x|twitter)\.com$/.test(host)) {
    // On a post's page the post itself is the article whose timestamp links to this address.
    const id = location.pathname.match(/status\/(\d+)/)?.[1];
    const articles = [...document.querySelectorAll('article[data-testid="tweet"]')];
    root = articles.find((a) => id && a.querySelector(`a[href*="/status/${id}"] time`)) ?? articles[0] ?? null;
  } else if (/(^|\.)reddit\.com$/.test(host)) {
    root = document.querySelector('shreddit-post') ?? document.querySelector('[data-test-id="post-content"]');
  } else if (/(^|\.)threads\.(net|com)$/.test(host)) {
    root = document.querySelector('[data-pressable-container="true"]');
  } else if (/(^|\.)linkedin\.com$/.test(host)) {
    root = document.querySelector('.feed-shared-update-v2, [data-urn*="activity"]');
  }
  root ??= document.querySelector('article') ?? document.querySelector('main') ?? document.body;

  const anchors = [...root.querySelectorAll('a[href]')].map((a) => (a as HTMLAnchorElement).href);
  // Reddit link posts keep their link in an attribute rather than an <a>.
  const contentHref = root.getAttribute('content-href');
  if (contentHref) anchors.push(contentHref);

  // Text outside links, for addresses written out in the post ("check out figma.com").
  // Link text is skipped because sites show it shortened ("figma.com/commu…").
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('a, script, style, noscript') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode() && text.length < 200_000) text += walker.currentNode.textContent + ' ';

  return { anchors, text, wholePage: root === document.body || root.tagName === 'MAIN' };
}

// From the post you're looking at, read straight from the page (works with logged-in-only posts).
export async function linksFromOpenTab(tab: { id?: number; url?: string; title?: string }): Promise<PostLinks> {
  if (!tab.url || tab.id === undefined) return { links: [], hint: "Couldn't read this page." };
  const post = { url: tab.url, title: cleanPostTitle(tab.title) };

  // Where a platform has public data for its posts it's cleaner than reading the page.
  if (!/(^|\.)(x|twitter)\.com$/.test(new URL(tab.url).hostname)) {
    const fromPlatform = await readWithPlatformReader(tab.url);
    if (fromPlatform && fromPlatform.links.length) return finish({ ...fromPlatform, post });
  }

  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readOpenPost });
    const live = result?.result as LiveRead | undefined;
    if (live) {
      const links = [...live.anchors.map((url) => ({ url })), ...findUrlsInText(live.text)];
      const found = finish({ links, post, wholePage: live.wholePage });
      if (found.links.length) return found;
    }
  } catch {
    // Pages the browser protects (extension stores, browser pages) can't be read.
  }
  return finish((await readWithPlatformReader(tab.url)) ?? { links: [], post, hint: 'No links found in this post.' });
}

async function followShortLink(url: string): Promise<string | undefined> {
  let page = await fetchPage(url);
  if (page.status === 'unreachable') return undefined;
  let target = isShortener(page.finalUrl) && page.html ? redirectTargetFromHtml(page.html) : undefined;
  // Stuck on the shortener's own page: the real address is further down it (lnkd.in's button).
  if (!target && isShortener(page.finalUrl)) {
    page = await fetchPage(url, { full: true });
    target = page.html ? redirectTargetFromHtml(page.html) : undefined;
    if (!target) return undefined;
  }
  return stripTracking(unwrapRedirect(target ?? page.finalUrl));
}

export interface Candidate {
  // The link as found in the post (a short link, before following it).
  foundUrl: string;
  // The address that will be saved.
  url: string;
  title?: string;
  status: 'checking' | 'ready' | 'unreachable';
  truncated?: boolean;
  // Already in the library.
  existing?: Bookmark;
  // Turned out to be a link back to the post's own site, or a repeat, once the short link was followed.
  skip?: boolean;
}

// Follows short links, checks the library for duplicates, and fetches the title of new links.
export async function inspectLink(link: FoundLink, postUrl?: string): Promise<Candidate> {
  const base: Candidate = { foundUrl: link.url, url: link.url, status: 'checking', truncated: link.truncated };

  if (isShortener(link.url)) {
    const target = await followShortLink(link.url);
    if (!target) return { ...base, status: 'unreachable' };
    base.url = target;
    if (isAttachment(target) || (postUrl && (isSameSite(target, postUrl) || normalizeUrl(target) === normalizeUrl(postUrl)))) {
      return { ...base, status: 'ready', skip: true };
    }
  }

  const existing = await findByUrl(base.url);
  if (existing) return { ...base, status: 'ready', existing, title: existing.title };

  const page = await fetchPage(base.url);
  // A title from an error or "checking your browser" page ("Just a moment…") isn't the page's title.
  const meta = page.html && page.status === 'ok' ? parseHtmlMeta(page.html, page.finalUrl) : undefined;
  const known = await fetchKnownDetails(base.url);
  return {
    ...base,
    status: page.status === 'unreachable' ? 'unreachable' : 'ready',
    title: known?.title ?? meta?.title,
  };
}
