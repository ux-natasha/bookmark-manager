import { useEffect } from 'react';
import { THEMES } from '../lib/theme';

// The panel wears whatever theme and appearance the library is set to, and follows changes made there.
// The localStorage mirrors are shared with the library page, so the first paint is already right.
function apply(key: 'theme' | 'appearance', value: unknown) {
  const root = document.documentElement.dataset;
  if (key === 'theme') {
    if (value !== 'default' && THEMES.some((t) => t.id === value)) root.theme = value as string;
    else delete root.theme;
  } else if (value === 'light' || value === 'dark') root.appearance = value;
  else delete root.appearance;
}

function readMirror(key: 'theme' | 'appearance') {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

apply('theme', readMirror('theme'));
apply('appearance', readMirror('appearance'));

export function useLibraryLook() {
  useEffect(() => {
    chrome.storage?.local.get(['theme', 'appearance']).then((saved) => {
      apply('theme', saved.theme);
      apply('appearance', saved.appearance);
    });
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') return;
      if ('theme' in changes) apply('theme', changes.theme.newValue);
      if ('appearance' in changes) apply('appearance', changes.appearance.newValue);
    };
    chrome.storage?.onChanged.addListener(onChanged);
    return () => chrome.storage?.onChanged.removeListener(onChanged);
  }, []);
}
