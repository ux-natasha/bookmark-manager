import { describe, expect, it } from 'vitest';
import { contrast, coverColors, coverFor, firstSentence, formatDuration, parseColor, plateNumbers, recipeLine } from './covers';
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

  it('marks newsletters, and falls back to the hostname without a site name or description', () => {
    expect(coverFor(link({ platform: 'substack', siteName: 'Field Notes' }))).toMatchObject({ masthead: 'Field Notes', kicker: 'A NEWSLETTER' });
    expect(coverFor(link())).toMatchObject({ masthead: 'example.com', kicker: 'EXAMPLE.COM', dek: undefined });
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
