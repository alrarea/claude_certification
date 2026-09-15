/**
 * The controlled vocabularies for content addressing: which language, and
 * which depth. Both mirror Postgres enums in schema.prisma.
 *
 * This file exists because the mode union had drifted into four independent
 * copies - the Prisma enum, apps/web/src/lib/contentModes.ts, an inline cast
 * in courses.ts, and a `type Mode` in each of the ingest and export scripts -
 * with nothing deriving from a single source. Adding a second dimension to
 * that would have meant keeping eight lists in step. Import from here instead.
 */

export type Locale = "en" | "ml";
export type ContentMode = "in_depth" | "normal" | "concise";

/** The language content falls back to when a translation does not exist. */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  // Endonym, not "Malayalam" - a language picker is one of the few places
  // the reader may not yet be able to read the interface language.
  ml: "മലയാളം",
};

export const LOCALES = Object.keys(LOCALE_LABELS) as Locale[];

export const MODE_LABELS: Record<ContentMode, string> = {
  in_depth: "In-depth",
  normal: "Normal",
  concise: "Concise",
};

export const CONTENT_MODES = Object.keys(MODE_LABELS) as ContentMode[];

/**
 * Narrow an untrusted query-string value, or return null.
 *
 * Callers must reject rather than cast. The pre-existing `as` cast on the
 * `?mode=` parameter let any string reach a Prisma enum column, where a bad
 * value surfaced as an unhandled database error rather than a 400.
 */
export function parseLocale(value: unknown): Locale | null {
  return typeof value === "string" && (LOCALES as string[]).includes(value)
    ? (value as Locale)
    : null;
}

export function parseContentMode(value: unknown): ContentMode | null {
  return typeof value === "string" && (CONTENT_MODES as string[]).includes(value)
    ? (value as ContentMode)
    : null;
}
