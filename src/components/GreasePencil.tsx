import { useLayoutEffect, useRef } from 'react';

// The Contact sheet theme's hand-drawn loop around a selected tag (docs/design/theme-contact-sheet.md, 4.7).
// One open stroke whose end overshoots its start. Decoration only: the control keeps aria-pressed.

const LOOP = 'M14 8 C 34 1, 80 2, 93 12 C 101 22, 88 35, 54 37 C 22 39, 2 31, 4 20 C 6 11, 20 6, 36 5';

export function GreasePencil() {
  const path = useRef<SVGPathElement>(null);
  // The draw-on dash is measured rather than set with pathLength, which Chrome doesn't scale under
  // preserveAspectRatio="none".
  useLayoutEffect(() => {
    path.current?.style.setProperty('--length', String(path.current.getTotalLength()));
  }, []);
  return (
    <svg className="grease-pencil" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path ref={path} d={LOOP} />
    </svg>
  );
}
