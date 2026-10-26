import { isJanuary, LookAheadAction, LookAheadStatus, MAX_AHEAD, monthParts, StepButton, useAgeingCopy, useLookAheadPanel, type LookAheadProps } from './lookAheadParts';

// Look ahead, Default look (docs/design/library-interactions.md 6.3): a month row above 25 ticks.
// The ticks are decoration; the month text is read out as it changes.

export function LookAhead({ months, onChange, fadedCount, total, refresh }: LookAheadProps) {
  const ageing = useAgeingCopy();
  const { ref, onKeyDown } = useLookAheadPanel(months, onChange);
  const { month, year } = monthParts(months);

  return (
    <div className="look-ahead" role="group" aria-label="Look ahead" ref={ref} tabIndex={-1} onKeyDown={onKeyDown}>
      <span className="look-ahead-lead">{months === 0 ? ageing.leadNow : ageing.leadAhead}</span>
      <div className="look-ahead-row">
        <StepButton direction="back" months={months} onChange={onChange} />
        <span className="look-ahead-month" aria-live="polite">
          {month} <span className="look-ahead-year">{year}</span>
        </span>
        <StepButton direction="forward" months={months} onChange={onChange} />
      </div>
      <div className="look-ahead-ticks" aria-hidden="true">
        {Array.from({ length: MAX_AHEAD + 1 }, (_, i) => (
          <span key={i} className="look-ahead-tick" data-state={i === months ? 'now' : i < months ? 'done' : 'ahead'} data-january={isJanuary(i)} />
        ))}
      </div>
      <div className="look-ahead-footer">
        <LookAheadStatus months={months} fadedCount={fadedCount} total={total} />
        <LookAheadAction months={months} onChange={onChange} refresh={refresh} />
      </div>
    </div>
  );
}
