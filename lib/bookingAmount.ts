/**
 * What a booking is worth, and the extra time a provider may ask the client for.
 *
 * SHARED: byte-identical in the app (lib/bookingAmount.ts) and on the website
 * (src/lib/bookingAmount.ts); scripts/shared-hash.mjs holds the two together.
 * Pure — no Firebase, no I/O — so both products' unit tests import it directly.
 *
 * THE AMOUNT. Until 7.11.2026 ending a job wrote `actualTotal` = the hourly
 * price × the minutes since "start", so a job closed a few minutes in was
 * recorded as having earned ₪1 in 0 hours. Ending now writes the agreed amount
 * (endJob in both products), and the owner's rule is that the agreed amount is
 * the minimum. The old records stay as they are — the rules freeze a settled
 * booking, and production data is not edited by hand — so every card and every
 * sum reads a booking's amount through bookingAmount(): the agreed amount (an
 * approved extension is part of it), never less. A recorded figure above it
 * counts only for a job closed before the rule (AGREED_AMOUNT_FROM), when the
 * bill ran by the minute: since then extra comes only through an extension.
 *
 * THE EXTENSION. Extra time is never charged by itself (Ofek: "the agreed
 * amount is the minimum; extra only through an extension the client
 * approves"). The provider asks for N more hours: `extRequest` on the booking.
 * The client sees the new total and answers. Approving moves `hours` and
 * `total` to what was asked and keeps the first agreed figures in `origHours`
 * and `origTotal`; either answer is left in `extResult` for the provider to
 * see, and the request is removed. firestore.rules checks each of these writes
 * against exactly what the functions below build — change one, change both.
 */

/** The fields an amount is read from. Loose on purpose: old records vary. */
export interface AmountFields {
  total?: number | null;
  hours?: number | string | null;
  pricePerHour?: number | string | null;
  actualTotal?: number | string | null;
  /** When the job was closed (ISO), by endJob in both products. */
  finishedAt?: string | null;
}

/**
 * From here on a job is worth what was agreed. The rules still let a closing
 * write record up to twice the total (builds that billed by the minute are
 * still on phones), so a higher figure on a job closed since is not counted —
 * or a provider could put any amount on the client's history and the admin's
 * revenue without an extension (review 13.11.2026).
 */
export const AGREED_AMOUNT_FROM = '2026-11-08T00:00:00.000Z';

/** A number, or NaN for anything that is not one (null, '', 'abc'). */
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

/**
 * What was agreed for the job: its total, or the hourly price × the hours when
 * no total was stored. 0 when neither can be read (a job posted with no budget).
 */
export function agreedTotal(b: AmountFields | null | undefined): number {
  const total = num(b?.total);
  if (total > 0) return total;
  const hours = num(b?.hours);
  const rate = num(b?.pricePerHour);
  if (hours > 0 && rate > 0) return Math.round(rate * hours);
  return 0;
}

/**
 * What the job is worth — on its card and in every sum (earnings, the business
 * summary, the admin's revenue). Never below the agreed amount. Above it only
 * for a job closed before AGREED_AMOUNT_FROM, or one with nothing agreed (no
 * budget: the recorded figure is all there is). Callers decide which statuses
 * count.
 */
export function bookingAmount(b: AmountFields | null | undefined): number {
  const agreed = agreedTotal(b);
  const actual = num(b?.actualTotal);
  if (!(actual > agreed)) return agreed;
  if (agreed <= 0) return actual;
  const fin = typeof b?.finishedAt === 'string' ? b.finishedAt : '';
  return fin !== '' && fin < AGREED_AMOUNT_FROM ? actual : agreed;
}

// ── The extension ────────────────────────────────────────────────────────────

/** The steps offered: half an hour at a time. */
export const EXTENSION_STEP_HOURS = 0.5;
/** The most a job may grow by, all its extensions together. The rules hold the same 4. */
export const EXTENSION_MAX_HOURS = 4;
/**
 * Where a request may stand and be answered: a job agreed and not yet over.
 * The provider is offered the button only once she has started (`active`); the
 * rules allow the three so that "undo start" does not strand a request.
 */
export const EXTENSION_LIVE: readonly string[] = ['confirmed', 'onway', 'active'];

export interface ExtensionRequest {
  /** The extra hours asked for. */
  hours: number;
  /** The job's total if the client approves. */
  total: number;
  /** When it was asked (ISO) — also what tells one request from the next. */
  at: string;
}

export interface ExtensionResult {
  status: 'approved' | 'declined';
  /** The extra hours that were asked for. */
  hours: number;
  /** The job's total after the answer: the new one, or the one that stays. */
  total: number;
  /** When the client answered (ISO). */
  at: string;
}

/** A booking as far as the extension is concerned. */
export interface ExtensionFields extends AmountFields {
  status?: string | null;
  origHours?: number | null;
  origTotal?: number | null;
  extRequest?: unknown;
  extResult?: unknown;
}

function asRequest(v: unknown): ExtensionRequest | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  return typeof r.hours === 'number' && r.hours > 0 && typeof r.total === 'number' && typeof r.at === 'string'
    ? { hours: r.hours, total: r.total, at: r.at }
    : null;
}

/** The request waiting for the client's answer — on a job still under way only. */
export function pendingExtension(b: ExtensionFields | null | undefined): ExtensionRequest | null {
  if (!b || !EXTENSION_LIVE.includes(String(b.status))) return null;
  return asRequest(b.extRequest);
}

/** The client's last answer, for the provider's card. None while a new request waits. */
export function lastExtensionAnswer(b: ExtensionFields | null | undefined): ExtensionResult | null {
  if (!b || pendingExtension(b)) return null;
  const r = b.extResult as Record<string, unknown> | null | undefined;
  if (!r || typeof r !== 'object') return null;
  if (r.status !== 'approved' && r.status !== 'declined') return null;
  if (typeof r.hours !== 'number' || typeof r.total !== 'number' || typeof r.at !== 'string') return null;
  return { status: r.status, hours: r.hours, total: r.total, at: r.at };
}

/** Same request — what the client was shown is still what stands. */
export function sameExtension(a: ExtensionRequest | null | undefined, b: ExtensionRequest | null | undefined): boolean {
  return !!a && !!b && a.at === b.at && a.hours === b.hours && a.total === b.total;
}

/**
 * How many more hours this job may still grow by. 0 when its hours or total
 * are not plain numbers (a job with no budget has no rate to extend at).
 */
export function extensionRoom(b: ExtensionFields | null | undefined): number {
  const hours = b?.hours;
  const total = b?.total;
  if (typeof hours !== 'number' || !(hours > 0) || typeof total !== 'number' || !(total > 0)) return 0;
  const base = typeof b?.origHours === 'number' && b.origHours > 0 ? b.origHours : hours;
  return Math.max(0, base + EXTENSION_MAX_HOURS - hours);
}

/** The choices offered: +½ hour, +1, … up to whatever room is left. */
export function extensionOptions(b: ExtensionFields | null | undefined): number[] {
  const room = extensionRoom(b);
  const out: number[] = [];
  for (let i = 1; i * EXTENSION_STEP_HOURS <= room + 1e-9; i++) out.push(i * EXTENSION_STEP_HOURS);
  return out;
}

/** Offer "more time": a job she has started, nothing already waiting, room left. */
export function canAskForExtension(b: ExtensionFields | null | undefined): boolean {
  return b?.status === 'active' && !pendingExtension(b) && extensionOptions(b).length > 0;
}

/**
 * The total for `extra` more hours, at the rate the job was agreed at — its
 * total over its hours, so a discount carries over. Always above the current
 * total: the rules refuse a request that does not raise it.
 */
export function extensionTotal(b: ExtensionFields, extra: number): number {
  const hours = Number(b.hours);
  const total = Number(b.total);
  return Math.max(total + 1, Math.round(total + (extra * total) / hours));
}

/** The request for `extra` hours, or null when it may not be asked. */
export function extensionRequestOf(
  b: ExtensionFields | null | undefined,
  extra: number,
  now: Date = new Date(),
): ExtensionRequest | null {
  if (!b || !canAskForExtension(b) || !extensionOptions(b).includes(extra)) return null;
  return { hours: extra, total: extensionTotal(b, extra), at: now.toISOString() };
}

/**
 * What approving writes (beside removing the request): the hours and total as
 * asked, the first agreed figures kept, the answer for the provider.
 */
export function extensionApproval(
  b: ExtensionFields | null | undefined,
  now: Date = new Date(),
): { hours: number; total: number; origHours: number; origTotal: number; extResult: ExtensionResult } | null {
  const req = pendingExtension(b);
  if (!b || !req || typeof b.hours !== 'number' || typeof b.total !== 'number') return null;
  return {
    hours: b.hours + req.hours,
    total: req.total,
    origHours: typeof b.origHours === 'number' ? b.origHours : b.hours,
    origTotal: typeof b.origTotal === 'number' ? b.origTotal : b.total,
    extResult: { status: 'approved', hours: req.hours, total: req.total, at: now.toISOString() },
  };
}

/** What declining writes (beside removing the request): the answer, with the total that stays. */
export function extensionDecline(
  b: ExtensionFields | null | undefined,
  now: Date = new Date(),
): { extResult: ExtensionResult } | null {
  const req = pendingExtension(b);
  if (!b || !req || typeof b.total !== 'number') return null;
  return { extResult: { status: 'declined', hours: req.hours, total: b.total, at: now.toISOString() } };
}

/**
 * The terms a job was first agreed on, before any extension — what the next
 * visit of a recurring job is booked at. An extension is for this visit only.
 */
export function termsBeforeExtension(b: ExtensionFields | null | undefined): { hours: unknown; total: unknown } {
  return {
    hours: typeof b?.origHours === 'number' ? b.origHours : b?.hours,
    total: typeof b?.origTotal === 'number' ? b.origTotal : b?.total,
  };
}
