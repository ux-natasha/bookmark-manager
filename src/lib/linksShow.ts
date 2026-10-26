import { createContext, useContext, useEffect, useState } from 'react';
import type { PreviewPreference } from './db';

// The Covers theme's "Links show" setting: a typeset cover, the site's image, or a screenshot.
// An item's own previewPreference wins over it.
export type LinksShow = PreviewPreference;

export const LINKS_SHOW: { id: LinksShow; label: string }[] = [
  { id: 'cover', label: 'A cover' },
  { id: 'image', label: 'The site’s image' },
  { id: 'screenshot', label: 'A screenshot' },
];

const STORAGE_KEY = 'linksShow';

function isLinksShow(value: unknown): value is LinksShow {
  return LINKS_SHOW.some((o) => o.id === value);
}

export function useLinksShowSetting() {
  const [linksShow, setState] = useState<LinksShow>('cover');

  useEffect(() => {
    chrome.storage?.local.get(STORAGE_KEY).then((result) => {
      if (isLinksShow(result[STORAGE_KEY])) setState(result[STORAGE_KEY]);
    });
  }, []);

  const setLinksShow = (next: LinksShow) => {
    setState(next);
    chrome.storage?.local.set({ [STORAGE_KEY]: next });
  };

  return { linksShow, setLinksShow };
}

export const LinksShowContext = createContext<LinksShow>('cover');

export function useLinksShow(): LinksShow {
  return useContext(LinksShowContext);
}

// What a link shows in the Covers theme: its own choice, else the setting.
export function linkShows(previewPreference: PreviewPreference | undefined, linksShow: LinksShow): LinksShow {
  return previewPreference ?? linksShow;
}
