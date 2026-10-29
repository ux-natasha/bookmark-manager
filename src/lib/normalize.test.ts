import { describe, expect, it } from 'vitest';
import { isProtectedPage, mediaFileOf, normalizeUrl, titleFromFileName } from './normalize';

const same = (a: string, b: string) => expect(normalizeUrl(a)).toBe(normalizeUrl(b));
const different = (a: string, b: string) => expect(normalizeUrl(a)).not.toBe(normalizeUrl(b));

describe('normalizeUrl', () => {
  it('ignores protocol, www, mobile subdomains and trailing slashes', () => {
    same('http://www.example.com/page/', 'https://example.com/page');
    same('https://m.example.com/page', 'https://example.com/page');
    same('https://example.com/', 'https://EXAMPLE.com');
  });

  it('strips tracking params but keeps real ones, in any order', () => {
    same('https://example.com/a?utm_source=x&id=5&fbclid=abc', 'https://example.com/a?id=5');
    same('https://example.com/a?b=2&a=1', 'https://example.com/a?a=1&b=2');
    different('https://example.com/a?id=5', 'https://example.com/a?id=6');
  });

  it('keeps short params that mean something on ordinary sites', () => {
    different('https://blog.example.com/?s=design', 'https://blog.example.com/?s=type');
  });

  it('treats twitter.com and x.com share links as the same post', () => {
    same('https://twitter.com/user/status/123?s=20&t=abc', 'https://x.com/user/status/123');
  });

  it('matches youtu.be short links to youtube watch links', () => {
    same('https://youtu.be/dQw4w9WgXcQ?si=xyz', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    different('https://youtube.com/watch?v=a', 'https://youtube.com/watch?v=b');
  });

  it('recognises extension store pages, which browsers protect from extensions', () => {
    expect(isProtectedPage('https://chromewebstore.google.com/detail/abc/xyz')).toBe(true);
    expect(isProtectedPage('https://chrome.google.com/webstore/detail/abc')).toBe(true);
    expect(isProtectedPage('https://microsoftedge.microsoft.com/addons/detail/abc')).toBe(true);
    expect(isProtectedPage('https://microsoftedge.microsoft.com/insider')).toBe(false);
    expect(isProtectedPage('https://example.com')).toBe(false);
  });

  it('drops plain anchors but keeps single-page-app hash routes', () => {
    same('https://example.com/doc#section-2', 'https://example.com/doc');
    different('https://app.example.com/#/inbox', 'https://app.example.com/#/settings');
  });
});

describe('mediaFileOf', () => {
  it('recognises GIF and video files by extension', () => {
    expect(mediaFileOf('https://i.giphy.com/abc/funny.gif')).toBe('gif');
    expect(mediaFileOf('https://example.com/clip.MP4?x=1')).toBe('video');
    expect(mediaFileOf('https://example.com/clip.webm')).toBe('video');
  });

  it('ignores ordinary pages', () => {
    expect(mediaFileOf('https://example.com/article')).toBeUndefined();
    expect(mediaFileOf('not a url')).toBeUndefined();
  });
});

describe('titleFromFileName', () => {
  it('turns a file name into readable words', () => {
    expect(titleFromFileName('https://example.com/a/cat-falls_off%20table.gif')).toBe('cat falls off table');
    expect(titleFromFileName('https://example.com/')).toBeUndefined();
  });
});
