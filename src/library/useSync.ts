import { useEffect, useRef, useState } from 'react';
import { sendToBackground } from '../lib/messages';
import { syncNow, syncSupported, type SyncOutcome } from '../lib/sync';

// While the library is open: sync when it opens or comes back to the front, every few minutes, and shortly after
// anything changes here. Sync only runs in the library page, because only pages can use a folder you picked.
const EVERY_MS = 5 * 60 * 1000;
const AFTER_CHANGE_MS = 15 * 1000;

export function useSync(changeKey: unknown): { outcome: SyncOutcome | undefined; run: (ask?: boolean) => Promise<SyncOutcome> } {
  const [outcome, setOutcome] = useState<SyncOutcome>();
  const supported = syncSupported();

  const run = async (ask = false) => {
    const result = await syncNow({ ask });
    setOutcome(result);
    // Items from the other browsers need their previews and details read here.
    if (result.status === 'synced' && result.added + result.changed > 0) sendToBackground({ type: 'enrich-pending' });
    return result;
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!supported) return;
    runRef.current();
    const timer = setInterval(() => runRef.current(), EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && runRef.current();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supported]);

  // The first value is the library loading, not a change.
  const seen = useRef(false);
  useEffect(() => {
    if (!supported || changeKey === undefined) return;
    if (!seen.current) {
      seen.current = true;
      return;
    }
    const timer = setTimeout(() => runRef.current(), AFTER_CHANGE_MS);
    return () => clearTimeout(timer);
  }, [supported, changeKey]);

  return { outcome, run };
}
