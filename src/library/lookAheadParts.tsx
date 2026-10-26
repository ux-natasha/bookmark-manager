import { useEffect, useRef, type KeyboardEvent } from 'react';
import { addMonths } from '../lib/age';
import { useTheme } from '../lib/theme';
import { copyFor } from './copy';

// What the four Look ahead components share (docs/design/library-interactions.md, 6.3): the months,
// the keys, the stepping buttons and the footer button. Each theme draws its own panel around them.

export const MAX_AHEAD = 24;

export interface LookAheadProps {
  // 0 (today) to 24. Never saved, and never written to the database.
  months: number;
  onChange: (months: number) => void;
  // Faded at the previewed date, and in the whole library.
  fadedCount: number;
  total: number;
  // Refresh my memory, in the theme's words. Only offered at month 0.
  refresh: { run: () => void; disabled: boolean };
}

export const clampMonths = (months: number) => Math.min(MAX_AHEAD, Math.max(0, months));

// "October" and "2026", for `offset` months from today. Real calendar months, so January really is the new year.
export function monthParts(offset: number): { month: string; year: string; label: string } {
  const date = new Date(addMonths(Date.now(), offset));
  const month = date.toLocaleDateString('en', { month: 'long' });
  const year = String(date.getFullYear());
  return { month, year, label: `${month} ${year}` };
}

export function isJanuary(offset: number): boolean {
  return new Date(addMonths(Date.now(), offset)).getMonth() === 0;
}

// ← and → anywhere in the panel step a month, Home goes back to today.
// The panel takes focus itself when the button that had it is disabled at either end, because a
// disabled button stops getting keys and the arrows would go dead.
export function useLookAheadPanel(months: number, onChange: (months: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.disabled && ref.current?.contains(active)) ref.current.focus();
  }, [months]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = e.key === 'ArrowLeft' ? months - 1 : e.key === 'ArrowRight' ? months + 1 : e.key === 'Home' ? 0 : undefined;
    if (next === undefined) return;
    e.preventDefault();
    onChange(clampMonths(next));
  };
  return { ref, onKeyDown };
}

// Keeps a scrolling row's chosen item in view without scrolling the page, which scrollIntoView would.
// The row must be positioned, so offsetLeft is measured from it.
export function useKeepChosenVisible(months: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    const chosen = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chosen || row.scrollWidth <= row.clientWidth) return;
    const left = chosen.offsetLeft - (row.clientWidth - chosen.offsetWidth) / 2;
    row.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [months]);
  return ref;
}

// ‹ and ›, one month each, disabled at the ends.
export function StepButton({ direction, months, onChange }: { direction: 'back' | 'forward'; months: number; onChange: (months: number) => void }) {
  const back = direction === 'back';
  return (
    <button
      type="button"
      className="look-ahead-step"
      aria-label={back ? 'One month earlier' : 'One month later'}
      disabled={back ? months <= 0 : months >= MAX_AHEAD}
      onClick={() => onChange(clampMonths(months + (back ? -1 : 1)))}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );
}

// "Refresh my memory" today; "Back to today" while looking ahead. One button, so focus stays on it when it changes.
export function LookAheadAction({ months, onChange, refresh }: Pick<LookAheadProps, 'months' | 'onChange' | 'refresh'>) {
  const ageing = useAgeingCopy();
  const today = months === 0;
  return (
    <button
      type="button"
      className="ghost-button look-ahead-action"
      disabled={today && refresh.disabled}
      title={today && refresh.disabled ? ageing.nothing : undefined}
      onClick={today ? refresh.run : () => onChange(0)}
    >
      {today ? ageing.refresh : ageing.back}
    </button>
  );
}

export function LookAheadStatus({ months, fadedCount, total }: Pick<LookAheadProps, 'months' | 'fadedCount' | 'total'>) {
  const ageing = useAgeingCopy();
  return <span className="look-ahead-status">{ageing.status(fadedCount, total, months > 0)}</span>;
}

export function useAgeingCopy() {
  return copyFor(useTheme()).ageing;
}
