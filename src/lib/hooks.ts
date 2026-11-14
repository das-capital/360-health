"use client";

import { useSyncExternalStore } from "react";
import { logicalDate, type LogicalDate } from "./logical-date";

function subscribeToClock(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/**
 * The current logical day. Null for the first instant while the page loads,
 * then it updates by itself when the 4 am rollover passes or the app is reopened.
 */
export function useLogicalToday(): LogicalDate | null {
  return useSyncExternalStore(
    subscribeToClock,
    () => logicalDate(),
    () => null,
  );
}

const LOCAL_EVENT = "local-setting-changed";

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * A value kept only on this device (browser local storage). It never goes to
 * the database or the server. Returns [value, set]; set(null) removes it.
 */
export function useDeviceSetting(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribeToStorage,
    () => readLocal(key),
    () => null,
  );
  const set = (next: string | null) => {
    if (next === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, next);
    window.dispatchEvent(new Event(LOCAL_EVENT));
  };
  return [value, set];
}

/** Local-storage key for the Gemini API key (device only, see CLAUDE.md section 1). */
export const GEMINI_KEY_STORAGE = "gemini_api_key";
