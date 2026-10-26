import { useState } from 'react';
import { tagName } from '../lib/tags';
import { slotStyle, useTagLook } from './tagLook';

interface Props {
  tags: string[];
  onTagClick: (tag: string) => void;
  // "sheet" is the Contact sheet's "FILED · WORK / READING +3": ink only, since that theme has no tag colours.
  variant?: 'card' | 'sheet';
}

// "filed under WORK and READING", on a card. At most two tags, then "and 3 more", which shows the rest in place.
// Each tag filters by itself; nested tags show only their leaf ("weeknight"). Archived tags stay, uncoloured.
export function FiledUnderLine({ tags, onTagClick, variant = 'card' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const look = useTagLook();
  const folded = !expanded && tags.length > 2;
  const shown = folded ? tags.slice(0, 2) : tags;
  const sheet = variant === 'sheet';

  const words = shown.map((tag, i) => {
    const { slot, archived } = look(tag);
    const join = sheet ? (i === 0 ? '' : ' / ') : i === 0 ? '' : !folded && i === shown.length - 1 ? ' and ' : ', ';
    return (
      <span key={tag}>
        {join}
        <button
          type="button"
          className={`${sheet ? 'sheet-tag' : 'filed-under-word'}${archived ? ' is-archived' : ''}`}
          style={sheet ? undefined : slotStyle(slot)}
          aria-label={`Filter by ${tagName(tag)}`}
          onClick={() => onTagClick(tag)}
        >
          {tagName(tag, true)}
        </button>
      </span>
    );
  });

  if (sheet) {
    return (
      <span className="sheet-tags">
        Filed · {words}
        {folded && (
          <button type="button" className="sheet-tag" aria-label={`Show ${tags.length - 2} more tags`} onClick={() => setExpanded(true)}>
            {' '}
            +{tags.length - 2}
          </button>
        )}
      </span>
    );
  }

  return (
    <p className="filed-under">
      filed under {words}
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
