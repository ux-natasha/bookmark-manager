// Set at build time: `npm run build:firefox` builds with mode "firefox" (vite.config.ts).
export const IS_FIREFOX = import.meta.env.MODE === 'firefox';

// What the browser calls its own saved links.
export const BROWSER_SAVES = IS_FIREFOX ? 'bookmarks' : 'favorites';
