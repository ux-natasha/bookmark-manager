import { Fragment, useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  run: () => void;
  disabled?: boolean;
  // Set for a choice among several (the theme): the item becomes a radio item.
  checked?: boolean;
  ariaLabel?: string;
  // A heading shown above this item, starting a new group.
  groupLabel?: string;
}

// The header's "More" menu: everything except "Add from a post", which stays a button of its own.
export function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  itemRefs.current.length = items.length;

  const enabled = () => itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    enabled()[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const list = enabled();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      list[(index + step + list.length) % list.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      (e.key === 'Home' ? list[0] : list[list.length - 1])?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="more-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="ghost-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        More
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="more-menu-list" role="menu" aria-label="More" onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => (
            <Fragment key={item.label}>
              {item.groupLabel && (
                <span className="more-menu-group" aria-hidden="true">
                  {item.groupLabel}
                </span>
              )}
              <button
                ref={(el) => (itemRefs.current[i] = el)}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                aria-label={item.ariaLabel}
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  close(true);
                  item.run();
                }}
              >
                {item.label}
                {item.checked && (
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
