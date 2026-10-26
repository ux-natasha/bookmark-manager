import { isDeadLink, kindOf, type Bookmark } from './db';
import { hostnameOf } from './normalize';
import { platformById } from './platform';
import { fallbackColor } from './previews';

// The Covers theme sets every item as a cover built from its own details (docs/design/theme-covers.md, 4).
// Pure: the component renders whatever this returns.

export type CoverTemplate = 'article' | 'video' | 'post' | 'repo' | 'recipe' | 'dead' | 'proof' | 'quote' | 'picture' | 'note';

export interface CoverSpec {
  template: CoverTemplate;
  // The word screen readers hear after the title: "article", "video", "quote".
  kindWord: string;
  title: string;
  host: string;
  // Coloured templates only; the others have fixed colours in covers.css.
  background?: string;
  ink?: string;
  masthead?: string;
  kicker?: string;
  dek?: string;
  // Post: the first sentence large, the rest small.
  lead?: string;
  rest?: string;
  handle?: string;
  thread?: string;
  footer?: string;
  // Repo
  repoName?: string;
  repoPath?: string;
  languages?: string[];
  // Video
  duration?: string;
  // Recipe: "6 HOURS · SERVES 6"
  recipeLine?: string;
  // Quote: the source's colour, for the rule above the text.
  rule?: string;
}

const NEWSLETTER_PLATFORMS = new Set(['substack', 'ghost', 'medium', 'beehiiv']);
const VIDEO_PLATFORMS = new Set(['youtube', 'vimeo']);
const POST_PLATFORMS = new Set(['x', 'bluesky', 'threads', 'mastodon', 'linkedin', 'reddit']);
const REPO_PLATFORMS = new Set(['github', 'gitlab', 'codeberg']);
// Recipe sites that don't always publish schema.org Recipe data in the <head>.
const RECIPE_HOSTS = [
  'seriouseats.com',
  'bbcgoodfood.com',
  'allrecipes.com',
  'cooking.nytimes.com',
  'bonappetit.com',
  'epicurious.com',
  'food52.com',
  'smittenkitchen.com',
  'budgetbytes.com',
  'thekitchn.com',
];

const LIGHT_INK = '#F1EDE3';
const DARK_INK = '#15171A';
const DEFAULT_COVER = '#24453B';

export function coverFor(b: Bookmark): CoverSpec {
  const host = b.url ? hostnameOf(b.url) : '';
  const title = b.title || host;
  switch (kindOf(b)) {
    case 'quote':
      return { template: 'quote', kindWord: 'quote', title: b.text || b.title, host, rule: itemColor(b) };
    case 'image':
      return { template: 'picture', kindWord: 'picture', title: b.title, host };
    case 'note':
      return { template: 'note', kindWord: 'note', title: b.text || b.title, host };
  }

  if (isDeadLink(b)) return { template: 'dead', kindWord: 'link', title, host };
  if (!b.enrichedAt) return { template: 'proof', kindWord: 'link', title: 'Details on the way', host };

  const platform = b.platform ?? '';
  const platformLabel = platformById(platform)?.label ?? b.siteName ?? host;

  if (VIDEO_PLATFORMS.has(platform)) {
    const part = title.match(/\bpart\s+(\d+)\s+of\s+(\d+)\b/i);
    return {
      template: 'video',
      kindWord: 'video',
      title,
      host,
      kicker: [platformLabel.toUpperCase(), part && `PART ${part[1]} OF ${part[2]}`].filter(Boolean).join(' · '),
      duration: b.details?.duration ? formatDuration(b.details.duration) : undefined,
    };
  }

  if (POST_PLATFORMS.has(platform)) {
    const words = b.description || title;
    const lead = firstSentence(words);
    const thread = b.details?.thread;
    return {
      template: 'post',
      kindWord: 'post',
      title,
      host,
      handle: b.author ?? host,
      thread: thread ? `${thread.index} / ${thread.count}` : undefined,
      lead,
      rest: words.slice(lead.length).trim() || undefined,
      footer: `POST ON ${platformLabel.toUpperCase()}`,
    };
  }

  if (REPO_PLATFORMS.has(platform)) {
    const path = repoPath(b.url);
    return {
      template: 'repo',
      kindWord: 'repository',
      title,
      host,
      repoName: path?.split('/').pop() ?? title,
      repoPath: path ?? host,
      dek: b.description,
      languages: b.details?.language?.length ? b.details.language : undefined,
    };
  }

  if (b.details?.recipe || RECIPE_HOSTS.some((h) => host === h || host.endsWith('.' + h))) {
    return { template: 'recipe', kindWord: 'recipe', title, host, recipeLine: recipeLine(b.details?.recipe) };
  }

  const { background, ink } = coverColors(itemColor(b));
  return {
    template: 'article',
    kindWord: 'article',
    title,
    host,
    background,
    ink,
    masthead: b.siteName ?? platformById(platform)?.label ?? host,
    kicker: NEWSLETTER_PLATFORMS.has(platform) ? 'A NEWSLETTER' : host.toUpperCase(),
    dek: b.description ? firstSentence(b.description) : undefined,
  };
}

// The item's own colour. The Colour field theme will compute a better one; until then, the site's.
function itemColor(b: Bookmark): string {
  return fallbackColor(b);
}

// "PLATE 3": each picture's number among pictures, in save order.
export function plateNumbers(items: Bookmark[]): Map<string, number> {
  const pictures = items.filter((b) => kindOf(b) === 'image').sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return new Map(pictures.map((b, i) => [b.id, i + 1]));
}

export function firstSentence(text: string): string {
  const match = text.trim().match(/^[\s\S]*?[.!?…](?=\s|$)/);
  return (match ? match[0] : text).trim();
}

// "18:42", or "1:02:05" past an hour.
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const parts = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60];
  const [h, m, sec] = parts;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

// "owner/repo" from a GitHub-style URL.
function repoPath(url: string): string | undefined {
  try {
    const [owner, repo] = new URL(url).pathname.split('/').filter(Boolean);
    return owner && repo ? `${owner}/${repo.replace(/\.git$/, '')}` : undefined;
  } catch {
    return undefined;
  }
}

// "6 HOURS · SERVES 6" from schema.org totalTime (ISO 8601, "PT6H") and recipeYield.
export function recipeLine(recipe: { totalTime?: string; yield?: string } | undefined): string | undefined {
  if (!recipe) return undefined;
  const parts: string[] = [];
  const time = recipe.totalTime?.match(/^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (time && (time[1] || time[2])) {
    const hours = Number(time[1] ?? 0);
    const minutes = Number(time[2] ?? 0);
    const h = hours ? `${hours} ${hours === 1 ? 'HOUR' : 'HOURS'}` : '';
    const m = minutes ? `${minutes} MIN` : '';
    parts.push([h, m].filter(Boolean).join(' '));
  }
  const servings = recipe.yield?.trim();
  if (servings) parts.push(/^\d+$/.test(servings) ? `SERVES ${servings}` : servings.toUpperCase());
  return parts.length ? parts.join(' · ') : undefined;
}

// --- Colour and contrast ---

type Rgb = [number, number, number];

// Background and text for a coloured cover: whichever ink contrasts more, and at least 4.5:1.
// When neither does (mid-tones), the background darkens by 6% lightness at a time until light ink passes.
export function coverColors(color: string): { background: string; ink: string } {
  const rgb = parseColor(color) ?? parseColor(DEFAULT_COVER)!;
  const light = parseColor(LIGHT_INK)!;
  const dark = parseColor(DARK_INK)!;
  const onLight = contrast(rgb, light);
  const onDark = contrast(rgb, dark);
  if (Math.max(onLight, onDark) >= 4.5) return { background: toHex(rgb), ink: onLight >= onDark ? LIGHT_INK : DARK_INK };

  let [h, s, l] = rgbToHsl(rgb);
  let current = rgb;
  while (contrast(current, light) < 4.5 && l > 0) {
    l = Math.max(0, l - 0.06);
    current = hslToRgb(h, s, l);
  }
  return { background: toHex(current), ink: LIGHT_INK };
}

export function coverTextColor(color: string): string {
  return coverColors(color).ink;
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Hex (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba() and hsl()/hsla(), in either comma or space syntax.
// Alpha is ignored: a cover is opaque.
export function parseColor(value: string): Rgb | undefined {
  const text = value.trim().toLowerCase();
  const hex = text.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16)) as Rgb;
    if (hex.length === 6 || hex.length === 8) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
    return undefined;
  }
  const fn = text.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (!fn) return undefined;
  const args = fn[2].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
  if (args.length < 3) return undefined;
  if (fn[1].startsWith('rgb')) {
    const rgb = args.map((a) => (a.endsWith('%') ? (parseFloat(a) / 100) * 255 : parseFloat(a)));
    return rgb.some(Number.isNaN) ? undefined : (rgb.map((v) => Math.round(Math.min(255, Math.max(0, v)))) as Rgb);
  }
  const [h, s, l] = [parseFloat(args[0]), parseFloat(args[1]) / 100, parseFloat(args[2]) / 100];
  return [h, s, l].some(Number.isNaN) ? undefined : hslToRgb(h, s, l);
}

function toHex(rgb: Rgb): string {
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
