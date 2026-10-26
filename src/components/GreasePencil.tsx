import { useLayoutEffect, useRef } from 'react';

// The Contact sheet theme's hand-drawn loop around a selected tag (docs/design/theme-contact-sheet.md, 4.7).
// One open stroke whose end overshoots its start. Decoration only: the control keeps aria-pressed.

const LOOP = 'M14 8 C 34 1, 80 2, 93 12 C 101 22, 88 35, 54 37 C 22 39, 2 31, 4 20 C 6 11, 20 6, 36 5';
// Around a whole cell (4.7): a reprinted frame.
const CELL_LOOP =
  'M18 6 C 50 1, 88 3, 95 14 C 100 40, 98 76, 90 92 C 70 99, 26 98, 8 90 C 2 68, 1 30, 6 12 C 9 6, 20 4, 34 4';
const CELL_SAMPLES = 48;

export function GreasePencil({ shape = 'words' }: { shape?: 'words' | 'cell' }) {
  const path = useRef<SVGPathElement>(null);
  // The draw-on dash is measured rather than set with pathLength, which Chrome doesn't scale under
  // preserveAspectRatio="none".
  useLayoutEffect(() => {
    const el = path.current;
    const svg = el?.ownerSVGElement;
    if (!el || !svg) return;
    if (shape === 'words') {
      el.style.setProperty('--length', String(el.getTotalLength()));
      return;
    }
    // A cell's stroke is non-scaling, so its dashes are in screen pixels: measure the loop as drawn, and again
    // whenever the cell changes size.
    const measure = () => {
      const { width, height } = svg.getBoundingClientRect();
      const total = el.getTotalLength();
      let length = 0;
      let last = el.getPointAtLength(0);
      for (let i = 1; i <= CELL_SAMPLES; i++) {
        const point = el.getPointAtLength((total * i) / CELL_SAMPLES);
        length += Math.hypot(((point.x - last.x) * width) / 100, ((point.y - last.y) * height) / 100);
        last = point;
      }
      el.style.setProperty('--length', String(Math.ceil(length * 1.03)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [shape]);

  const cell = shape === 'cell';
  return (
    <svg className={cell ? 'grease-pencil grease-pencil-cell' : 'grease-pencil'} viewBox={cell ? '0 0 100 100' : '0 0 100 40'} preserveAspectRatio="none" aria-hidden="true">
      <path ref={path} d={cell ? CELL_LOOP : LOOP} vectorEffect={cell ? 'non-scaling-stroke' : undefined} />
    </svg>
  );
}
