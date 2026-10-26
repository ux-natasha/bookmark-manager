// Reads the details a page publishes about itself: the same tags that make link previews
// in iMessage or Slack (Open Graph, Twitter cards), plus a few standard ones.
// Works on raw HTML text because the background script has no DOM to parse with.

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  author?: string;
  publishedAt?: number;
  type?: string;
  themeColor?: string;
  canonicalUrl?: string;
  generator?: string;
  // Video length in seconds (video:duration, or itemprop="duration" as ISO 8601).
  duration?: number;
  // schema.org Recipe data from JSON-LD. An empty object means "a recipe, without those fields".
  recipe?: { totalTime?: string; yield?: string };
  // Raw hints used by platform detection (e.g. Substack sites on their own domains).
  hints: string[];
}

// Only the <head> matters, and some pages are huge, so stop reading after this much.
export const MAX_HTML_BYTES = 600_000;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", hellip: '…',
  mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', bull: '•',
  laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', times: '×', euro: '€', pound: '£', deg: '°',
  eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', oacute: 'ó', uuml: 'ü', ouml: 'ö', auml: 'ä', ntilde: 'ñ',
  ccedil: 'ç', szlig: 'ß',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, code: string) => {
    const lower = code.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower];
    if (lower.startsWith('#x')) return safeCodePoint(parseInt(lower.slice(2), 16), match);
    if (lower.startsWith('#')) return safeCodePoint(parseInt(lower.slice(1), 10), match);
    return match;
  });
}

function safeCodePoint(code: number, fallback: string): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
}

function clean(value: string | undefined, maxLength = 500): string | undefined {
  if (!value) return undefined;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  for (const m of tag.matchAll(pattern)) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function resolve(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined;
  try {
    const resolved = new URL(decodeEntities(url.trim()), base);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : undefined;
  } catch {
    return undefined;
  }
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
}

export function parseHtmlMeta(html: string, pageUrl: string): PageMeta {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = headEnd === -1 ? html.slice(0, MAX_HTML_BYTES) : html.slice(0, headEnd);

  // First value wins for each key, matching how most link-preview services behave.
  const meta = new Map<string, string>();
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase();
    const content = attrs.content;
    if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
  }

  const links = new Map<string, string>();
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag);
    const rel = (attrs.rel ?? '').toLowerCase();
    if (rel && attrs.href && !links.has(rel)) links.set(rel, attrs.href);
  }

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const base = resolve(head.match(/<base\b[^>]*href=["']([^"']+)["']/i)?.[1], pageUrl) ?? pageUrl;

  const get = (...keys: string[]) => keys.map((k) => meta.get(k)).find((v) => v && v.trim());

  const hints: string[] = [];
  if (/substackcdn\.com|substack\.com\/(?:api|embed)|"substack"/i.test(head)) hints.push('substack');
  if (/cdn-client\.medium\.com|miro\.medium\.com/i.test(head)) hints.push('medium');
  if (/ghost\.(?:io|org)/i.test(get('generator') ?? '')) hints.push('ghost');

  const author = get('author', 'article:author', 'twitter:creator', 'parsely-author', 'sailthru.author');

  return {
    title: clean(get('og:title', 'twitter:title') ?? titleTag, 300),
    description: clean(get('og:description', 'twitter:description', 'description')),
    image: resolve(get('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'), base),
    siteName: clean(get('og:site_name', 'application-name', 'apple-mobile-web-app-title'), 100),
    // article:author is often a profile URL rather than a name; skip those.
    author: author && !/^https?:\/\//.test(author) ? clean(author, 100) : undefined,
    publishedAt: parseDate(get('article:published_time', 'datepublished', 'date', 'pubdate', 'publish-date')),
    type: clean(get('og:type'), 50)?.toLowerCase(),
    themeColor: clean(get('theme-color'), 30),
    canonicalUrl: resolve(links.get('canonical') ?? get('og:url'), base),
    generator: clean(get('generator'), 100),
    duration: parseDuration(get('video:duration', 'og:video:duration', 'duration')),
    recipe: findRecipe(head),
    hints,
  };
}

// Seconds, from a plain number or an ISO 8601 duration ("PT18M42S").
export function parseDuration(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const text = value.trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text) || undefined;
  const m = text.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!m || !m.slice(1).some(Boolean)) return undefined;
  const [d, h, min, sec] = m.slice(1).map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + sec || undefined;
}

// The first schema.org Recipe in the page's JSON-LD, including ones inside @graph or arrays.
export function findRecipe(head: string): PageMeta['recipe'] {
  for (const [, json] of head.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    const recipe = findOfType(data, 'Recipe');
    if (!recipe) continue;
    const rawYield = Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield;
    return {
      totalTime: typeof recipe.totalTime === 'string' ? recipe.totalTime : undefined,
      yield: typeof rawYield === 'string' || typeof rawYield === 'number' ? String(rawYield) : undefined,
    };
  }
  return undefined;
}

function findOfType(node: unknown, type: string, depth = 0): Record<string, unknown> | undefined {
  if (!node || typeof node !== 'object' || depth > 4) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findOfType(item, type, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const record = node as Record<string, unknown>;
  const types = ([] as unknown[]).concat(record['@type']);
  if (types.includes(type)) return record;
  return findOfType(record['@graph'], type, depth + 1);
}
