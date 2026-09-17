/**
 * The city in an address, for the one place a job's location is public.
 *
 * A board job is readable by every signed-in account, so it carries the city
 * and nothing finer; the street, floor and flat live in its private details.
 * Both post forms start from a saved FULL address — "street, city, floor, flat",
 * the shape the app builds — and the city used to be dug out of it in ways that
 * were each wrong often enough to matter:
 *
 *   - the longest known city name found ANYWHERE in the text. Streets are named
 *     after cities all over the country, so "שדרות ירושלים 5, חריש" was posted
 *     in ירושלים, 77 km away: out of range for every cleaner in חריש, and not
 *     found by a search for חריש;
 *   - with no known city, the last comma-separated part (the app) or the first
 *     (the web form) — "דירה 3", or the street itself, on a public document.
 *
 * So a part that IS a known city wins, searched from the end, where the city
 * sits. Then a known city inside a later part that is not a street, a floor or
 * a flat. A city name straight after a street word is the street ("שדרות
 * ירושלים"), and in text with no commas the city that ends last is taken — the
 * city is written after the street far more often than before it. With no known
 * city at all, a town the table does not list is still better than nothing,
 * provided it cannot be the street or the flat.
 *
 * Spelling is compared loosely — ״ and ", hyphens and spaces, קרית and קריית —
 * because "ת״א", "תל-אביב" and "קרית שמונה" are how people type them.
 *
 * Byte-identical in both products. The city table is passed in because each
 * product keeps its own copy of it.
 */

const STREET_WORDS = ['רחוב', "רח'", 'שדרות', "שד'", 'דרך', 'סמטת', 'כיכר', 'שביל', 'משעול'];
const NOT_A_PLACE = /^(קומה|דירה|כניסה|בית פרטי)(\s|$)/;

function norm(s: string): string {
  return s
    .replace(/[״”“]/g, '"')
    .replace(/[׳’‘]/g, "'")
    .replace(/[-־–]/g, ' ')
    .replace(/קריית/g, 'קרית')
    .replace(/\s+/g, ' ')
    .trim();
}

const tables = new WeakMap<object, { k: string; n: string }[]>();

function keysOf(known: Record<string, unknown>): { k: string; n: string }[] {
  let keys = tables.get(known);
  if (!keys) {
    keys = Object.keys(known)
      .map((k) => ({ k, n: norm(k) }))
      .sort((a, b) => b.n.length - a.n.length);
    tables.set(known, keys);
  }
  return keys;
}

export function cityFromAddress(raw: string, known: Record<string, unknown>): string {
  const text = norm(String(raw || ''));
  if (!text) return '';
  const keys = keysOf(known);
  const exact = (s: string) => keys.find((x) => x.n === s)?.k ?? '';
  const hasDigit = (s: string) => /\d/.test(s);
  const streetLike = (s: string) => STREET_WORDS.some((w) => s === w || s.startsWith(w + ' '));
  const edge = (c: string | undefined) => c === undefined || /[\s,.]/.test(c);

  // A known city inside some text: whole words only, never straight after a
  // street word, and the one that ends last.
  const inside = (s: string) => {
    let best: { k: string; end: number; len: number } | null = null;
    for (const { k, n } of keys) {
      for (let at = s.indexOf(n); at >= 0; at = s.indexOf(n, at + 1)) {
        if (!edge(s[at - 1]) || !edge(s[at + n.length])) continue;
        const before = s.slice(0, at).trim();
        if (STREET_WORDS.some((w) => before === w || before.endsWith(' ' + w))) continue;
        const end = at + n.length;
        if (!best || end > best.end || (end === best.end && n.length > best.len)) {
          best = { k, end, len: n.length };
        }
      }
    }
    return best ? best.k : '';
  };

  const whole = exact(text);
  if (whole) return whole;

  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    return inside(text) || (hasDigit(text) || streetLike(text) || NOT_A_PLACE.test(text) ? '' : text);
  }
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const hit = exact(parts[i]);
    if (hit) return hit;
  }
  const placeLike = (p: string) => !hasDigit(p) && !streetLike(p) && !NOT_A_PLACE.test(p);
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (!placeLike(parts[i])) continue;
    const hit = inside(parts[i]);
    if (hit) return hit;
  }
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (placeLike(parts[i])) return parts[i];
  }
  return '';
}
