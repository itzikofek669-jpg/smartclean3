/**
 * Keeping a client and a cleaner booking each other through the app (Ofek,
 * 18.11.2026). After a first good cleaning the two could swap numbers and go on
 * privately: nothing in the app asked to book her again, and nobody could see
 * how often a pair stopped after one visit.
 *
 * Shared by the app and the website, byte for byte (scripts/shared-hash.mjs):
 *   shouldOfferRebook — once the client has rated a job, offer to book the
 *                       same cleaner again.
 *   pairRetention     — for the admin screen: how many client–cleaner pairs
 *                       came back, and how many stopped after one cleaning.
 *   cleanerLevel      — silver and gold, earned by jobs done through the app.
 *
 * No imports, so the node tests compile it as it is.
 */

/** Under way right now. */
const UNDER_WAY = ['onway', 'active'];

/** One cleaning, then nothing booked between them for this long: they stopped. */
export const GONE_AFTER_DAYS = 30;

export interface RetentionBooking {
  id?: string;
  status?: string;
  clientUid?: string;
  cleanerId?: string;
  /** Older documents name the cleaner this way. */
  cleanerUid?: string;
  bookingDate?: string;
  startTime?: string;
  finishedAt?: string;
  createdAt?: string;
  cleanerRating?: number | null;
}

const cleanerOf = (b: RetentionBooking | null | undefined): string =>
  String(b?.cleanerId || b?.cleanerUid || '');

/** Its start is still ahead. Unreadable counts as ahead — nothing says it is over. */
function slotAhead(b: RetentionBooking, now: Date): boolean {
  const start = Date.parse(`${b.bookingDate || ''}T${b.startTime || '00:00'}`);
  return Number.isNaN(start) || start > now.getTime();
}

/**
 * Something booked with her that is still to happen: under way, or confirmed
 * or awaiting an answer with its hour ahead. A request she never answered
 * stays 'pending' after its hour for good (lib/bookingActions leaves those),
 * and must not stand for a next visit.
 */
function bookedAhead(b: RetentionBooking, now: Date): boolean {
  const status = String(b.status);
  if (UNDER_WAY.includes(status)) return true;
  return (status === 'pending' || status === 'confirmed') && slotAhead(b, now);
}

/**
 * Offer "book her again" once the client has rated this job?
 *
 * Only after a good rating (4–5 stars): a client who just gave two stars does
 * not want to be asked. And not while the two already have something booked —
 * a recurring series makes its own next visit, and a client who has booked her
 * again already has no use for the question.
 *
 * `mine` is the client's own bookings, as fresh as their screen holds them.
 */
export function shouldOfferRebook(
  done: RetentionBooking | null | undefined,
  stars: unknown,
  mine: readonly (RetentionBooking | null | undefined)[],
  now: Date = new Date(),
): boolean {
  if (!done || done.status !== 'done') return false;
  if (!(Number(stars) >= 4)) return false;
  const cleaner = cleanerOf(done);
  if (!cleaner) return false;
  return !mine.some((b) => !!b && b.id !== done.id && cleanerOf(b) === cleaner && bookedAhead(b, now));
}

export interface PairRetention {
  /** Pairs with at least one finished cleaning. */
  pairs: number;
  /** Came back: two cleanings or more, or one with another booked (confirmed, or a request still ahead). */
  repeat: number;
  /** One cleaning, then nothing booked between them for GONE_AFTER_DAYS. */
  gone: number;
  /** Of `gone`: that one cleaning was rated 4–5 stars — the likeliest to have gone on privately. */
  goneHappy: number;
  /** One cleaning, too recent (or undated) to tell yet. */
  tooEarly: number;
}

/** When the cleaning happened, as a time in ms; NaN when nothing says. */
function whenOf(b: RetentionBooking): number {
  const fin = typeof b.finishedAt === 'string' ? Date.parse(b.finishedAt) : NaN;
  if (!Number.isNaN(fin)) return fin;
  if (b.bookingDate) {
    const slot = Date.parse(`${b.bookingDate}T${b.startTime || '00:00'}`);
    if (!Number.isNaN(slot)) return slot;
  }
  return Date.parse(String(b.createdAt || ''));
}

/**
 * How client–cleaner pairs behaved after their first cleaning together.
 *
 * Counted over the bookings handed in — the admin screens hold the latest few
 * hundred, so a pair whose earlier visits fell outside them can look newer than
 * it is. Cancelled and expired bookings say nothing about coming back and are
 * left out, and so is a request whose hour went by unanswered: the client did
 * come back to ask, but nothing came of it. A confirmed visit counts whatever
 * its date — one the provider never closed most likely happened.
 */
export function pairRetention(
  bookings: readonly (RetentionBooking | null | undefined)[],
  now: Date = new Date(),
): PairRetention {
  const byPair = new Map<string, { done: RetentionBooking[]; live: number }>();
  for (const b of bookings) {
    if (!b) continue;
    const client = String(b.clientUid || '');
    const cleaner = cleanerOf(b);
    if (!client || !cleaner) continue;
    const status = String(b.status);
    const live = UNDER_WAY.includes(status) || status === 'confirmed'
      || (status === 'pending' && slotAhead(b, now));
    if (status !== 'done' && !live) continue;
    const key = `${client}|${cleaner}`;
    const pair = byPair.get(key) ?? { done: [], live: 0 };
    if (status === 'done') pair.done.push(b);
    else pair.live += 1;
    byPair.set(key, pair);
  }

  const out: PairRetention = { pairs: 0, repeat: 0, gone: 0, goneHappy: 0, tooEarly: 0 };
  const cutoff = now.getTime() - GONE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  for (const pair of byPair.values()) {
    if (pair.done.length === 0) continue;
    out.pairs += 1;
    if (pair.done.length >= 2 || pair.live > 0) { out.repeat += 1; continue; }
    const at = whenOf(pair.done[0]);
    if (Number.isNaN(at) || at > cutoff) { out.tooEarly += 1; continue; }
    out.gone += 1;
    if (Number(pair.done[0].cleanerRating) >= 4) out.goneHappy += 1;
  }
  return out;
}

/** Share of pairs that came back, of those that can be told (0–100), or null with none yet. */
export function repeatRate(r: PairRetention): number | null {
  const known = r.repeat + r.gone;
  return known > 0 ? Math.round((r.repeat / known) * 100) : null;
}

// ── The cleaner's level ──────────────────────────────────────────────────────
// Built from jobs done through the app only (Ofek, 18.11.2026): her rating and
// review count can be written by nobody but a client rating a finished booking
// in the app (firestore.rules isValidRatingUpdate), so a job done privately —
// her own diary included (lib/workDiary) — adds nothing to it. That is the
// point: the level is what a client sees on her card, and it ranks her ahead
// of equally rated cleaners (lib/displayOrder compareCleaners).

export type CleanerLevel = 'gold' | 'silver' | null;

/** What each level asks: at least this many reviews, at least this average. */
export const LEVELS = {
  silver: { reviews: 5, rating: 4.5 },
  gold: { reviews: 20, rating: 4.8 },
} as const;

export interface LevelInput {
  /** The profile's id: sample profiles get no level (see cleanerLevel). */
  id?: unknown;
  rating?: unknown;
  /** Under any of the spellings the documents carry. */
  reviewCount?: unknown;
  reviewsCount?: unknown;
  reviews?: unknown;
}

const countOf = (c: LevelInput | null | undefined): number => {
  const n = Number(c?.reviewCount ?? c?.reviewsCount ?? c?.reviews ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const ratingOf = (c: LevelInput | null | undefined): number => {
  const r = Number(c?.rating ?? 0);
  return Number.isFinite(r) ? r : 0;
};

export function cleanerLevel(c: LevelInput | null | undefined): CleanerLevel {
  // Sample profiles — the website's bot-…, the app's bot_… and its numbered
  // mock list — carry made-up ratings. They get no level: on a test screen
  // nearly every card wore one, and it would rank them above real people.
  const id = c?.id == null ? '' : String(c.id);
  if (/^bot[-_]/.test(id) || /^\d+$/.test(id)) return null;
  const n = countOf(c);
  const r = ratingOf(c);
  if (n >= LEVELS.gold.reviews && r >= LEVELS.gold.rating) return 'gold';
  if (n >= LEVELS.silver.reviews && r >= LEVELS.silver.rating) return 'silver';
  return null;
}

/** For ordering: gold 2, silver 1, none 0. */
export function levelRank(level: CleanerLevel): number {
  return level === 'gold' ? 2 : level === 'silver' ? 1 : 0;
}

/**
 * What she has and what the next level needs: how many more rated jobs through
 * the app, and whether her average is short of it. null `next` at the top.
 */
export function levelProgress(c: LevelInput | null | undefined): {
  level: CleanerLevel;
  next: 'silver' | 'gold' | null;
  reviewsToGo: number;
  ratingNeeded: number | null;
  reviews: number;
  rating: number;
} {
  const level = cleanerLevel(c);
  const reviews = countOf(c);
  const rating = ratingOf(c);
  const next = level === 'gold' ? null : level === 'silver' ? 'gold' : 'silver';
  if (!next) return { level, next, reviewsToGo: 0, ratingNeeded: null, reviews, rating };
  const need = LEVELS[next];
  return {
    level,
    next,
    reviewsToGo: Math.max(0, need.reviews - reviews),
    ratingNeeded: rating >= need.rating ? null : need.rating,
    reviews,
    rating,
  };
}
