import { createContext, useContext, useEffect, useState } from 'react';

// Library themes. Each is a token set (src/styles/themes/) plus, for a few components, a different structure.
export type Theme = 'default' | 'contact' | 'covers' | 'field';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'contact', label: 'Contact sheet' },
  { id: 'covers', label: 'Covers' },
  { id: 'field', label: 'Colour field' },
];

const STORAGE_KEY = 'theme';

function isTheme(value: unknown): value is Theme {
  return THEMES.some((t) => t.id === value);
}

// Mirrored to localStorage, like the appearance, so the page paints in the right theme.
function readMirror(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : 'default';
  } catch {
    return 'default';
  }
}

function apply(theme: Theme) {
  if (theme === 'default') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

apply(readMirror());

export function useThemeSetting() {
  const [theme, setThemeState] = useState<Theme>(readMirror);

  useEffect(() => {
    chrome.storage?.local.get(STORAGE_KEY).then((result) => {
      if (isTheme(result[STORAGE_KEY])) setThemeState(result[STORAGE_KEY]);
    });
  }, []);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Only the pre-paint mirror is lost; the saved choice is in chrome.storage.
    }
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    chrome.storage?.local.set({ [STORAGE_KEY]: next });
  };

  return { theme, setTheme };
}

export const ThemeContext = createContext<Theme>('default');

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
