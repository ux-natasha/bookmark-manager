import { describe, expect, it } from 'vitest';
import { contrast, COVER_PALETTE, coverColors, coverFor, firstSentence, formatDuration, inkOf, itemColor, LIGHT_INK, mastheadFor, parseColor, plateNumbers, recipeLine } from './covers';
import type { Bookmark } from './db';

const link = (fields: Partial<Bookmark> = {}): Bookmark => ({
  id: 'b1',
  url: 'https://example.com/post',
  normalizedUrl: 'example.com/post',
  title: 'Why every team needs a decision log',
  note: '',
  tags: [],
  source: 'panel',
  createdAt: 1,
  updatedAt: 1,
  openCount: 0,
  enrichedAt: 2,
  ...fields,
});

describe('coverFor', () => {
  it('picks the template from the platform', () => {
    expect(coverFor(link()).template).toBe('article');
    expect(coverFor(link({ platform: 'youtube' })).template).toBe('video');
    expect(coverFor(link({ platform: 'vimeo' })).template).toBe('video');
    expect(coverFor(link({ platform: 'x' })).template).toBe('post');
    expect(coverFor(link({ platform: 'reddit' })).template).toBe('post');
    expect(coverFor(link({ platform: 'github' })).template).toBe('repo');
    expect(coverFor(link({ platform: 'codeberg' })).template).toBe('repo');
    expect(coverFor(link({ details: { recipe: {} } })).template).toBe('recipe');
    expect(coverFor(link({ url: 'https://www.seriouseats.com/ragu' })).template).toBe('recipe');
  });

  it('gives quotes, pictures and notes their own templates', () => {
    expect(coverFor(link({ kind: 'quote', text: 'Less, but better' }))).toMatchObject({ template: 'quote', title: 'Less, but better' });
    expect(coverFor(link({ kind: 'image' })).template).toBe('picture');
    expect(coverFor(link({ kind: 'note', url: '', text: 'Call the framer' }))).toMatchObject({ template: 'note', title: 'Call the framer' });
  });

  it('lets a dead link win over everything, and shows a proof while details are on the way', () => {
    expect(coverFor(link({ platform: 'youtube', linkStatus: 'gone' })).template).toBe('dead');
    expect(coverFor(link({ details: { recipe: {} }, linkStatus: 'unreachable', checkFailures: 2 })).template).toBe('dead');
    expect(coverFor(link({ enrichedAt: undefined })).template).toBe('proof');
  });

  it('marks newsletters, and falls back to the name in the hostname without a site name or description', () => {
    expect(coverFor(link({ platform: 'substack', siteName: 'Field Notes' }))).toMatchObject({ masthead: 'Field Notes', kicker: 'A NEWSLETTER' });
    expect(coverFor(link())).toMatchObject({ masthead: 'Example', kicker: 'EXAMPLE.COM', dek: undefined });
  });

  it('takes the first sentence of the description as the dek', () => {
    expect(coverFor(link({ description: 'Write it down. Then decide.' })).dek).toBe('Write it down.');
  });

  it('shows a video duration only when it is known, and the part from the title', () => {
    expect(coverFor(link({ platform: 'youtube' }))).toMatchObject({ kicker: 'YOUTUBE', duration: undefined });
    const video = coverFor(link({ platform: 'youtube', title: 'Kerning, part 2 of 3', details: { duration: 1122 } }));
    expect(video).toMatchObject({ kicker: 'YOUTUBE · PART 2 OF 3', duration: '18:42' });
  });

  it('splits a post into its first sentence and the rest', () => {
    const post = coverFor(link({ platform: 'x', author: 'Ana', description: 'Ship small. Then ship again, and again.' }));
    expect(post).toMatchObject({ handle: 'Ana', lead: 'Ship small.', rest: 'Then ship again, and again.', footer: 'POST ON X', thread: undefined });
  });

  it('reads the repo name and path from the URL', () => {
    const repo = coverFor(link({ platform: 'github', url: 'https://github.com/acme/tiny-notes' }));
    expect(repo).toMatchObject({ repoName: 'tiny-notes', repoPath: 'acme/tiny-notes', languages: undefined });
  });
});

describe('coverColors', () => {
  const passes = (c: { background: string; ink: string }) => contrast(parseColor(c.background)!, parseColor(c.ink)!) >= 4.5;

  it('uses light ink on dark covers and dark ink on light ones', () => {
    expect(coverColors('#24453B').ink).toBe('#F1EDE3');
    expect(coverColors('#F6EEDF').ink).toBe('#15171A');
  });

  it('darkens mid-tone covers until light ink passes 4.5:1', () => {
    const mid = coverColors('#7d7d7d');
    expect(mid.background).not.toBe('#7d7d7d');
    expect(mid.ink).toBe('#F1EDE3');
    expect(passes(mid)).toBe(true);
    for (const color of ['hsl(200 45% 55%)', 'hsl(30 45% 55%)', '#4d6fa3', 'rgb(196, 104, 138)']) {
      expect(passes(coverColors(color))).toBe(true);
    }
  });

  it('leaves room for the kicker and dek, which are set in the ink mixed 85% into the ground', () => {
    const mixed = (ink: string, ground: string) =>
      parseColor(ink)!.map((v, i) => Math.round(v * 0.85 + parseColor(ground)![i] * 0.15)) as [number, number, number];
    for (let l = 0; l <= 100; l += 5) {
      for (const hue of [0, 40, 120, 200, 280]) {
        const { background, ink } = coverColors(`hsl(${hue} 45% ${l}%)`);
        expect(contrast(parseColor(background)!, mixed(ink, background))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('reads hex, rgb and hsl, and falls back on anything else', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#24453Bcc')).toEqual([36, 69, 59]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
    expect(parseColor('hsl(0 100% 50%)')).toEqual([255, 0, 0]);
    expect(parseColor('papayawhip')).toBeUndefined();
    expect(passes(coverColors('papayawhip'))).toBe(true);
  });
});

describe('cover helpers', () => {
  it('numbers pictures among pictures, in save order', () => {
    const items = [
      link({ id: 'a', kind: 'image', createdAt: 30 }),
      link({ id: 'b', createdAt: 10 }),
      link({ id: 'c', kind: 'image', createdAt: 20 }),
    ];
    expect([...plateNumbers(items)]).toEqual([
      ['c', 1],
      ['a', 2],
    ]);
  });

  it('formats durations and recipe lines', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(recipeLine({ totalTime: 'PT6H', yield: '6' })).toBe('6 HOURS · SERVES 6');
    expect(recipeLine({ totalTime: 'PT1H30M', yield: '4 servings' })).toBe('1 HOUR 30 MIN · 4 SERVINGS');
    expect(recipeLine({})).toBeUndefined();
  });

  it('finds the first sentence, or keeps the whole text', () => {
    expect(firstSentence('One. Two.')).toBe('One.');
    expect(firstSentence('No full stop here')).toBe('No full stop here');
    expect(firstSentence('Version 2.0 is out! Try it.')).toBe('Version 2.0 is out!');
  });
});

describe('mastheadFor', () => {
  it('drops www and the suffix, and title-cases the rest', () => {
    expect(mastheadFor('hugeicons.com')).toBe('Hugeicons');
    expect(mastheadFor('www.example.org')).toBe('Example');
    expect(mastheadFor('bbc.co.uk')).toBe('Bbc');
    expect(mastheadFor('my-field-notes.net')).toBe('My Field Notes');
  });

  it('takes the name from the subdomain on publishing platforms', () => {
    expect(mastheadFor('fieldnotes.substack.com')).toBe('Fieldnotes');
    expect(mastheadFor('someone.github.io')).toBe('Someone');
    expect(mastheadFor('docs.hugeicons.com')).toBe('Hugeicons');
  });

  it("copes with hosts that aren't dotted", () => {
    expect(mastheadFor('localhost')).toBe('Localhost');
    expect(mastheadFor('')).toBe('');
  });
});

describe('cover colours for sites with no colour of their own', () => {
  it('prefer the colour read from the page, then the theme colour', () => {
    expect(coverFor(link({ color: '#1d3557', themeColor: '#7a1f1f' })).background).toBe('#1d3557');
    expect(coverFor(link({ themeColor: '#7a1f1f' })).background).toBe('#7a1f1f');
  });

  it('otherwise take a board colour chosen by the hostname, the same one every time', () => {
    const a = coverFor(link({ url: 'https://hugeicons.com/x' })).background;
    const b = coverFor(link({ url: 'https://hugeicons.com/y' })).background;
    expect(a).toBe(b);
    for (const host of ['a.com', 'b.org', 'c.net', 'd.io', 'e.dev', 'f.co']) {
      expect(COVER_PALETTE).toContain(itemColor(link({ url: `https://${host}/` })));
    }
  });
});

describe('inkOf', () => {
  it('follows the cover colours for articles, and is fixed for the other templates', () => {
    expect(inkOf({ template: 'article', kindWord: 'article', title: '', host: '', ink: LIGHT_INK })).toBe('light');
    expect(inkOf({ template: 'article', kindWord: 'article', title: '', host: '', ink: '#15171A' })).toBe('dark');
    expect(inkOf({ template: 'video', kindWord: 'video', title: '', host: '' })).toBe('light');
    expect(inkOf({ template: 'repo', kindWord: 'repository', title: '', host: '' })).toBe('light');
    expect(inkOf({ template: 'quote', kindWord: 'quote', title: '', host: '' })).toBe('dark');
  });
});
