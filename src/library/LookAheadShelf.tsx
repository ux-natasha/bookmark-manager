import type { CSSProperties } from 'react';
import { addMonths } from '../lib/age';
import { LookAheadAction, LookAheadStatus, MAX_AHEAD, monthParts, StepButton, useAgeingCopy, useKeepChosenVisible, useLookAheadPanel, type LookAheadProps } from './lookAheadParts';

// Look ahead, Covers look (docs/design/theme-covers.md 6.3): a shelf of monthly issues. The chosen
// spine is pulled out with a ribbon; the rest fade, bleach and lean the further ahead they are.

// The eight cover colours, cycled along the shelf, each with the ink that reads on it (4.5:1 or better).
const SPINES: [color: string, ink: string][] = [
  ['#24453B', '#fff'],
  ['#2F3B8F', '#fff'],
  ['#A3302A', '#fff'],
  ['#7D9AA8', '#14171a'],
  ['#1E2129', '#fff'],
  ['#B4893F', '#14171a'],
  ['#6F8A3E', '#14171a'],
  ['#C4688A', '#14171a'],
];

export function LookAheadShelf({ months, onChange, fadedCount, total, refresh }: LookAheadProps) {
  const ageing = useAgeingCopy();
  const { ref, onKeyDown } = useLookAheadPanel(months, onChange);
  const row = useKeepChosenVisible(months);
  const { month, year } = monthParts(months);

  return (
    <div className="look-ahead look-ahead-shelf" role="group" aria-label="Look ahead" ref={ref} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="shelf-top">
        <div className="shelf-heading">
          <span className="look-ahead-lead">{months === 0 ? ageing.leadNow : ageing.leadAhead}</span>
          <span className="look-ahead-month" aria-live="polite">
            {month} <span className="look-ahead-year">{year}</span>
          </span>
        </div>
        <div className="shelf-steps">
          <StepButton direction="back" months={months} onChange={onChange} />
          <StepButton direction="forward" months={months} onChange={onChange} />
        </div>
      </div>

      <div className="spines" ref={row}>
        {Array.from({ length: MAX_AHEAD + 1 }, (_, i) => {
          const chosen = i === months;
          return (
            <button
              key={i}
              type="button"
              className="spine"
              style={
                {
                  '--m': (i / MAX_AHEAD).toFixed(3),
                  '--spine': SPINES[i % SPINES.length][0],
                  '--spine-ink': SPINES[i % SPINES.length][1],
                  // Real books aren't the same height.
                  '--h': `${128 + ((i * 37) % 5) * 9}px`,
                } as CSSProperties
              }
              aria-label={monthParts(i).label}
              aria-pressed={chosen}
              onClick={() => onChange(i)}
            >
              <span className="spine-label" aria-hidden="true">
                {spineLabel(i)}
              </span>
              {chosen && <span className="spine-ribbon" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="shelf-ledge" aria-hidden="true" />

      <div className="look-ahead-footer">
        <LookAheadStatus months={months} fadedCount={fadedCount} total={total} />
        <LookAheadAction months={months} onChange={onChange} refresh={refresh} />
      </div>
    </div>
  );
}

// "NOW", "NOV 26", … read upwards from the bottom of the spine.
function spineLabel(offset: number): string {
  if (offset === 0) return 'NOW';
  const date = new Date(addMonths(Date.now(), offset));
  return `${date.toLocaleDateString('en', { month: 'short' }).toUpperCase()} ${String(date.getFullYear()).slice(-2)}`;
}
