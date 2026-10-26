import { describe, expect, it } from 'vitest';
import { toggleTagSelection } from './tags';

const U = '__untagged__';

describe('toggleTagSelection', () => {
  it('adds and removes a tag', () => {
    expect(toggleTagSelection([], 'a', U)).toEqual(['a']);
    expect(toggleTagSelection(['a', 'b'], 'a', U)).toEqual(['b']);
  });
  it('makes Untagged replace the tags, since nothing can be both', () => {
    expect(toggleTagSelection(['a', 'b'], U, U)).toEqual([U]);
  });
  it('drops Untagged when a tag is picked', () => {
    expect(toggleTagSelection([U], 'a', U)).toEqual(['a']);
  });
  it('turns Untagged off when picked again', () => {
    expect(toggleTagSelection([U], U, U)).toEqual([]);
  });
});
