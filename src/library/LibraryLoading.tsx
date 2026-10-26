import type { CSSProperties } from 'react';
import type { Theme } from '../lib/theme';

// What the grid shows while the first answer from the database is pending: blank frames, cards or blocks, one
// per theme, with no shimmer. It stays invisible for the first 200ms (library.css), so a fast load never flashes.
// Covers has its own, on shelves (Rack.tsx).

const ASPECTS = ['16 / 9', '4 / 5', '1 / 1', '3 / 2'];
const COUNT = 8;

export function LibraryLoading({ theme }: { theme: Exclude<Theme, 'covers'> }) {
  if (theme === 'contact') {
    return (
      <div className="sheet loading" aria-hidden="true">
        {Array.from({ length: COUNT }, (_, i) => (
          <div key={i} className="sheet-cell sheet-cell-blank">
            <span className="blank-bar blank-bar-code" />
            <span className="blank-bar blank-bar-media" style={{ aspectRatio: ASPECTS[i % ASPECTS.length] }} />
            <span className="blank-bar blank-bar-title" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`loading-grid loading loading-${theme}`} aria-hidden="true">
      {Array.from({ length: COUNT }, (_, i) => (
        <div key={i} className="loading-block" style={{ '--ratio': ASPECTS[i % ASPECTS.length] } as CSSProperties} />
      ))}
    </div>
  );
}
