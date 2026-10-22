import { PASSWORD_RULES } from "@claude-cert/shared";

export function passwordMeetsRules(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

// Live checklist under a new-password field. Rules stay neutral until the
// user starts typing, then each one turns green or red as they type - the
// same rules the server enforces, from @claude-cert/shared.
export function PasswordRules({ value }: { value: string }) {
  const touched = value.length > 0;

  return (
    <ul className="password-rules" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        const state = !touched ? "pending" : met ? "met" : "unmet";
        return (
          <li key={rule.id} className={`password-rule password-rule-${state}`}>
            <span aria-hidden="true">{state === "met" ? "✓" : state === "unmet" ? "✗" : "•"}</span>
            {rule.label}
            {touched && <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>}
          </li>
        );
      })}
    </ul>
  );
}
