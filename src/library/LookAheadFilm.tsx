import type { CSSProperties } from 'react';
import { addMonths } from '../lib/age';
import { GreasePencil } from '../components/GreasePencil';
import { isJanuary, LookAheadAction, LookAheadStatus, MAX_AHEAD, monthParts, StepButton, useAgeingCopy, useKeepChosenVisible, useLookAheadPanel, type LookAheadProps } from './lookAheadParts';

// Look ahead, Contact sheet look (docs/design/theme-contact-sheet.md 4.5): a strip of film, one frame
// per month. Each frame previews how bleached things will be that month; the current one is circled
// in grease pencil.

export function LookAheadFilm({ months, onChange, fadedCount, total, refresh }: LookAheadProps) {
  const ageing = useAgeingCopy();
  const { ref, onKeyDown } = useLookAheadPanel(months, onChange);
  const strip = useKeepChosenVisible(months);
  const { month, year } = monthParts(months);

  return (
    <div className="look-ahead look-ahead-film" role="group" aria-label="Look ahead" ref={ref} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="film-top">
        <div className="film-heading">
          <span className="look-ahead-lead">{months === 0 ? ageing.leadNow : ageing.leadAhead}</span>
          <span className="look-ahead-month" aria-live="polite">
            {month} <span className="look-ahead-year">{year}</span>
          </span>
        </div>
        <div className="film-steps">
          <StepButton direction="back" months={months} onChange={onChange} />
          <StepButton direction="forward" months={months} onChange={onChange} />
        </div>
      </div>

      <div className="film-strip">
        <span className="film-sprockets top" aria-hidden="true" />
        <div className="film-frames" ref={strip}>
          {Array.from({ length: MAX_AHEAD + 1 }, (_, i) => {
            const chosen = i === months;
            return (
              <div key={i} className="film-slot" data-chosen={chosen}>
                <button
                  type="button"
                  className="film-frame"
                  style={{ '--m': (i / MAX_AHEAD).toFixed(3) } as CSSProperties}
                  aria-label={monthParts(i).label}
                  aria-pressed={chosen}
                  onClick={() => onChange(i)}
                >
                  {chosen && <GreasePencil />}
                </button>
                <span className="film-number" aria-hidden="true">
                  {frameLabel(i)}
                </span>
              </div>
            );
          })}
        </div>
        <span className="film-sprockets bottom" aria-hidden="true" />
      </div>

      <div className="look-ahead-footer">
        <LookAheadStatus months={months} fadedCount={fadedCount} total={total} />
        <LookAheadAction months={months} onChange={onChange} refresh={refresh} />
      </div>
    </div>
  );
}

// "NOW", then the month count; each January shows the new year instead ("27▸").
function frameLabel(offset: number): string {
  if (offset === 0) return 'NOW';
  if (isJanuary(offset)) return `${String(new Date(addMonths(Date.now(), offset)).getFullYear()).slice(-2)}▸`;
  return String(offset);
}
