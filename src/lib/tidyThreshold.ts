import { useEffect, useState } from 'react';
import type { TidyThreshold } from './tags';

// The tag index's "Tidy up tags not used in" setting, in months. 0 is off.
export const TIDY_THRESHOLDS: TidyThreshold[] = [0, 3, 6, 12];

const STORAGE_KEY = 'tidyThreshold';

function isThreshold(value: unknown): value is TidyThreshold {
  return TIDY_THRESHOLDS.includes(value as TidyThreshold);
}

export function useTidyThreshold() {
  const [threshold, setState] = useState<TidyThreshold>(12);

  useEffect(() => {
    chrome.storage?.local.get(STORAGE_KEY).then((result) => {
      if (isThreshold(result[STORAGE_KEY])) setState(result[STORAGE_KEY]);
    });
  }, []);

  const setThreshold = (next: TidyThreshold) => {
    setState(next);
    chrome.storage?.local.set({ [STORAGE_KEY]: next });
  };

  return { threshold, setThreshold };
}
