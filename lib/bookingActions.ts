import { startDateOf, endDateOf, bookingHours } from './bookingSlot';

/**
 * What claiming, approving and rejecting a booking actually write.
 *
 * Three ways a cleaner ends up with a job, and they used to end differently:
 *
 *   • A client picks a cleaner    -> booking is `pending`, the cleaner approves.
 *   • A client posts urgent work  -> the cleaner claims, then approves.
 *   • A client posts a job        -> the cleaner claimed straight to `confirmed`.
 *
 * The third had no approval step at all, so the screen with the client's
 * address, the chat and the two buttons never appeared for it — a cleaner could
 * find themselves committed to a job without ever seeing that screen. All three
 * now stop at `pending` and wait for the same decision.
 *
 * The decisions live here, with no I/O, because the callers are a 3,000-line
 * screen and a chat screen and neither can be tested. See lib/resolveRole.ts and
 * lib/verifyRule.ts — same reasoning.
 */

export interface ClaimableBooking {
  id?: string;
  status?: string;
  hours?: number;
  /** YYYY-MM-DD */
  bookingDate?: string;
  /** HH:mm */
  startTime?: string;
  open?: boolean;
  origin?: string;
  clientUid?: string;
  cleanerId?: string;
}

/**
 * The write that claims an open job off the board.
 *
 * `status` stays `pending` on purpose. It used to go straight to `confirmed`,
 * which is what removed the approval step for this route.
 */
export interface ClaimWrite {
  cleanerId: string;
  cleanerName: string;
  open: boolean;
  status: string;
  busyFrom?: string;
  busyUntil?: string;
}

export function claimUpdate(cleanerId: string, cleanerName: string, b?: ClaimableBooking): ClaimWrite {
  const base: ClaimWrite = { cleanerId, cleanerName, open: false, status: 'pending' };
  // A job posted to the board is written with no busyFrom/busyUntil, and those
  // are the only fields toSlots publishes to `busySlots`. So a cleaner holding a
  // board job still showed a green "available now" dot to every client in both
  // products, and isAvailableNow ranked them as free. The window is knowable at
  // claim time; write it then.
  const win = busyWindowOf(b);
  if (win) { base.busyFrom = win.from; base.busyUntil = win.until; }
  return base;
}

/**
 * The window a booking occupies, as the ISO strings `busySlots` stores.
 *
 * Delegates to lib/bookingSlot rather than parsing again. The first version
 * re-implemented the parse and re-introduced a bug that module had already
 * fixed and already tests: it compared back only the hour and the day, so
 * `2026-13-05` rolled into January 2027 and blocked an hour four months later,
 * and `0026-01-15` blocked one in 1926. startDateOf compares back all five
 * fields precisely because "month 13 and day 32 roll over the same silent way".
 *
 * Null when the instant cannot be read — a guessed window would block hours the
 * cleaner never agreed to.
 */
export function busyWindowOf(b: ClaimableBooking | null | undefined): { from: string; until: string } | null {
  if (!b) return null;
  const from = startDateOf(b);
  const until = endDateOf(b);
  if (!from || !until) return null;
  return { from: from.toISOString(), until: until.toISOString() };
}

/**
 * A booking waiting on me whose start time has already gone by.
 *
 * Nothing else closes these. Every existing sweep filters on
 * ['confirmed','active','onway'], so a job claimed off the board and never
 * approved sat off the board, invisible to other cleaners, uncancelled and
 * unreviewed, for good. That was not a problem before, because claiming used to
 * write `confirmed` and the sweeps caught it.
 */
export function pendingSlotMissed(
  b: ClaimableBooking,
  myUid: string,
  now: Date = new Date(),
): boolean {
  // Only a job this cleaner actively TOOK, and only one that lapsed recently.
  //
  // The first version used awaitsMyApproval, which matches any pending booking
  // assigned to me — including a direct request from a client the cleaner never
  // opened. Opening the app then cancelled every such request going back
  // months, and each of those clients got the full-screen "your cleaner
  // cancelled your booking" dialog, months late, for something that had been
  // quietly dead the whole time. A request the client sent is theirs to
  // withdraw; only what the cleaner claimed is the cleaner's to abandon.
  //
  // The window keeps it from reaching back into history the first time a
  // long-absent cleaner opens the app.
  // `pending` explicitly. occupiesCleanerTime is also true for confirmed,
  // active and on-the-way jobs, so without this the sweep cancelled CONFIRMED
  // work whose slot had passed — jobs that very likely happened.
  if (b?.status !== 'pending') return false;
  if (!occupiesCleanerTime(b) || b.cleanerId !== myUid) return false;
  if (!slotHasPassed(b, now)) return false;
  const start = startDateOf(b);
  return start !== null && now.getTime() - start.getTime() <= MISSED_CLAIM_WINDOW_MS;
}

/** How far back the missed-claim sweep reaches. Older than this is history. */
export const MISSED_CLAIM_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The write that turns a rejection into the right outcome.
 *
 * A job the client posted to the board belongs to the client, not to whoever
 * happened to claim it — cancelling it because one cleaner changed their mind
 * would destroy the client's request and they would have to post it again.
 * It goes back on the board instead, exactly as it was.
 *
 * A booking addressed to this cleaner specifically has nowhere to go back to,
 * so a rejection is a cancellation.
 */
export function rejectionUpdate(b: ClaimableBooking, now: Date = new Date()) {
  if (rejectionReleasesToBoard(b, now)) {
    return {
      open: true,
      cleanerId: '',
      cleanerName: '',
      status: 'pending',
      releasedAt: now.toISOString(),
      // Cleared with the claim. A probe showed the released document keeping the
      // window the claim wrote, so a job back on the board still carried a busy
      // slot naming hours no one is working — and whoever next derives busySlots
      // from it publishes that.
      busyFrom: '',
      busyUntil: '',
    };
  }
  return {
    status: 'cancelled',
    cancelledBy: 'cleaner',
    cancelledAt: now.toISOString(),
  };
}

/**
 * Does rejecting this booking put it back on the board rather than end it?
 *
 * Only a board job, only while it is still awaiting this decision, and only if
 * the slot has not already passed. The last two matter:
 *
 *   • Releasing a job that is done, cancelled or under way would turn a settled
 *     record back into a live advert. The Firestore rules refuse that outright;
 *     this keeps the client from ever sending the write.
 *   • Releasing a job whose time is behind us puts yesterday's cleaning back on
 *     every cleaner's board, where nothing filters it out and it sits for good.
 *     Past its slot, walking away is a cancellation.
 */
export function rejectionReleasesToBoard(b: ClaimableBooking, now: Date = new Date()): boolean {
  if (b?.origin !== 'open') return false;
  if (b?.status !== 'pending') return false;
  return !slotHasPassed(b, now);
}

/**
 * Has the booked start time already gone by? Unreadable times count as not passed.
 *
 * Same parser as busyWindowOf, deliberately. These two used to read the same
 * date differently — `Date.parse` accepts `2026-02-30` as 2 March and `24:00`
 * as the next midnight, while the other rejected both — so one function called
 * a booking unreadable and the other gave it a real instant. A job whose date
 * was nonsense then wrote no busy window AND refused to go back on the board.
 */
function slotHasPassed(b: ClaimableBooking, now: Date): boolean {
  const start = startDateOf(b);
  return start !== null && start.getTime() <= now.getTime();
}

/**
 * Is this booking waiting for THIS cleaner to say yes or no?
 *
 * What the approve/reject bar keys off. Deliberately strict: assigned to me,
 * still pending, and no longer on the board — a job still open is one anybody
 * can claim, and showing an approve button for it would be a lie.
 */
export function awaitsMyApproval(b: ClaimableBooking, myUid: string): boolean {
  if (!b || !myUid) return false;
  if (b.status !== 'pending') return false;
  if (b.open === true) return false;
  return b.cleanerId === myUid;
}

/** Statuses where the cleaner has said yes and is expected somewhere. */
const COMMITTED = ['confirmed', 'active', 'onway'];

/**
 * Does this booking hold the cleaner's time?
 *
 * Not the same question as "is it confirmed". A job the cleaner claimed off the
 * board is `pending` until they approve it — but they claimed it, it is off the
 * board, and nobody else can take it, so it holds their hour just as firmly as
 * a confirmed one. Leaving it out is what let the board keep offering them
 * overlapping work, and what would have let them approve a second job at the
 * same time without a word of warning.
 *
 * A booking a CLIENT sent that this cleaner has not accepted is deliberately
 * not counted: they may still reject it, and blocking their calendar on
 * somebody else's request would let anyone freeze a cleaner's day by sending
 * bookings they never answer.
 */
export function occupiesCleanerTime(b: ClaimableBooking | null | undefined): boolean {
  if (!b) return false;
  if (COMMITTED.includes(String(b.status))) return true;
  // A claimed board job OR a claimed urgent job. Both are off the board with
  // this cleaner's name on them and nobody else can take either — the argument
  // is identical, and leaving urgent out left that route double-bookable.
  // `open === true` means still on the board — anybody's to take, nobody's
  // commitment. A document written before `origin` existed carries no origin at
  // all; treating it as unclaimed left its hour unblocked, so a job that is off
  // the board with a cleaner's name on it counts regardless of origin.
  return b.status === 'pending'
    && b.origin !== 'direct'
    && b.open !== true
    && !!b.cleanerId;
}
