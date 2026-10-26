import { hashColor, parseColor, toHex } from './color';
import { kindOf, type Bookmark } from './db';
import { hostnameOf } from './normalize';

// One colour per item, as hex (docs/design/theme-colour-field.md, 3, "Fallbacks"):
// its own colour, then the site's theme colour, then a stable colour from the hostname.
// Quotes take their page's colour; notes, their first coloured tag's.

// The Default tag colours (base.css --tag-1 … --tag-8).
export const TAG_COLORS = ['#c47a52', '#4d6fa3', '#c4688a', '#5f98a8', '#b4893f', '#6f8a3e', '#8a857a', '#7b93c4'];
const NOTE_COLOR = '#7b93c4';

function ownColor(b: Bookmark): string | undefined {
  if (b.color) return b.color;
  const theme = parseColor(b.themeColor);
  return theme && toHex(theme);
}

export function itemColors(bookmarks: Bookmark[], slotOf: (tag: string) => number | undefined): Map<string, string> {
  const pages = new Map<string, string>();
  for (const b of bookmarks) {
    const own = ownColor(b);
    if (own && kindOf(b) === 'link' && b.normalizedUrl) pages.set(b.normalizedUrl, own);
  }
  const colors = new Map<string, string>();
  for (const b of bookmarks) {
    const kind = kindOf(b);
    let color = ownColor(b);
    if (!color && kind === 'quote') color = pages.get(b.normalizedUrl);
    if (!color && kind === 'note') {
      const slot = b.tags.map(slotOf).find((s) => s !== undefined);
      color = slot ? TAG_COLORS[slot - 1] : NOTE_COLOR;
    }
    colors.set(b.id, color ?? hashColor(hostnameOf(b.url)));
  }
  return colors;
}
