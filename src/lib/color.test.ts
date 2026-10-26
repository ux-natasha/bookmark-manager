import { describe, expect, it } from 'vitest';
import { bucketOf, dominantColor, fieldColors, parseColor, swatches } from './color';
import type { Bookmark } from './db';
import { itemColors, TAG_COLORS } from './itemColor';

const pixels = (...colors: [number, number, number][]) => colors.flatMap(([r, g, b]) => [r, g, b, 255]);

describe('bucketOf', () => {
  it('sorts hues into their buckets, with red wrapping round 0', () => {
    expect(bucketOf('#ff0000')).toBe('red');
    expect(bucketOf('hsl(350 80% 50%)')).toBe('red');
    expect(bucketOf('hsl(14 80% 50%)')).toBe('red');
    expect(bucketOf('hsl(15 80% 50%)')).toBe('coral');
    expect(bucketOf('hsl(50 80% 50%)')).toBe('gold');
    expect(bucketOf('hsl(120 60% 40%)')).toBe('green');
    expect(bucketOf('hsl(185 60% 40%)')).toBe('teal');
    expect(bucketOf('hsl(220 60% 50%)')).toBe('blue');
    expect(bucketOf('hsl(270 60% 50%)')).toBe('violet');
    expect(bucketOf('hsl(320 60% 50%)')).toBe('pink');
  });

  it('calls dark colours charcoal and washed-out ones grey', () => {
    expect(bucketOf('#101418')).toBe('charcoal');
    expect(bucketOf('#202a5a')).toBe('blue');
    expect(bucketOf('#8a8a8f')).toBe('grey');
    expect(bucketOf('#ffffff')).toBe('grey');
  });
});

describe('parseColor', () => {
  it('reads hex, rgb() and hsl()', () => {
    expect(parseColor('#abc')).toEqual([170, 187, 204]);
    expect(parseColor('#112233cc')).toEqual([17, 34, 51]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColor('hsl(0 100% 50%)')?.map(Math.round)).toEqual([255, 0, 0]);
    expect(parseColor('papayawhip')).toBeUndefined();
  });
});

describe('dominantColor', () => {
  it('takes the most saturated hue, ignoring white, black and grey', () => {
    const blue: [number, number, number] = [40, 90, 200];
    const image = pixels([255, 255, 255], [255, 255, 255], [0, 0, 0], [128, 128, 128], blue, blue, [230, 120, 40]);
    expect(dominantColor(image)).toBe('#285ac8');
  });

  it('falls back to the most common colour when everything is grey', () => {
    expect(dominantColor(pixels([250, 250, 250], [30, 30, 30], [30, 30, 30]))).toBe('#1e1e1e');
  });

  it('skips transparent pixels and returns nothing for an empty image', () => {
    expect(dominantColor([255, 0, 0, 0])).toBeUndefined();
    expect(dominantColor([])).toBeUndefined();
  });
});

describe('swatches and fieldColors', () => {
  it('counts buckets and averages their colours', () => {
    const result = swatches([{ color: '#2050c0' }, { color: '#3060d0' }, { color: '#e04040' }]);
    expect(result.map((s) => [s.bucket, s.count])).toEqual([
      ['red', 1],
      ['blue', 2],
    ]);
    expect(result[1].color).toBe('#2858c8');
  });

  it('lights the room with the freshest buckets, not the biggest', () => {
    const items = [
      { color: '#2050c0', freshness: 0.1 },
      { color: '#2050c0', freshness: 0.1 },
      { color: '#e04040', freshness: 1 },
    ];
    expect(fieldColors(items, 2)).toEqual(['#e04040', '#2050c0']);
    expect(fieldColors([{ color: '#e04040' }], 3)).toEqual(['#e04040', '#e04040', '#e04040']);
    expect(fieldColors([])).toEqual([]);
  });
});

describe('itemColors', () => {
  const base: Omit<Bookmark, 'id' | 'url' | 'normalizedUrl'> = { title: '', note: '', tags: [], source: 'panel', createdAt: 0, updatedAt: 0, openCount: 0 };
  const make = (b: Partial<Bookmark> & { id: string }): Bookmark => ({ url: '', normalizedUrl: '', ...base, ...b });

  it('uses its own colour, then the theme colour, then one from the hostname', () => {
    const colors = itemColors(
      [
        make({ id: 'a', url: 'https://a.test/', color: '#123456', themeColor: '#ff0000' }),
        make({ id: 'b', url: 'https://b.test/', color: '', themeColor: 'rgb(255, 0, 0)' }),
        make({ id: 'c', url: 'https://c.test/' }),
      ],
      () => undefined,
    );
    expect(colors.get('a')).toBe('#123456');
    expect(colors.get('b')).toBe('#ff0000');
    expect(colors.get('c')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('gives quotes their page’s colour and notes their tag’s', () => {
    const colors = itemColors(
      [
        make({ id: 'page', url: 'https://p.test/x', normalizedUrl: 'p.test/x', color: '#336699' }),
        make({ id: 'quote', kind: 'quote', url: 'https://p.test/x', normalizedUrl: 'p.test/x' }),
        make({ id: 'note', kind: 'note', tags: ['plain', 'work'] }),
        make({ id: 'bare', kind: 'note' }),
      ],
      (tag) => (tag === 'work' ? 3 : undefined),
    );
    expect(colors.get('quote')).toBe('#336699');
    expect(colors.get('note')).toBe(TAG_COLORS[2]);
    expect(colors.get('bare')).toBe('#7b93c4');
  });
});
