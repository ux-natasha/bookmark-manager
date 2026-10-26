import { useLayoutEffect, useReducer, useRef, useState, type ReactNode } from 'react';

// Masonry columns (docs/design/library-interactions.md, 6.9). Each item goes to the shortest column in turn,
// so the newest things run across the top, which CSS columns can't do. Items are positioned absolutely
// from their measured heights and stay in sort order in the DOM, so nothing remounts when the layout
// changes and keyboard order follows the list.

const MIN_COLUMN = 230;
const MAX_COLUMNS = 6;
// Before an item has been measured. Close enough that the first paint doesn't jump much.
const ESTIMATE = 280;

// Where an item landed: how many items sit above it in its column. Cards use it to tilt in turns.
export interface Placement {
  row: number;
}

interface Props<T> {
  className?: string;
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T, placement: Placement) => ReactNode;
}

export function Masonry<T>({ className, items, keyOf, render }: Props<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [gap, setGap] = useState({ x: 28, y: 34 });
  const heights = useRef(new Map<string, number>());
  const [, relayout] = useReducer((n: number) => n + 1, 0);
  const observer = useRef<ResizeObserver>();

  useLayoutEffect(() => {
    const el = ref.current!;
    const style = getComputedStyle(el);
    setGap({ x: parseFloat(style.columnGap) || 28, y: parseFloat(style.rowGap) || 34 });
    setWidth(el.clientWidth);
    const container = new ResizeObserver(() => setWidth(el.clientWidth));
    container.observe(el);
    return () => container.disconnect();
  }, []);

  // One observer for every item; a change in any height lays the columns out again.
  if (!observer.current && typeof ResizeObserver !== 'undefined') {
    observer.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const key = (entry.target as HTMLElement).dataset.key!;
        const height = (entry.target as HTMLElement).offsetHeight;
        if (heights.current.get(key) !== height) {
          heights.current.set(key, height);
          changed = true;
        }
      }
      if (changed) relayout();
    });
  }
  useLayoutEffect(() => () => observer.current?.disconnect(), []);

  // One ref callback per item, kept so each can stop observing, and forget its height, when its item goes.
  // Otherwise a long session of filtering would grow the height map and keep watching detached elements.
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const refs = useRef(new Map<string, (el: HTMLDivElement | null) => void>());
  // Bumped whenever an item is measured for the first time or changes height, so the layout effect below
  // notices new measurements even when the number of measured items hasn't changed.
  const version = useRef(0);
  const laidOut = useRef(0);

  const refFor = (key: string) => {
    let ref = refs.current.get(key);
    if (!ref) {
      ref = (el) => {
        if (el) {
          nodes.current.set(key, el);
          if (heights.current.get(key) !== el.offsetHeight) version.current++;
          heights.current.set(key, el.offsetHeight);
          observer.current?.observe(el);
          return;
        }
        const node = nodes.current.get(key);
        if (node) observer.current?.unobserve(node);
        nodes.current.delete(key);
        heights.current.delete(key);
        refs.current.delete(key);
      };
      refs.current.set(key, ref);
    }
    return ref;
  };

  // The first measurements arrive in the ref callbacks above, before paint; lay out again with them.
  useLayoutEffect(() => {
    if (version.current !== laidOut.current) {
      laidOut.current = version.current;
      relayout();
    }
  });

  const columns = width ? Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width + gap.x) / (MIN_COLUMN + gap.x)))) : 1;
  const columnWidth = width ? (width - (columns - 1) * gap.x) / columns : 0;
  const tops = new Array<number>(columns).fill(0);
  const rows = new Array<number>(columns).fill(0);
  const placed = items.map((item) => {
    const key = keyOf(item);
    let column = 0;
    for (let c = 1; c < columns; c++) if (tops[c] < tops[column] - 1) column = c;
    const top = tops[column];
    tops[column] += (heights.current.get(key) ?? ESTIMATE) + gap.y;
    return { item, key, left: column * (columnWidth + gap.x), top, row: rows[column]++ };
  });
  const height = Math.max(0, ...tops) - (items.length ? gap.y : 0);

  return (
    <div className={className ? `grid ${className}` : 'grid'} ref={ref} role="list" style={{ height }}>
      {width > 0 &&
        placed.map(({ item, key, left, top, row }) => (
          <div
            key={key}
            ref={refFor(key)}
            data-key={key}
            className="grid-item"
            role="listitem"
            style={{ width: columnWidth, transform: `translate(${left}px, ${top}px)` }}
          >
            {render(item, { row })}
          </div>
        ))}
    </div>
  );
}
