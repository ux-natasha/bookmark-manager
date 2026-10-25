import { describe, expect, it } from 'vitest';
import { anchorsFromHtml, cleanPostTitle, findUrlsInText, isShortener, redirectTargetFromHtml, tidyLinks, unwrapRedirect } from './linkfinder';

const urls = (text: string) => findUrlsInText(text).map((l) => l.url);

describe('findUrlsInText', () => {
  it('finds full links and bare domains, without trailing punctuation', () => {
    expect(urls('Loving https://example.com/a?b=1, and also figma.com/community. Try read.cv!')).toEqual([
      'https://example.com/a?b=1',
      'https://figma.com/community',
      // read.cv isn't a known ending, so it's left alone rather than guessed at.
    ]);
    expect(urls('portfolio at www.read.cv/someone')).toEqual(['https://www.read.cv/someone']);
  });

  it("doesn't mistake emails, handles or code names for links", () => {
    expect(urls('mail me@studio.com, ping @figma.com or use Node.js and e.g. this')).toEqual([]);
  });

  it('keeps brackets that belong to the link', () => {
    expect(urls('(see https://en.wikipedia.org/wiki/Swiss_(design))')).toEqual(['https://en.wikipedia.org/wiki/Swiss_(design)']);
    expect(urls('(via https://example.com/post)')).toEqual(['https://example.com/post']);
  });

  it('turns addresses cut short in the post into the site home page, marked as such', () => {
    expect(findUrlsInText('new plugin figma.com/community/plugi…')).toEqual([{ url: 'https://figma.com/', truncated: true }]);
  });
});

describe('unwrapRedirect', () => {
  it('unwraps the platforms’ “leaving our site” links', () => {
    expect(unwrapRedirect('https://l.instagram.com/?u=https%3A%2F%2Fexample.com%2Fshop&e=abc')).toBe('https://example.com/shop');
    expect(unwrapRedirect('https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fexample.com')).toBe('https://example.com/');
    expect(unwrapRedirect('https://www.youtube.com/redirect?q=https%3A%2F%2Fexample.com%2Fx&v=1')).toBe('https://example.com/x');
    expect(unwrapRedirect('https://l.threads.net/?u=https%3A%2F%2Fexample.com')).toBe('https://example.com/');
  });

  it('leaves normal links on those sites alone', () => {
    expect(unwrapRedirect('https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com/watch?v=abc');
    expect(unwrapRedirect('https://www.linkedin.com/in/someone?url=https://x.com')).toBe('https://www.linkedin.com/in/someone?url=https://x.com');
  });
});

describe('tidyLinks', () => {
  const post = 'https://x.com/someone/status/123';

  it('drops links back to the same platform, attachments and repeats, but keeps short links to follow later', () => {
    const result = tidyLinks(
      [
        { url: 'https://twitter.com/hashtag/design' },
        { url: 'https://x.com/other' },
        { url: 'https://pbs.twimg.com/media/abc.jpg' },
        { url: 'https://t.co/xyz' },
        { url: 'https://example.com/?utm_source=x' },
        { url: 'https://www.example.com/' },
        { url: post },
      ],
      post,
    );
    expect(result.map((l) => l.url)).toEqual(['https://t.co/xyz', 'https://example.com/']);
  });

  it('drops share buttons, including a site’s own share-counter links', () => {
    const page = 'https://www.smashingmagazine.com/2024/05/naming-best-practices/';
    const result = tidyLinks(
      [
        { url: 'https://twitter.com/intent/tweet?text=Hi&url=' + encodeURIComponent(page) },
        { url: 'https://data.smashing.services/ball?uri=//www.linkedin.com/shareArticle?url=' + page },
        { url: 'https://data.to.design/?trk=public_post-text' },
      ],
      page,
    );
    expect(result.map((l) => l.url)).toEqual(['https://data.to.design/']);
  });

  it('keeps links between different sites on the same publishing platform', () => {
    const result = tidyLinks([{ url: 'https://other.substack.com/p/x' }], 'https://writer.substack.com/p/post');
    expect(result).toHaveLength(1);
  });
});

describe('short links', () => {
  it('recognises shorteners, but not their home pages', () => {
    expect(isShortener('https://t.co/abc')).toBe(true);
    expect(isShortener('https://bit.ly/3xyz')).toBe(true);
    expect(isShortener('https://bit.ly/')).toBe(false);
    expect(isShortener('https://substack.com/redirect/abc')).toBe(true);
    expect(isShortener('https://substack.com/@writer')).toBe(false);
  });

  it('reads the target out of a forwarding page', () => {
    expect(redirectTargetFromHtml('<head><meta http-equiv="refresh" content="0;URL=https://example.com/a?b=1&amp;c=2"></head>')).toBe(
      'https://example.com/a?b=1&c=2',
    );
    expect(redirectTargetFromHtml('<title>https://example.com/page</title>')).toBe('https://example.com/page');
  });

  it("reads the real address off LinkedIn's “you're leaving LinkedIn” page", () => {
    const html =
      '<head><title>LinkedIn</title></head><body><a href="https://www.linkedin.com/legal">Terms</a>' +
      '<a class="artdeco-button" data-tracking-control-name="external_url_click" href="https://www.cindyly.design/">Continue</a></body>';
    expect(redirectTargetFromHtml(html)).toBe('https://www.cindyly.design/');
  });
});

describe('anchorsFromHtml', () => {
  it('skips mentions and hashtags', () => {
    const html =
      '<p>Hi <a href="https://mastodon.social/@a" class="u-url mention">@a</a> <a href="https://mastodon.social/tags/ux" class="mention hashtag">#ux</a> see <a href="https://example.com/x?a=1&amp;b=2">x</a></p>';
    expect(anchorsFromHtml(html, 'https://mastodon.social/@b/1')).toEqual(['https://example.com/x?a=1&b=2']);
  });
});

describe('cleanPostTitle', () => {
  it('turns tab titles into short labels', () => {
    expect(cleanPostTitle('(1) UI/UX Wonder on X: "Sites on the internet for design inspiration. Web Design → https://t.co/R99" / X')).toBe(
      'UI/UX Wonder on X',
    );
    expect(cleanPostTitle('#ux #books | Vitaly Friedman | LinkedIn')).toBe('#ux #books | Vitaly Friedman');
    expect(cleanPostTitle('(12) Post | LinkedIn')).toBeUndefined();
  });
});
