"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { UI, type UiLocale, type UiStrings } from "@/lib/i18n/ui";
import { load, save } from "@/lib/client/storage";

const KEY = "pretty-recipes:locale";
const listeners = new Set<() => void>();

function readLocale(): UiLocale {
  const stored = load<UiLocale>(KEY);
  if (stored === "fr" || stored === "en") return stored;
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

const Ctx = createContext<{ locale: UiLocale; t: UiStrings; setLocale: (l: UiLocale) => void } | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readLocale,
    () => "en" as UiLocale,
  );
  const setLocale = useCallback((l: UiLocale) => {
    save(KEY, l);
    document.documentElement.lang = l;
    listeners.forEach((cb) => cb());
  }, []);
  const value = useMemo(() => ({ locale, t: UI[locale], setLocale }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUi must be used inside LocaleProvider");
  return v;
}
