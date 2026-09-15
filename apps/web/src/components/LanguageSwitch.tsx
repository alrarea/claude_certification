import { LOCALE_LABELS, LOCALES } from "@claude-cert/shared";
import { useLocale } from "../lib/LocaleContext";

/**
 * Switches the language course content is shown in.
 *
 * Each option is labelled in its own language - "മലയാളം", not "Malayalam" -
 * because a language picker is the one control a reader may need to use
 * before they can read the interface it sits in.
 */
export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="lang-switch" role="group" aria-label="Content language">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={`lang-option ${l === locale ? "active" : ""}`}
          aria-pressed={l === locale}
          lang={l}
          onClick={() => setLocale(l)}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
