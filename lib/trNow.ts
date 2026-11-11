/**
 * The screen's language for code that runs outside a component — validation,
 * alerts raised from listeners, the calendar prompt. Those returned Hebrew to
 * everyone; they now read the language the user picked (Phase 3, 11.11.2026).
 *
 * LanguageProvider keeps `current` in step with the picker. Before the saved
 * language has loaded it is Hebrew, the app's default.
 */
import translations, { type Lang } from './translations';

let current: Lang = 'he';

export function setTrLang(l: Lang): void {
  current = l;
}

export function trLang(): Lang {
  return current;
}

/** The text for `key` in the current language, `{name}` placeholders filled. */
export function trNow(key: string, vars?: Record<string, string | number>): string {
  const pick = (L: Lang) => (translations as any)[L]?.[key];
  let text = String(pick(current) ?? pick('he') ?? key);
  for (const [k, v] of Object.entries(vars ?? {})) text = text.split('{' + k + '}').join(String(v));
  return text;
}
