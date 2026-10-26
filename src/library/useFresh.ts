import { useEffect, useRef, useState } from 'react';

// Ids that should play an arrival animation right now: each id once, for `durationMs` after it's added.
// The themes' arrival moments (Contact sheet's develop, Covers' press) are built on this.
export function useFresh(ids: Set<string>, durationMs: number): Set<string> {
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const seen = useRef(new Set(ids));
  useEffect(() => {
    const added = [...ids].filter((id) => !seen.current.has(id));
    if (!added.length) return;
    added.forEach((id) => seen.current.add(id));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setFresh((current) => new Set([...current, ...added]));
    const timer = setTimeout(() => {
      setFresh((current) => new Set([...current].filter((id) => !added.includes(id))));
    }, durationMs);
    return () => clearTimeout(timer);
  }, [ids, durationMs]);
  return fresh;
}

// True for `durationMs` after `value` turns from true to false (a proof or unexposed frame getting its details).
export function useFinished(value: boolean, durationMs: number): boolean {
  const was = useRef(value);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (was.current && !value) {
      was.current = false;
      setFinished(true);
      const timer = setTimeout(() => setFinished(false), durationMs);
      return () => clearTimeout(timer);
    }
  }, [value, durationMs]);
  return finished;
}
