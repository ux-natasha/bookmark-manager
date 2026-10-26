import { describe, expect, it } from 'vitest';
import { codeKind, itemCode, saveSequence, subKind } from './codes';

describe('subKind', () => {
  it('reads video, post and repo links from their platform', () => {
    expect(subKind({ platform: 'youtube' })).toBe('video');
    expect(subKind({ platform: 'vimeo' })).toBe('video');
    expect(subKind({ platform: 'bluesky' })).toBe('post');
    expect(subKind({ platform: 'mastodon' })).toBe('post');
    expect(subKind({ platform: 'github' })).toBe('repo');
    expect(subKind({ platform: 'gitlab' })).toBe('repo');
  });

  it('leaves other links, and anything that is not a link, without one', () => {
    expect(subKind({ platform: 'substack' })).toBeUndefined();
    expect(subKind({})).toBeUndefined();
    expect(subKind({ kind: 'quote', platform: 'youtube' })).toBeUndefined();
  });
});

describe('itemCode', () => {
  it('uses the kind code, with link codes following the platform', () => {
    expect(codeKind({})).toBe('LNK');
    expect(codeKind({ platform: 'x' })).toBe('PST');
    expect(codeKind({ kind: 'quote' })).toBe('QTE');
    expect(codeKind({ kind: 'image' })).toBe('PIC');
    expect(codeKind({ kind: 'note' })).toBe('NTE');
  });

  it('pads the number to three digits and grows past 999', () => {
    expect(itemCode({}, 14)).toBe('LNK·014');
    expect(itemCode({ platform: 'youtube' }, 3)).toBe('VID·003');
    expect(itemCode({ kind: 'note' }, 1234)).toBe('NTE·1234');
  });
});

describe('saveSequence', () => {
  it('numbers items in save order, oldest first, whatever order they come in', () => {
    const seq = saveSequence([
      { id: 'c', createdAt: 300 },
      { id: 'a', createdAt: 100 },
      { id: 'b', createdAt: 200 },
    ]);
    expect([seq.get('a'), seq.get('b'), seq.get('c')]).toEqual([1, 2, 3]);
  });

  it('is stable for items saved at the same moment', () => {
    const items = [
      { id: 'y', createdAt: 100 },
      { id: 'x', createdAt: 100 },
    ];
    expect(saveSequence(items)).toEqual(saveSequence([...items].reverse()));
    expect(saveSequence(items).get('x')).toBe(1);
  });
});
