"use client";

import { useEffect, useState } from "react";
import type { LogicalDate } from "../logical-date";

/**
 * Loads what is saved for one day and reloads when the day changes.
 * `value` is undefined while loading. `load` must be a stable function
 * (defined outside the component).
 */
export function useDayEntry<T>(date: LogicalDate | null, load: (date: LogicalDate) => Promise<T>) {
  const [loaded, setLoaded] = useState<{ date: LogicalDate; value: T } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    load(date)
      .then((value) => {
        if (cancelled) return;
        setLoaded({ date, value });
        setError(null);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [date, load, version]);

  return {
    // Never show one day's entry under another day's heading.
    value: loaded && loaded.date === date ? loaded.value : undefined,
    error,
    reload: () => setVersion((v) => v + 1),
  };
}

/** Runs a save or delete, tracking "busy" and any error message. */
export function useAction(after: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      after();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}
