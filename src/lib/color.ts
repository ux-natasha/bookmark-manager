// An item's colour, for the Colour field theme (docs/design/theme-colour-field.md, 3): the halo behind its
// card, the room's light, and search by colour. Pure functions; the canvas work is in colorPass.ts.

export type BucketId = 'red' | 'coral' | 'gold' | 'green' | 'teal' | 'blue' | 'violet' | 'pink' | 'grey' | 'charcoal';

// Hue ranges in degrees, start inclusive. Red wraps round 0.
export const BUCKETS: { id: BucketId; label: string; from?: number; to?: number }[] = [
  { id: 'red', label: 'Red', from: 345, to: 15 },
  { id: 'coral', label: 'Coral', from: 15, to: 35 },
  { id: 'gold', label: 'Gold', from: 35, to: 65 },
  { id: 'green', label: 'Green', from: 65, to: 170 },
  { id: 'teal', label: 'Teal', from: 170, to: 200 },
  { id: 'blue', label: 'Blue', from: 200, to: 250 },
  { id: 'violet', label: 'Violet', from: 250, to: 300 },
  { id: 'pink', label: 'Pink', from: 300, to: 345 },
  { id: 'grey', label: 'Grey' },
  { id: 'charcoal', label: 'Charcoal' },
];

const GREY_SATURATION = 0.15;
const CHARCOAL_LIGHTNESS = 0.18;

export type Rgb = [r: number, g: number, b: number];

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

// #rgb, #rrggbb (#rrggbbaa ignores the alpha), rgb() and hsl(). Anything else is undefined.
export function parseColor(value: string | undefined): Rgb | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4})$/.exec(v);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as Rgb;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(v);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as Rgb;
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(v);
  if (m) return hslToRgb(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
  return undefined;
}

export function rgbToHsl([r, g, b]: Rgb): [h: number, s: number, l: number] {
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

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function bucketOf(color: string): BucketId {
  const rgb = parseColor(color) ?? [128, 128, 128];
  const [h, s, l] = rgbToHsl(rgb);
  if (l < CHARCOAL_LIGHTNESS) return 'charcoal';
  if (s < GREY_SATURATION || l > 0.96) return 'grey';
  for (const b of BUCKETS) {
    if (b.from === undefined || b.to === undefined) continue;
    if (b.from > b.to ? h >= b.from || h < b.to : h >= b.from && h < b.to) return b.id;
  }
  return 'red';
}

// The colour a picture reads as (3, steps 2–4): leave out near-white, near-black and grey pixels, put the rest
// in 12 hue bins weighted by saturation, and take the mean of the heaviest bin. Pixels are RGBA, as in ImageData.
export function dominantColor(pixels: ArrayLike<number>): string | undefined {
  const bins = Array.from({ length: 12 }, () => ({ weight: 0, r: 0, g: 0, b: 0, n: 0 }));
  const counts = new Map<string, { n: number; rgb: Rgb }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb: Rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    // For the fallback: the most common colour, a little coarsened so near-identical pixels count together.
    const key = rgb.map((v) => v >> 3).join(',');
    const entry = counts.get(key) ?? { n: 0, rgb };
    entry.n++;
    counts.set(key, entry);
    const [h, s, l] = rgbToHsl(rgb);
    if (s < 0.12 || l > 0.94 || l < 0.06) continue;
    const bin = bins[Math.floor(h / 30) % 12];
    bin.weight += s;
    bin.r += rgb[0];
    bin.g += rgb[1];
    bin.b += rgb[2];
    bin.n++;
  }
  const best = bins.reduce((a, b) => (b.weight > a.weight ? b : a));
  if (best.n) return toHex([best.r / best.n, best.g / best.n, best.b / best.n]);
  let common: { n: number; rgb: Rgb } | undefined;
  for (const c of counts.values()) if (!common || c.n > common.n) common = c;
  return common && toHex(common.rgb);
}

export interface Swatch {
  bucket: BucketId;
  label: string;
  // The mean colour of what's in the bucket.
  color: string;
  count: number;
  // Σ freshness; what the room is lit by.
  score: number;
}

// Buckets with at least one item, in the order of BUCKETS. freshness is 1 − patina (1 until ageing exists).
export function swatches(items: { color: string; freshness?: number }[]): Swatch[] {
  const sums = new Map<BucketId, { r: number; g: number; b: number; n: number; score: number }>();
  for (const { color, freshness = 1 } of items) {
    const rgb = parseColor(color);
    if (!rgb) continue;
    const bucket = bucketOf(color);
    const sum = sums.get(bucket) ?? { r: 0, g: 0, b: 0, n: 0, score: 0 };
    sum.r += rgb[0];
    sum.g += rgb[1];
    sum.b += rgb[2];
    sum.n++;
    sum.score += freshness;
    sums.set(bucket, sum);
  }
  return BUCKETS.filter((b) => sums.has(b.id)).map((b) => {
    const sum = sums.get(b.id)!;
    return { bucket: b.id, label: b.label, color: toHex([sum.r / sum.n, sum.g / sum.n, sum.b / sum.n]), count: sum.n, score: sum.score };
  });
}

// The room's five fields (5.1): the highest-scoring buckets' colours. Fewer than five repeat.
export function fieldColors(items: { color: string; freshness?: number }[], count = 5): string[] {
  const top = swatches(items)
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.color);
  if (!top.length) return [];
  return Array.from({ length: count }, (_, i) => top[i % top.length]);
}

// For hostnames with no colour of their own: a stable hue from the name.
export function hashColor(text: string): string {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return toHex(hslToRgb(Math.abs(hash) % 360, 0.45, 0.55));
}
