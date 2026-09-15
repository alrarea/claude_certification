import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@claude-cert/shared";

const STORAGE_KEY = "cert-prep-locale";

interface LocaleState {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleState | null>(null);

/**
 * The reader's chosen content language.
 *
 * Stored in localStorage rather than on the server for now: the choice has to
 * survive a refresh on the login screen too, where there is no user yet to
 * attach it to. Every read and write is guarded, because localStorage throws
 * outright in some privacy modes rather than returning null - and a language
 * preference is never worth taking the page down for.
 */
function read(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LOCALES as string[]).includes(stored)) return stored as Locale;
  } catch {
    // Storage unavailable; fall through to the default.
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(read);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session.
    }
  }, []);

  // Keeps the document language honest for screen readers and for the
  // font stack, which selects a Malayalam face off :lang(ml).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside a LocaleProvider");
  return ctx;
}
