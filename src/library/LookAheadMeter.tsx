import type { CSSProperties } from 'react';
import { TAG_COLORS } from '../lib/itemColor';
import { LookAheadAction, LookAheadStatus, MAX_AHEAD, monthParts, StepButton, useAgeingCopy, useLookAheadPanel, type LookAheadProps } from './lookAheadParts';

// Look ahead, Colour field look (docs/design/theme-colour-field.md 5.3): a light meter. A bar of the
// library's colours drains from colour to grey across 24 months, with a glass knob on the chosen month.

const SEGMENTS = MAX_AHEAD + 1;
// Under the bar: NOW · 6 MO · 1 YR · 18 MO · 2 YRS
const SCALE: [months: number, label: string][] = [
  [0, 'Now'],
  [6, '6 mo'],
  [12, '1 yr'],
  [18, '18 mo'],
  [24, '2 yrs'],
];

interface Props extends LookAheadProps {
  // The room's colours, cycled along the bar.
  colors: string[];
}

export function LookAheadMeter({ months, onChange, fadedCount, total, refresh, colors }: Props) {
  const ageing = useAgeingCopy();
  const { ref, onKeyDown } = useLookAheadPanel(months, onChange);
  const { month, year } = monthParts(months);
  const palette = colors.length ? colors : TAG_COLORS.slice(0, 5);
  const colorAt = (i: number) => palette[i % palette.length];
  const position = (i: number) => `${((i + 0.5) / SEGMENTS) * 100}%`;

  return (
    <div className="look-ahead look-ahead-meter" role="group" aria-label="Look ahead" ref={ref} tabIndex={-1} onKeyDown={onKeyDown}>
      <span className="look-ahead-lead">{months === 0 ? ageing.leadNow : ageing.leadAhead}</span>
      <div className="look-ahead-row">
        <StepButton direction="back" months={months} onChange={onChange} />
        <span className="look-ahead-month" aria-live="polite">
          {month} <span className="look-ahead-year">{year}</span>
        </span>
        <StepButton direction="forward" months={months} onChange={onChange} />
      </div>

      <div className="meter">
        <div className="meter-track">
          <div className="meter-bar" aria-hidden="true">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <span
                key={i}
                className="meter-segment"
                style={
                  {
                    background: colorAt(i),
                    filter: `saturate(${(1 - (0.92 * i) / MAX_AHEAD).toFixed(3)}) brightness(${(1 - (0.1 * i) / MAX_AHEAD).toFixed(3)})`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          {/* The segments are the buttons; each is the full height of the touch target. */}
          <div className="meter-hits">
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <button key={i} type="button" className="meter-hit" aria-label={monthParts(i).label} aria-pressed={i === months} onClick={() => onChange(i)} />
            ))}
          </div>
          <span
            className="meter-knob"
            aria-hidden="true"
            style={{ '--x': (months + 0.5) / SEGMENTS, '--glow': colorAt(months) } as CSSProperties}
          />
        </div>
        <div className="meter-scale" aria-hidden="true">
          {SCALE.map(([at, label]) => (
            <span key={at} style={{ left: position(at) }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="look-ahead-footer">
        <LookAheadStatus months={months} fadedCount={fadedCount} total={total} />
        <LookAheadAction months={months} onChange={onChange} refresh={refresh} />
      </div>
    </div>
  );
}
