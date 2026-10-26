import type { CSSProperties } from 'react';
import type { BucketId, Swatch } from '../lib/color';

// Search by colour (docs/design/theme-colour-field.md, 5.4). One colour at a time; picking the chosen one
// again clears it. Every swatch is named in its label and the result is said in words.

interface Props {
  swatches: Swatch[];
  selected: BucketId | null;
  // What the other filters plus the colour leave, for the status line.
  resultCount: number;
  onSelect: (bucket: BucketId | null) => void;
}

export function ColourSearch({ swatches, selected, resultCount, onSelect }: Props) {
  const chosen = swatches.find((s) => s.bucket === selected);
  return (
    <section className="colour-search" aria-label="Search by colour">
      <h2 className="colour-search-lead">Search by colour</h2>
      <div className="colour-swatches" role="group" aria-label="Colours">
        {swatches.map((s) => (
          <button
            key={s.bucket}
            type="button"
            className="swatch"
            aria-pressed={s.bucket === selected}
            aria-label={`${s.label} things, ${s.count}`}
            title={s.label}
            style={{ '--swatch': s.color } as CSSProperties}
            onClick={() => onSelect(s.bucket === selected ? null : s.bucket)}
          />
        ))}
      </div>
      <p className="colour-search-status" aria-live="polite">
        {chosen
          ? `${resultCount} ${chosen.label.toLowerCase()} ${resultCount === 1 ? 'thing' : 'things'}`
          : 'Pick a colour to see things that looked like it'}
      </p>
    </section>
  );
}
