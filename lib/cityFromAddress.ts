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
 * sits. Then a known city inside a later part with no digits in it — house,
 * floor and flat numbers carry digits, town names do not, and the first part is
 * the street. With no known city at all, a town the table does not list is
 * still better than nothing, provided it cannot be the street or the flat: the
 * last digit-free part after the first.
 *
 * Byte-identical in both products. The city table is passed in because each
 * product keeps its own copy of it.
 */
export function cityFromAddress(raw: string, known: Record<string, unknown>): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const isKnown = (s: string) => Object.prototype.hasOwnProperty.call(known, s);
  if (isKnown(text)) return text;

  const byLength = Object.keys(known).sort((a, b) => b.length - a.length);
  const inside = (s: string) => byLength.find((k) => s.includes(k)) ?? '';
  const hasDigit = (s: string) => /\d/.test(s);
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);

  // Nothing to tell the street from the city by. Take a known city inside it,
  // or the text itself when it has no number and so cannot be a street address.
  if (parts.length === 1) return inside(text) || (hasDigit(text) ? '' : text);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (isKnown(parts[i])) return parts[i];
  }
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (hasDigit(parts[i])) continue;
    const hit = inside(parts[i]);
    if (hit) return hit;
  }
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    if (!hasDigit(parts[i]) && parts[i] !== 'בית פרטי') return parts[i];
  }
  return '';
}
