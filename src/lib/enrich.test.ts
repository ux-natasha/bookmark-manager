import { describe, expect, it } from 'vitest';
import { isDeadLink, type Bookmark, type Preview } from './db';
import { classifyStatus, posterOf } from './enrich';
import { pickPreview } from './previews';
import { needsEnrichment } from './queue';

const HOUR = 60 * 60 * 1000;

const bookmark = (overrides: Partial<Bookmark> = {}): Bookmark => ({
  id: '1',
  url: 'https://example.com',
  normalizedUrl: 'example.com',
  title: 'Example',
  note: '',
  tags: [],
  source: 'panel',
  createdAt: 0,
  updatedAt: 0,
  openCount: 0,
  ...overrides,
});

const preview = (kind: Preview['kind']): Preview => ({ bookmarkId: '1', kind, blob: new Blob(), createdAt: 0 });

describe('link status', () => {
  it('only treats "not found" answers as gone; refusals are inconclusive', () => {
    expect(classifyStatus(200)).toBe('ok');
    expect(classifyStatus(301)).toBe('ok');
    expect(classifyStatus(404)).toBe('gone');
    expect(classifyStatus(410)).toBe('gone');
    expect(classifyStatus(202)).toBe('restricted');
    expect(classifyStatus(403)).toBe('restricted');
    expect(classifyStatus(429)).toBe('restricted');
    expect(classifyStatus(503)).toBe('restricted');
  });

  it('flags unreachable sites as dead only after two failed checks', () => {
    expect(isDeadLink(bookmark({ linkStatus: 'gone' }))).toBe(true);
    expect(isDeadLink(bookmark({ linkStatus: 'unreachable', checkFailures: 1 }))).toBe(false);
    expect(isDeadLink(bookmark({ linkStatus: 'unreachable', checkFailures: 2 }))).toBe(true);
    expect(isDeadLink(bookmark({ linkStatus: 'restricted' }))).toBe(false);
  });

  it('retries an unreachable site later, but not straight away', () => {
    const now = 100 * HOUR;
    expect(needsEnrichment(bookmark(), now)).toBe(true);
    expect(needsEnrichment(bookmark({ enrichedAt: 1, textSavedAt: 1, linkStatus: 'ok' }), now)).toBe(false);
    const failedOnce = { enrichedAt: 1, linkStatus: 'unreachable' as const, checkFailures: 1 };
    expect(needsEnrichment(bookmark({ ...failedOnce, lastCheckedAt: now - HOUR }), now)).toBe(false);
    expect(needsEnrichment(bookmark({ ...failedOnce, lastCheckedAt: now - 7 * HOUR }), now)).toBe(true);
    expect(needsEnrichment(bookmark({ deletedAt: 1 }), now)).toBe(false);
  });
});

describe('pickPreview', () => {
  const both = [preview('screenshot'), preview('image')];

  it("uses the site's image for regular sites and the screenshot for social posts", () => {
    expect(pickPreview(bookmark(), both)?.kind).toBe('image');
    expect(pickPreview(bookmark({ platform: 'x' }), both)?.kind).toBe('screenshot');
  });

  it('respects your choice, and falls back to whatever exists', () => {
    expect(pickPreview(bookmark({ previewPreference: 'screenshot' }), both)?.kind).toBe('screenshot');
    expect(pickPreview(bookmark({ platform: 'x' }), [preview('image')])?.kind).toBe('image');
    expect(pickPreview(bookmark(), [])).toBeUndefined();
  });
});

describe('posterOf', () => {
  it('finds the still X keeps for a GIF', () => {
    expect(posterOf('https://video.twimg.com/tweet_video/GaBc-12_x.mp4')).toBe('https://pbs.twimg.com/tweet_video_thumb/GaBc-12_x.jpg');
    expect(posterOf('https://example.com/tweet_video/abc.mp4')).toBeUndefined();
  });
});
