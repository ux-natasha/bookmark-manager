import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { monthParts } from './lookAheadParts';

// Wraps the Look ahead panel in the three themes that put it under the hero, where it takes a lot of room.
// Closed, it is a single handle that says where the preview stands; each theme draws the handle its own way
// (film leader, ribbon, light-meter needle) in its stylesheet.

const KEY = 'look-ahead-open';

function readOpen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

interface Props {
  months: number;
  fadedCount: number;
  children: ReactNode;
}

export function LookAheadFold({ months, fadedCount, children }: Props) {
  const [open, setOpen] = useState(readOpen);
  const bodyId = useId();

  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(KEY, open ? '0' : '1');
    } catch {
      // The choice just isn't remembered.
    }
  };

  const where = months === 0 ? 'Now' : monthParts(months).label;
  const faded = fadedCount > 0 ? ` · ${fadedCount} faded` : '';

  return (
    <section className="look-ahead-section look-ahead-fold" data-open={open} style={{ '--m': months / 24 } as CSSProperties}>
      <button type="button" className="fold-handle" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
        <span className="fold-mark" aria-hidden="true" />
        <span className="fold-label">Look ahead</span>
        <span className="fold-where">
          {where}
          {faded}
        </span>
        <span className="fold-action" aria-hidden="true">
          {open ? 'Close' : 'Open'}
        </span>
      </button>
      {/* Closed, the panel is hidden from the eye, the keyboard and screen readers, but stays mounted so its month survives. */}
      <div className="fold-body" id={bodyId}>
        <div className="fold-inner">{children}</div>
      </div>
    </section>
  );
}
