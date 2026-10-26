import { Fragment, type RefObject } from 'react';
import { GreasePencil } from '../components/GreasePencil';
import type { IndexEntry } from '../lib/tags';
import { useTheme } from '../lib/theme';
import { copyFor } from './copy';
import { slotStyle } from './tagLook';

// The collapsed index: the six most-used tags on one line, and the button that opens the rest
// (docs/design/library-interactions.md, 6.5). Covers draws it as a running header.

interface Props {
  mostUsed: IndexEntry[];
  liveCount: number;
  open: boolean;
  panelId: string;
  buttonRef: RefObject<HTMLButtonElement>;
  onToggleTag: (tag: string) => void;
  onToggleOpen: () => void;
}

export function TagStrip({ mostUsed, liveCount, open, panelId, buttonRef, onToggleTag, onToggleOpen }: Props) {
  const theme = useTheme();
  const copy = copyFor(theme).index;
  return (
    <div className="tag-strip">
      {/* Every tag can be archived, leaving only the button. */}
      {mostUsed.length > 0 && <span className="tag-strip-lead">{copy.stripLead}</span>}
      <div className="tag-strip-tags">
        {mostUsed.map((e, i) => (
          <Fragment key={e.tag}>
            {i > 0 && (
              <span className="tag-strip-sep" aria-hidden="true">
                {' · '}
              </span>
            )}
            <button type="button" className="tag-strip-tag" aria-pressed={e.selected} style={slotStyle(e.slot)} onClick={() => onToggleTag(e.tag)}>
              <span className="tag-strip-name">{e.name}</span>
              <sup className="tag-strip-count">{e.count}</sup>
              {theme === 'contact' && e.selected && <GreasePencil />}
            </button>
          </Fragment>
        ))}
      </div>
      <button
        ref={buttonRef}
        type="button"
        className="ghost-button tag-strip-open"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggleOpen}
      >
        {open ? 'Close the index' : `${copy.open} · ${liveCount}`}
      </button>
    </div>
  );
}
