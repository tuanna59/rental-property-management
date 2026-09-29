"use client";

import * as React from "react";

import {
  isThemePreference,
  resolveTheme,
  THEME_EVENT,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  if (typeof document !== "undefined") {
    const fromDataset = document.documentElement.dataset.themePreference;
    if (isThemePreference(fromDataset)) return fromDataset;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(stored)) return stored;
    } catch {}
  }
  return "system";
}

function readResolvedTheme(preference: ThemePreference): ResolvedTheme {
  if (typeof document !== "undefined") {
    const resolved = document.documentElement.dataset.theme;
    if (resolved === "light" || resolved === "dark") return resolved;
  }
  const prefersDark = typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
  return resolveTheme(preference, prefersDark);
}

function applyTheme(preference: ThemePreference) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(preference, prefersDark);
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>(() => readPreference());
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() => readResolvedTheme(readPreference()));

  const setPreference = React.useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    const resolved = applyTheme(next);
    setPreferenceState(next);
    setResolvedTheme(resolved);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const sync = () => {
      const nextPreference = readPreference();
      setPreferenceState(nextPreference);
      setResolvedTheme(applyTheme(nextPreference));
    };

    const onThemeEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isThemePreference(detail)) {
        setPreferenceState(detail);
        setResolvedTheme(applyTheme(detail));
        return;
      }
      sync();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) sync();
    };

    const onSystemChange = () => {
      if (readPreference() !== "system") return;
      setResolvedTheme(applyTheme("system"));
    };

    sync();
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_EVENT, onThemeEvent);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_EVENT, onThemeEvent);
    };
  }, []);

  const value = React.useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = React.useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
