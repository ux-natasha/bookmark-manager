import { useState } from 'react';
import { tagName } from '../lib/tags';
import { slotStyle, useTagLook } from './tagLook';

// "filed under WORK and READING", on a card. At most two tags, then "and 3 more", which shows the rest in place.
// Each tag filters by itself; nested tags show only their leaf ("weeknight"). Archived tags stay, uncoloured.
export function FiledUnderLine({ tags, onTagClick }: { tags: string[]; onTagClick: (tag: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const look = useTagLook();
  const folded = !expanded && tags.length > 2;
  const shown = folded ? tags.slice(0, 2) : tags;

  return (
    <p className="filed-under">
      filed under{' '}
      {shown.map((tag, i) => {
        const { slot, archived } = look(tag);
        const join = i === 0 ? '' : !folded && i === shown.length - 1 ? ' and ' : ', ';
        return (
          <span key={tag}>
            {join}
            <button
              type="button"
              className={`filed-under-word${archived ? ' is-archived' : ''}`}
              style={slotStyle(slot)}
              aria-label={`Filter by ${tagName(tag)}`}
              onClick={() => onTagClick(tag)}
            >
              {tagName(tag, true)}
            </button>
          </span>
        );
      })}
      {folded && (
        <>
          {' '}
          <button type="button" className="filed-under-more" onClick={() => setExpanded(true)}>
            and {tags.length - 2} more
          </button>
        </>
      )}
    </p>
  );
}
