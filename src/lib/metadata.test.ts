import { describe, expect, it } from 'vitest';
import { decodeEntities, parseHtmlMeta } from './metadata';
import { detectPlatform } from './platform';

const page = (head: string) => `<!doctype html><html><head>${head}</head><body><meta property="og:title" content="body tag, ignored"></body></html>`;

describe('parseHtmlMeta', () => {
  it('prefers Open Graph tags and resolves relative image links', () => {
    const meta = parseHtmlMeta(
      page(`
        <title>Plain title</title>
        <meta property="og:title" content="OG &amp; title">
        <meta name="description" content="Plain description">
        <meta property='og:description' content='OG description'>
        <meta property="og:image" content="/img/cover.png">
        <meta property="og:site_name" content="Example Mag">
        <meta name="theme-color" content="#ff6600">
        <link rel="canonical" href="https://example.com/post">
      `),
      'https://example.com/post?utm_source=x',
    );
    expect(meta.title).toBe('OG & title');
    expect(meta.description).toBe('OG description');
    expect(meta.image).toBe('https://example.com/img/cover.png');
    expect(meta.siteName).toBe('Example Mag');
    expect(meta.themeColor).toBe('#ff6600');
    expect(meta.canonicalUrl).toBe('https://example.com/post');
  });

  it('falls back to <title> and handles attributes in any order', () => {
    const meta = parseHtmlMeta(page(`<title>  Just a\n title </title><meta content="Desc" name="description">`), 'https://a.com');
    expect(meta.title).toBe('Just a title');
    expect(meta.description).toBe('Desc');
  });

  it('ignores author URLs and parses publish dates', () => {
    const meta = parseHtmlMeta(
      page(`<meta property="article:author" content="https://facebook.com/someone">
            <meta property="article:published_time" content="2024-03-05T10:00:00Z">`),
      'https://a.com',
    );
    expect(meta.author).toBeUndefined();
    expect(meta.publishedAt).toBe(Date.parse('2024-03-05T10:00:00Z'));
  });

  it('rejects non-web image links', () => {
    const meta = parseHtmlMeta(page(`<meta property="og:image" content="javascript:alert(1)">`), 'https://a.com');
    expect(meta.image).toBeUndefined();
  });

  it('decodes numeric entities', () => {
    expect(decodeEntities('It&#39;s &#x2014; fine')).toBe("It's — fine");
    expect(decodeEntities('Type &middot; Typewolf')).toBe('Type · Typewolf');
  });
});

describe('detectPlatform', () => {
  it('recognises platforms by domain, including subdomains', () => {
    expect(detectPlatform('https://someone.substack.com/p/x')?.label).toBe('Substack');
    expect(detectPlatform('https://twitter.com/a/status/1')?.id).toBe('x');
    expect(detectPlatform('https://www.youtube.com/watch?v=1')?.label).toBe('YouTube');
    expect(detectPlatform('https://example.com')).toBeUndefined();
  });

  it('recognises Substack on a custom domain from clues in the page', () => {
    const meta = parseHtmlMeta(page(`<link rel="preconnect" href="https://substackcdn.com">`), 'https://www.lennysnewsletter.com/p/x');
    expect(detectPlatform('https://www.lennysnewsletter.com/p/x', meta)?.label).toBe('Substack');
  });

  it('recognises self-hosted platforms from the generator tag', () => {
    const meta = parseHtmlMeta(page(`<meta name="generator" content="WordPress 6.5">`), 'https://blog.example.com');
    expect(detectPlatform('https://blog.example.com', meta)?.label).toBe('WordPress');
  });
});
