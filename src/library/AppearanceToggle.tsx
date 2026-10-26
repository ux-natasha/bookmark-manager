import { useEffect, useState } from 'react';

export type Appearance = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'appearance';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// chrome.storage.local is the saved choice. It's mirrored to localStorage so the page can apply it
// before the first paint instead of flashing the system appearance while the async read finishes.
function readMirror(): Appearance {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

function apply(appearance: Appearance) {
  if (appearance === 'system') delete document.documentElement.dataset.appearance;
  else document.documentElement.dataset.appearance = appearance;
}

apply(readMirror());

export function useAppearance() {
  const [appearance, setAppearanceState] = useState<Appearance>(readMirror);
  const [systemDark, setSystemDark] = useState(darkQuery.matches);

  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    darkQuery.addEventListener('change', onChange);
    chrome.storage?.local.get(STORAGE_KEY).then((result) => {
      const saved = result[STORAGE_KEY];
      if (saved === 'light' || saved === 'dark' || saved === 'system') setAppearanceState(saved);
    });
    return () => darkQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    apply(appearance);
    try {
      localStorage.setItem(STORAGE_KEY, appearance);
    } catch {
      // Only the pre-paint mirror is lost; the saved choice is in chrome.storage.
    }
  }, [appearance]);

  const setAppearance = (next: Appearance) => {
    setAppearanceState(next);
    chrome.storage?.local.set({ [STORAGE_KEY]: next });
  };

  const isDark = appearance === 'dark' || (appearance === 'system' && systemDark);
  // From system, the first click goes to the opposite of what's showing.
  const toggle = () => setAppearance(isDark ? 'light' : 'dark');

  return { appearance, isDark, toggle, setAppearance };
}

export function AppearanceToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} onClick={onToggle}>
      {isDark ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
