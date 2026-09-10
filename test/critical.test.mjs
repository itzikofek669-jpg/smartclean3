import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const bookingActionsUrl = new URL('../.tsbuild/bookingActions.mjs', import.meta.url).href;
const bookingSlotUrl = new URL('../.tsbuild/bookingSlot.mjs', import.meta.url).href;
import { resolveRole } from '../.tsbuild/resolveRole.mjs';
import { mustVerifyEmail, VERIFY_REQUIRED_FROM } from '../.tsbuild/verifyRule.mjs';
import { isAvailableNow } from '../.tsbuild/displayOrder.mjs';
import { startDateOf, endDateOf, bookingHours, DEFAULT_BOOKING_HOURS } from '../.tsbuild/bookingSlot.mjs';
import { readCalendarRemoval, extractPushData } from '../.tsbuild/calendarPush.mjs';
import { isUrgentRequestLive, isUrgentRequestExpired, expiryOf } from '../.tsbuild/urgentRequest.mjs';
import { claimUpdate, rejectionUpdate, rejectionReleasesToBoard, awaitsMyApproval, occupiesCleanerTime, busyWindowOf, busyFieldsOf, pendingSlotMissed, isBoardJobOfferable } from '../.tsbuild/bookingActions.mjs';

// Every case here is a bug that reached a real user. They are regression tests,
// not coverage: each one failed in production before it was written.

test('a profile document that has not been written yet is not a client', () => {
  // The bug: home mounts the moment the auth account exists, before registration
  // has written the profile. Concluding "client" gave a brand-new cleaner the
  // client home screen, permanently.
  assert.equal(resolveRole({ exists: false }), null);
});

test('role is read from the document once it exists', () => {
  assert.equal(resolveRole({ exists: true, data: { role: 'cleaner' } }), 'cleaner');
  assert.equal(resolveRole({ exists: true, data: { role: 'client' } }), 'client');
});

test('a document with no role field is a client', () => {
  assert.equal(resolveRole({ exists: true, data: {} }), 'client');
  assert.equal(resolveRole({ exists: true, data: null }), 'client');
});

const user = (verified, created) => ({ emailVerified: verified, metadata: { creationTime: created } });
const AFTER  = new Date(VERIFY_REQUIRED_FROM + 86400000).toUTCString();
const BEFORE = new Date(VERIFY_REQUIRED_FROM - 86400000).toUTCString();

test('a verified address is never asked to verify again', () => {
  assert.equal(mustVerifyEmail(user(true, AFTER)), false);
});

test('an account created before the cutoff is grandfathered', () => {
  // The bug this guards: demanding verification from every existing user would
  // lock out every client and cleaner already on the platform.
  assert.equal(mustVerifyEmail(user(false, BEFORE)), false);
});

test('an account created after the cutoff must verify', () => {
  assert.equal(mustVerifyEmail(user(false, AFTER)), true);
});

test('an unreadable creation time fails open, never closed', () => {
  // Locking a paying user out over a missing metadata field is worse than
  // leaving one address unverified.
  assert.equal(mustVerifyEmail(user(false, undefined)), false);
  assert.equal(mustVerifyEmail(user(false, 'not a date')), false);
});

// ── Availability ───────────────────────────────────────────────────────────
// The bug: this was computed in two places. The app subtracted the cleaner's
// busySlots; the website read the `available` flag alone. The same cleaner at
// the same moment was busy in one product and available in the other — and
// `available` is the first key compareCleaners sorts on, so the shared ordering
// drifted with it.

const AT = t => new Date(t);
const slot = (from, until) => ({ from, until });

test('a cleaner with no flag and no bookings is available', () => {
  assert.equal(isAvailableNow({}, AT('2026-09-06T10:00:00Z')), true);
});

test('switching yourself off wins over an empty calendar', () => {
  assert.equal(isAvailableNow({ available: false }, AT('2026-09-06T10:00:00Z')), false);
});

test('a cleaner inside an accepted booking is busy', () => {
  const doc = { busySlots: [slot('2026-09-06T09:00:00Z', '2026-09-06T12:00:00Z')] };
  assert.equal(isAvailableNow(doc, AT('2026-09-06T10:00:00Z')), false);
});

test('the end of a slot frees the cleaner, the start takes them', () => {
  const doc = { busySlots: [slot('2026-09-06T09:00:00Z', '2026-09-06T12:00:00Z')] };
  assert.equal(isAvailableNow(doc, AT('2026-09-06T09:00:00Z')), false, 'start is inside');
  assert.equal(isAvailableNow(doc, AT('2026-09-06T12:00:00Z')), true, 'end is not');
});

test('a booking that is over does not keep the cleaner busy', () => {
  const doc = { busySlots: [slot('2026-09-06T06:00:00Z', '2026-09-06T08:00:00Z')] };
  assert.equal(isAvailableNow(doc, AT('2026-09-06T10:00:00Z')), true);
});

test('a malformed slot never takes a working cleaner off the market', () => {
  // A bad timestamp is our bug. Failing closed would hide a real cleaner from
  // every client until someone noticed.
  const doc = { busySlots: [slot('not a date', ''), null, undefined] };
  assert.equal(isAvailableNow(doc, AT('2026-09-06T10:00:00Z')), true);
});

test('busySlots that is not an array is ignored, not thrown on', () => {
  assert.equal(isAvailableNow({ busySlots: null }, AT('2026-09-06T10:00:00Z')), true);
  assert.equal(isAvailableNow({ busySlots: 'nonsense' }, AT('2026-09-06T10:00:00Z')), true);
});

// ── Booking slots ──────────────────────────────────────────────────────────
// The bug: the shape regexes accept times that are not real times. '24:30'
// matches HH:mm, and new Date(y, m, d, 24, 30) is 00:30 the NEXT day — a real
// calendar event, on the wrong date, with every result code reporting success.
// Indistinguishable from "it never synced" to the person looking at their
// calendar.

const slotAt = (bookingDate, startTime, hours) => ({ bookingDate, startTime, hours });

test('a normal slot parses to exactly what was stored', () => {
  const d = startDateOf(slotAt('2026-09-06', '14:30'));
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);      // September
  assert.equal(d.getDate(), 6);
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 30);
});

test('an hour that rolls into the next day is rejected, not silently moved', () => {
  assert.equal(startDateOf(slotAt('2026-09-06', '24:30')), null);
  assert.equal(startDateOf(slotAt('2026-09-06', '99:00')), null);
});

test('a month or day that rolls over is rejected the same way', () => {
  assert.equal(startDateOf(slotAt('2026-13-06', '10:00')), null, 'month 13');
  assert.equal(startDateOf(slotAt('2026-09-32', '10:00')), null, 'day 32');
  assert.equal(startDateOf(slotAt('2026-02-30', '10:00')), null, '30 February');
});

test('a real leap day is accepted', () => {
  // The rollover check must not be so eager that it rejects valid dates.
  const d = startDateOf(slotAt('2028-02-29', '09:00'));
  assert.notEqual(d, null);
  assert.equal(d.getDate(), 29);
});

test('midnight is a valid start time', () => {
  const d = startDateOf(slotAt('2026-09-06', '00:00'));
  assert.notEqual(d, null);
  assert.equal(d.getHours(), 0);
});

test('a malformed or missing slot yields null, never a guess', () => {
  for (const bad of [
    slotAt('', ''), slotAt('2026-09-06', ''), slotAt('', '10:00'),
    slotAt('06/09/2026', '10:00'), slotAt('2026-9-6', '10:00'),
    slotAt('2026-09-06', '1030'), {}, null, undefined,
  ]) {
    assert.equal(startDateOf(bad), null, `${JSON.stringify(bad)} should not parse`);
  }
});

test('a booking with no stated length falls back to the default', () => {
  assert.equal(bookingHours(slotAt('2026-09-06', '10:00')), DEFAULT_BOOKING_HOURS);
  assert.equal(bookingHours(slotAt('2026-09-06', '10:00', 0)), DEFAULT_BOOKING_HOURS);
  assert.equal(bookingHours(slotAt('2026-09-06', '10:00', -3)), DEFAULT_BOOKING_HOURS);
  assert.equal(bookingHours(slotAt('2026-09-06', '10:00', 'abc')), DEFAULT_BOOKING_HOURS);
});

test('an event never ends before it starts', () => {
  // A negative or zero duration would produce exactly that, and the calendar
  // API accepts it without complaint.
  for (const h of [undefined, 0, -3, 'abc', NaN]) {
    const b = slotAt('2026-09-06', '10:00', h);
    assert.ok(endDateOf(b).getTime() > startDateOf(b).getTime(), `hours=${h}`);
  }
});

test('a stated length is honoured', () => {
  const b = slotAt('2026-09-06', '10:00', 3);
  assert.equal(endDateOf(b).getTime() - startDateOf(b).getTime(), 3 * 3600000);
});

test('an unreadable slot has no end either', () => {
  assert.equal(endDateOf(slotAt('2026-09-06', '24:30', 2)), null);
});

// ── Silent calendar push ───────────────────────────────────────────────────
// The payload arrives from the network. The only thing it may cause is the
// removal of an event this device created, for the user it names.

test('a cancellation push is read into a removal', () => {
  assert.deepEqual(
    readCalendarRemoval({ type: 'booking-cancelled', bookingId: 'bk1', uid: 'u1' }),
    { bookingId: 'bk1', uid: 'u1' },
  );
});

test('the spelling the apps already send is accepted too', () => {
  // The visible cancellation notification has carried `booking_cancelled`
  // since long before this task existed; reusing it is what lets the removal
  // work with no Cloud Function, which this project cannot deploy.
  assert.deepEqual(
    readCalendarRemoval({ type: 'booking_cancelled', bookingId: 'bk1', uid: 'u1' }),
    { bookingId: 'bk1', uid: 'u1' },
  );
});

test('a push of any other type removes nothing', () => {
  assert.equal(readCalendarRemoval({ type: 'message', bookingId: 'bk1', uid: 'u1' }), null);
  assert.equal(readCalendarRemoval({ bookingId: 'bk1', uid: 'u1' }), null, 'no type at all');
});

test('a payload missing either id removes nothing', () => {
  const base = { type: 'booking-cancelled', bookingId: 'bk1', uid: 'u1' };
  assert.equal(readCalendarRemoval({ ...base, bookingId: '' }), null);
  assert.equal(readCalendarRemoval({ ...base, uid: '' }), null);
  assert.equal(readCalendarRemoval({ ...base, bookingId: '   ' }), null, 'whitespace is empty');
  assert.equal(readCalendarRemoval({ ...base, bookingId: undefined }), null);
});

test('a non-string id is not coerced into one', () => {
  // `String(42)` would be a plausible id and a wrong one.
  const base = { type: 'booking-cancelled', bookingId: 'bk1', uid: 'u1' };
  assert.equal(readCalendarRemoval({ ...base, bookingId: 42 }), null);
  assert.equal(readCalendarRemoval({ ...base, uid: { toString: () => 'u1' } }), null);
});

test('a malformed payload is ignored, never guessed at', () => {
  for (const bad of [null, undefined, 'booking-cancelled', 42, []]) {
    assert.equal(readCalendarRemoval(bad), null, `${JSON.stringify(bad)}`);
  }
});

test('the notification payload is found in every shape the platforms send', () => {
  const payload = { type: 'booking-cancelled', bookingId: 'bk1', uid: 'u1' };
  const shapes = {
    'android headless (raw data)':   { data: payload },
    'ios notification object':       { request: { content: { data: payload } } },
    'wrapped notification':          { notification: { request: { content: { data: payload } } } },
    'android notification.data':     { notification: { data: payload } },
    'content.data':                  { content: { data: payload } },
    'already unwrapped':             payload,
  };
  for (const [name, shape] of Object.entries(shapes)) {
    assert.deepEqual(readCalendarRemoval(extractPushData(shape)),
      { bookingId: 'bk1', uid: 'u1' }, name);
  }
});

test('an unrecognised shape yields nothing rather than a guess', () => {
  for (const bad of [null, undefined, 42, 'x', {}, { data: {} }, { nope: { deep: 1 } }]) {
    assert.equal(readCalendarRemoval(extractPushData(bad)), null, JSON.stringify(bad));
  }
});

test('a self-referential payload does not hang the task', () => {
  const loop = {};
  loop.data = loop;
  assert.equal(extractPushData(loop), null);
});

// ── Urgent request expiry ──────────────────────────────────────────────────
// One question was being answered five times, three different ways. A legacy
// request with no `expiresAt` showed on both job boards, was invisible in the
// app's urgent popup, and was deleted out from under all of them the moment its
// owner opened their dashboard. An unparseable timestamp inverted every one of
// those at once, because `NaN > now` and `NaN <= now` are both false.

const AT2 = t => new Date(t);
const req = expiresAt => ({ expiresAt });

test('a request that has not yet lapsed is live and not deletable', () => {
  const r = req('2026-09-07T18:00:00Z');
  assert.equal(isUrgentRequestLive(r, AT2('2026-09-07T12:00:00Z')), true);
  assert.equal(isUrgentRequestExpired(r, AT2('2026-09-07T12:00:00Z')), false);
});

test('a request past its expiry is neither live nor kept', () => {
  const r = req('2026-09-07T10:00:00Z');
  assert.equal(isUrgentRequestLive(r, AT2('2026-09-07T12:00:00Z')), false);
  assert.equal(isUrgentRequestExpired(r, AT2('2026-09-07T12:00:00Z')), true);
});

test('the exact moment of expiry is over, not still running', () => {
  const r = req('2026-09-07T12:00:00Z');
  assert.equal(isUrgentRequestLive(r, AT2('2026-09-07T12:00:00Z')), false);
  assert.equal(isUrgentRequestExpired(r, AT2('2026-09-07T12:00:00Z')), true);
});

test('a request nobody can date is hidden, and its owner can clear it', () => {
  // Hidden from every board, because showing an unbounded request would rush a
  // cleaner to a job that may have lapsed weeks ago.
  //
  // But sweepable, which is the correction to the first version of this. Not
  // sweeping it left the request invisible AND undeletable while still open —
  // and hasClashingRequest, which filters by client and date and not by status,
  // then blocked its own owner from posting anything at that time, forever,
  // with nothing on screen to explain it. Only the owner ever sweeps, in both
  // products and in the rules, so this clears a person's own broken request.
  for (const bad of [req(undefined), req(null), req(''), req('   '), req('not a date'), {}, null]) {
    assert.equal(isUrgentRequestLive(bad, AT2('2026-09-07T12:00:00Z')), false,
      `live: ${JSON.stringify(bad)}`);
    assert.equal(isUrgentRequestExpired(bad, AT2('2026-09-07T12:00:00Z')), true,
      `sweepable: ${JSON.stringify(bad)}`);
  }
});

test('expiryOf returns null rather than NaN', () => {
  // NaN was the bug: every comparison against it is false, so it read as
  // "not expired" to one call site and "not live" to another.
  assert.equal(expiryOf(req('not a date')), null);
  assert.equal(expiryOf(req(undefined)), null);
  assert.equal(expiryOf(req('2026-09-07T12:00:00Z')), Date.parse('2026-09-07T12:00:00Z'));
});

// ── Claiming, approving, rejecting ─────────────────────────────────────────
// A job posted to the board used to go straight from claimed to confirmed, so
// the approval screen — the one with the client's address, the chat and the two
// buttons — never appeared for it at all.

const posted   = (x = {}) => ({ origin: 'open', status: 'pending', open: true, clientUid: 'c1', cleanerId: '', ...x });
const directed = (x = {}) => ({ origin: undefined, status: 'pending', open: false, clientUid: 'c1', cleanerId: 'k1', ...x });

test('claiming an open job leaves it waiting for approval', () => {
  const u = claimUpdate('k1', 'Cleaner');
  assert.equal(u.status, 'pending', 'used to be confirmed, which skipped the approval');
  assert.equal(u.open, false, 'and off the board so nobody else claims it');
  assert.equal(u.cleanerId, 'k1');
});

test('rejecting a posted job puts it back on the board, it does not kill it', () => {
  // The job belongs to the client. Cancelling it because one cleaner changed
  // their mind would make them post it again.
  const u = rejectionUpdate(posted({ open: false, cleanerId: 'k1' }));
  assert.equal(u.open, true);
  assert.equal(u.status, 'pending');
  assert.equal(u.cleanerId, '', 'cleared so another cleaner can take it');
  assert.equal(u.cleanerName, '');
  assert.equal(u.status === 'cancelled', false);
});

test('rejecting a booking addressed to me cancels it', () => {
  // Nowhere to go back to: the client chose this cleaner.
  const u = rejectionUpdate(directed());
  assert.equal(u.status, 'cancelled');
  assert.equal(u.cancelledBy, 'cleaner');
  assert.ok(u.cancelledAt);
});

test('the two rejections are told apart by origin, not by guesswork', () => {
  assert.equal(rejectionReleasesToBoard(posted()), true);
  assert.equal(rejectionReleasesToBoard(directed()), false);
  assert.equal(rejectionReleasesToBoard({ origin: 'urgent' }), false);
  assert.equal(rejectionReleasesToBoard({}), false);
  assert.equal(rejectionReleasesToBoard(null), false);
});

test('the approve bar shows only for a booking that is really mine and really waiting', () => {
  assert.equal(awaitsMyApproval(directed({ cleanerId: 'k1' }), 'k1'), true);
});

test('it never shows for a job still open to everyone', () => {
  // Claimable by anyone — an approve button here would be a lie.
  assert.equal(awaitsMyApproval(posted({ open: true, cleanerId: 'k1' }), 'k1'), false);
});

test('it never shows for somebody else booking, or once decided', () => {
  assert.equal(awaitsMyApproval(directed({ cleanerId: 'k2' }), 'k1'), false, 'another cleaner');
  assert.equal(awaitsMyApproval(directed({ status: 'confirmed' }), 'k1'), false, 'already approved');
  assert.equal(awaitsMyApproval(directed({ status: 'cancelled' }), 'k1'), false, 'already cancelled');
  assert.equal(awaitsMyApproval(directed({ status: 'done' }), 'k1'), false, 'finished');
});

test('a missing uid or booking shows nothing rather than throwing', () => {
  assert.equal(awaitsMyApproval(directed(), ''), false);
  assert.equal(awaitsMyApproval(null, 'k1'), false);
  assert.equal(awaitsMyApproval(undefined, 'k1'), false);
});

test('a job the cleaner claimed holds their time even before they approve it', () => {
  // It is off the board and nobody else can take it. Leaving it out let the
  // board keep offering overlapping work and let a second job be approved for
  // the same hour with no warning.
  assert.equal(occupiesCleanerTime({ status: 'pending', origin: 'open', open: false, cleanerId: 'k1' }), true);
});

test('a confirmed, active or on-the-way job holds their time', () => {
  for (const status of ['confirmed', 'active', 'onway']) {
    assert.equal(occupiesCleanerTime({ status, cleanerId: 'k1' }), true, status);
  }
});

test('a request the client sent and the cleaner has not accepted does not', () => {
  // Otherwise anyone could freeze a cleaner's calendar by sending bookings
  // they never answer. A DIRECT booking is the client's request, not the
  // cleaner's commitment.
  assert.equal(occupiesCleanerTime({ status: 'pending', origin: 'direct', open: false, cleanerId: 'k1' }), false);
});

test('an urgent job the cleaner claimed holds their time too', () => {
  // Same argument as a board job: it is off the board, it carries this
  // cleaner's name, and nobody else can take it. Leaving urgent out left that
  // whole route double-bookable.
  assert.equal(occupiesCleanerTime({ status: 'pending', origin: 'urgent', open: false, cleanerId: 'k1' }), true);
});

test('the busy window lands on the booking, not merely at the right length', () => {
  // A mutant that pinned every window to 1 January 2000 — ignoring the date and
  // time entirely — passed the whole suite, because nothing asserted WHERE the
  // window sits. That blind spot is what let a re-implemented parser roll
  // `2026-13-05` into January 2027 and block an hour four months away.
  const w = busyWindowOf({ bookingDate: '2026-09-20', startTime: '14:30', hours: 2 });
  const from = new Date(w.from);
  assert.equal(from.getFullYear(), 2026);
  assert.equal(from.getMonth(), 8, 'September');
  assert.equal(from.getDate(), 20);
  assert.equal(from.getHours(), 14);
  assert.equal(from.getMinutes(), 30);
});

test('a date that only looks valid is refused, not rolled over', () => {
  // Every one of these matches the shape regex. new Date() rolls them silently.
  for (const bookingDate of ['2026-13-05', '2026-00-15', '0026-01-15', '2026-02-30']) {
    assert.equal(busyWindowOf({ bookingDate, startTime: '10:00' }), null, bookingDate);
  }
  assert.equal(busyWindowOf({ bookingDate: '2026-09-20', startTime: '24:00' }), null, '24:00');
});

test('the two date readers agree about what is unreadable', () => {
  // They used to disagree: Date.parse took `2026-02-30` as 2 March and `24:00`
  // as next midnight, so one function saw a real instant where the other saw
  // nonsense — and a job with a bad date wrote no window AND refused to go back
  // on the board.
  const at = new Date('2026-09-20T12:00:00Z');
  for (const bookingDate of ['2026-02-30', '2026-13-05', '0026-01-15']) {
    const b = { origin: 'open', status: 'pending', bookingDate, startTime: '10:00' };
    assert.equal(busyWindowOf(b), null, `window: ${bookingDate}`);
    // Unreadable means "not passed", so the job can still be put back.
    assert.equal(rejectionReleasesToBoard(b, at), true, `release: ${bookingDate}`);
  }
});

test('a job still on the board holds nobody time', () => {
  assert.equal(occupiesCleanerTime({ status: 'pending', origin: 'open', open: true, cleanerId: '' }), false);
});

test('a finished or cancelled job holds no time', () => {
  assert.equal(occupiesCleanerTime({ status: 'done', cleanerId: 'k1' }), false);
  assert.equal(occupiesCleanerTime({ status: 'cancelled', origin: 'open', open: false, cleanerId: 'k1' }), false);
  assert.equal(occupiesCleanerTime(null), false);
});

test('a job whose time has passed still goes back to the client', () => {
  // It used to cancel, on the reasoning that yesterday's cleaning would sit on
  // the board for good. isBoardJobOfferable filters it now (see below), and the
  // rules never allowed the cancel anyway: cleanerIsNotDestroyingABoardJob
  // refuses a claimed board job being cancelled by anyone but the client, so
  // every write this produced was permission-denied and swallowed. The job
  // stayed claimed, off the board, holding the hour.
  const past = { origin: 'open', status: 'pending', bookingDate: '2026-09-01', startTime: '10:00' };
  const at = new Date('2026-09-08T12:00:00Z');
  assert.equal(rejectionReleasesToBoard(past, at), true);
  assert.equal(rejectionUpdate(past, at).open, true);
  assert.equal(rejectionUpdate(past, at).cleanerId, '');
  // And it carries no busy window back with it.
  assert.equal(rejectionUpdate(past, at).busyFrom, '');
});

test('a job still ahead of us goes back on the board', () => {
  const ahead = { origin: 'open', status: 'pending', bookingDate: '2026-09-20', startTime: '10:00' };
  const at = new Date('2026-09-08T12:00:00Z');
  assert.equal(rejectionReleasesToBoard(ahead, at), true);
  assert.equal(rejectionUpdate(ahead, at).open, true);
});

test('a settled job is never released, whatever its origin', () => {
  // The rules refuse this outright; the client must not even try.
  for (const status of ['done', 'cancelled', 'active', 'onway', 'confirmed']) {
    assert.equal(rejectionReleasesToBoard({ origin: 'open', status }), false, status);
  }
});

test('a job with no readable time is still releasable', () => {
  // Failing closed here would strand it; the date is our bug, not the client's.
  assert.equal(rejectionReleasesToBoard({ origin: 'open', status: 'pending' }), true);
});

test('a claim writes the window it occupies, so clients see the cleaner as busy', () => {
  // Board jobs carry no busyFrom/busyUntil, and those are the only fields
  // published to busySlots — so a cleaner holding one still showed a green
  // "available now" dot to every client.
  const u = claimUpdate('k1', 'Cleaner', { bookingDate: '2026-09-20', startTime: '10:00', hours: 3 });
  assert.ok(u.busyFrom && u.busyUntil, 'a window was written');
  assert.equal(new Date(u.until ?? u.busyUntil).getTime() - new Date(u.busyFrom).getTime(), 3 * 3600000);
});

test('a claim on an undateable booking writes no window rather than a guessed one', () => {
  // A guessed window would block hours the cleaner never agreed to.
  const u = claimUpdate('k1', 'Cleaner', { bookingDate: '', startTime: '' });
  assert.equal(u.busyFrom, undefined);
  assert.equal(u.status, 'pending', 'the rest of the claim still happens');
});

test('a booking with no stated length is assumed to run two hours', () => {
  const w = busyWindowOf({ bookingDate: '2026-09-20', startTime: '09:00' });
  assert.equal(new Date(w.until).getTime() - new Date(w.from).getTime(), 2 * 3600000);
});

test('a job I claimed and never answered, whose time has gone, is closable', () => {
  const at = new Date('2026-09-20T15:00:00Z');
  const missed = { status: 'pending', open: false, origin: 'open', cleanerId: 'k1', bookingDate: '2026-09-20', startTime: '09:00' };
  assert.equal(pendingSlotMissed(missed, 'k1', at), true);
  // Released, not cancelled — the rules refuse the cancel, so the sweep's write
  // was denied on exactly the documents the sweep exists for, and the failure
  // was hidden by its catch. Released, it leaves the cleaner's calendar and
  // isBoardJobOfferable keeps it off every board.
  const write = rejectionUpdate(missed, at);
  assert.equal(write.open, true, 'back to the client, not destroyed');
  assert.equal(write.status, 'pending');
  // And it cannot come straight back round the sweep: released, it no longer
  // occupies anyone's time, which is what pendingSlotMissed requires.
  assert.equal(pendingSlotMissed({ ...missed, ...write }, 'k1', at), false);
});

test('a job still ahead, or somebody else, is left alone by the sweep', () => {
  const at = new Date('2026-09-20T15:00:00Z');
  const claimed = (x = {}) => ({ status: 'pending', origin: 'open', open: false, cleanerId: 'k1', bookingDate: '2026-09-20', startTime: '09:00', ...x });
  assert.equal(pendingSlotMissed(claimed({ bookingDate: '2026-09-25' }), 'k1', at), false, 'still ahead');
  assert.equal(pendingSlotMissed(claimed({ cleanerId: 'k2' }), 'k1', at), false, 'somebody else holds it');
  assert.equal(pendingSlotMissed(claimed({ status: 'confirmed' }), 'k1', at), false, 'already approved');
});

test('the sweep never touches a request the client sent and I ignored', () => {
  // It used to. Opening the app cancelled every ignored direct request going
  // back months, and each of those clients got a full-screen "your cleaner
  // cancelled" dialog, months late.
  const at = new Date('2026-09-20T15:00:00Z');
  const ignored = { status: 'pending', origin: 'direct', open: false, cleanerId: 'k1', bookingDate: '2026-09-19', startTime: '09:00' };
  assert.equal(pendingSlotMissed(ignored, 'k1', at), false);
});

test('the sweep does not reach back into history', () => {
  const at = new Date('2026-09-20T15:00:00Z');
  const ancient = { status: 'pending', origin: 'open', open: false, cleanerId: 'k1', bookingDate: '2026-01-05', startTime: '09:00' };
  const recent  = { status: 'pending', origin: 'open', open: false, cleanerId: 'k1', bookingDate: '2026-09-19', startTime: '09:00' };
  assert.equal(pendingSlotMissed(ancient, 'k1', at), false, 'eight months ago is history');
  assert.equal(pendingSlotMissed(recent, 'k1', at), true, 'yesterday is a missed job');
});

test('a booking with no origin is the client\'s request, not the cleaner\'s claim', () => {
  // This used to assert the opposite, and locked in a contradiction:
  // occupiesCleanerTime read the raw field, so no origin meant "claimed", while
  // bookingOrigin in the same repo answers 'direct' for the same document.
  //
  // The live writer of such documents is the app's recurring booking. Reading
  // it as a claim published an unanswered client request into busySlots —
  // freezing an hour the cleaner never agreed to — and let the sweep cancel it
  // with cancelledBy: 'cleaner', which is the "your cleaner cancelled, months
  // late" dialog pendingSlotMissed was written to stop.
  const at = new Date('2026-09-20T15:00:00Z');
  const noOrigin = { status: 'pending', open: false, cleanerId: 'k1', bookingDate: '2026-09-20', startTime: '09:00' };
  assert.equal(occupiesCleanerTime(noOrigin), false);
  assert.equal(pendingSlotMissed(noOrigin, 'k1', at), false, 'the sweep leaves the client their request');
  // A claim off the board still holds its hour, and so does an urgent one.
  assert.equal(occupiesCleanerTime({ ...noOrigin, origin: 'open' }), true);
  assert.equal(occupiesCleanerTime({ ...noOrigin, origin: 'urgent' }), true);
  assert.equal(occupiesCleanerTime({ ...noOrigin, origin: 'direct' }), false);
  // A legacy document still on the board reads as an advert, as it always did.
  assert.equal(occupiesCleanerTime({ status: 'pending', open: true, cleanerId: '' }), false);
});

test('the sweep never cancels work that was already approved', () => {
  // occupiesCleanerTime is true for confirmed/active/onway too, so without an
  // explicit pending check the sweep cancelled jobs that had very likely
  // happened — days after the fact.
  const at = new Date('2026-09-20T15:00:00Z');
  for (const status of ['confirmed', 'active', 'onway', 'done']) {
    assert.equal(pendingSlotMissed(
      { status, origin: 'open', open: false, cleanerId: 'k1', bookingDate: '2026-09-20', startTime: '09:00' },
      'k1', at,
    ), false, status);
  }
});

test('a job whose time has passed is not offered on the board', () => {
  // Claiming one is cancelled straight back by the sweep, so the cleaner sees
  // the approve bar vanish with no explanation and the client is told their
  // cleaner cancelled — for a job that was never live.
  const at = new Date('2026-09-20T15:00:00Z');
  assert.equal(isBoardJobOfferable({ bookingDate: '2026-09-19', startTime: '09:00' }, at), false);
  assert.equal(isBoardJobOfferable({ bookingDate: '2026-09-25', startTime: '09:00' }, at), true);
});

test('a job with an unreadable date is still offered', () => {
  // Hiding it would punish the client for our bad field; the claim just writes
  // no busy window for it.
  const at = new Date('2026-09-20T15:00:00Z');
  assert.equal(isBoardJobOfferable({ bookingDate: 'nonsense', startTime: '09:00' }, at), true);
  assert.equal(isBoardJobOfferable({}, at), true);
  assert.equal(isBoardJobOfferable(null, at), false, 'but nothing is not a job');
});

test('demo cleaners are opt-in, not on by default', () => {
  // The bug: DEMO_DEFAULT_ON was flipped on for a testing round and left on,
  // shipping 200 invented cleaners with invented ratings to real customers on
  // both products. It is a source assertion because the flag is a module
  // constant read at startup — nothing else can observe it having been flipped.
  const src = readFileSync(new URL('../lib/demoMode.ts', import.meta.url), 'utf8');
  assert.match(src, /const DEMO_DEFAULT_ON = false;/);
});

test('a registration payload carries no reputation fields', () => {
  // The bug: the cleaner branch wrote rating: 0 and reviews: 0, and the users
  // create rule refuses any document whose keys include them. Every cleaner
  // signup was permission-denied, the catch deleted the auth account, and the
  // person saw a generic "try again" that never stopped being wrong.
  const src = readFileSync(new URL('../app/register.tsx', import.meta.url), 'utf8');
  for (const field of ['rating', 'reviews', 'reviewCount', 'reviewsCount',
                       'blocked', 'blockedUntilReview', 'identityVerified', 'adminNote']) {
    assert.doesNotMatch(src, new RegExp(`data\\.${field}\\s*=`),
      `register.tsx writes ${field}, which the users create rule forbids`);
  }
});

test('the busy window is written under the names a booking actually stores', () => {
  // The bug: the website spread busyWindowOf() straight into the urgent claim,
  // which writes `from`/`until`. toSlots filters on busyFrom && busyUntil, so
  // the booking never reached busySlots — the cleaner kept a green "available
  // now" dot through the whole job and a second client could book the hour.
  // The app's urgent claim wrote no window at all. One helper now, both spread.
  const b = { bookingDate: '2026-09-20', startTime: '14:30', hours: 2 };
  const fields = busyFieldsOf(b);
  assert.deepEqual(Object.keys(fields).sort(), ['busyFrom', 'busyUntil']);
  assert.equal(fields.busyFrom, busyWindowOf(b).from);
  assert.equal(fields.busyUntil, busyWindowOf(b).until);
});

test('an unreadable booking yields no busy fields rather than a guessed window', () => {
  assert.deepEqual(busyFieldsOf(null), {});
  assert.deepEqual(busyFieldsOf({ bookingDate: 'nonsense', startTime: '09:00' }), {});
  // And a claim of one carries no window rather than blocking an invented hour.
  assert.equal(claimUpdate('c1', 'Dana', { bookingDate: 'nonsense', startTime: '09:00' }).busyFrom, undefined);
});

test('a busy window written in one timezone is read the same in another', () => {
  // The blind spot: every existing window check derives and reads in ONE
  // process, so the writer's timezone always equals the reader's and the
  // tainted instant cancels out. It passes under any TZ.
  //
  // The real shape is a cleaner in Israel and a client abroad. busyWindowOf
  // builds the instant from the WRITER's local clock and isCleanerBusy compares
  // it against a window built from the READER's — so once the offsets differ by
  // as much as the job is long, the two windows stop overlapping entirely and
  // the check reports the cleaner free. Two clients, one hour, no warning.
  //
  // Child processes because TZ is read once, at process start.
  const derive = (tz) => JSON.parse(execFileSync(process.execPath, [
    '-e',
    `import('${bookingActionsUrl}').then(m => {
       process.stdout.write(JSON.stringify(
         m.busySlotOf({ bookingDate: '2026-09-20', startTime: '14:30', hours: 2 })));
     })`,
  ], { env: { ...process.env, TZ: tz } }).toString());

  const israel = derive('Asia/Jerusalem');
  const london = derive('Europe/London');

  // The instants still disagree — that is what they are, and old documents in
  // production carry them, so readers still understand them for one release.
  assert.notEqual(israel.from, london.from,
    'if these ever match, the ISO half has been fixed and this test should say so');

  // The published shape is what matters, and it does not move.
  assert.deepEqual(
    { date: israel.date, s: israel.s, e: israel.e },
    { date: london.date, s: london.s, e: london.e },
    'a busy window must name the same hours whoever writes it and whoever reads it',
  );
  assert.deepEqual(
    { date: israel.date, s: israel.s, e: israel.e },
    { date: '2026-09-20', s: 14 * 60 + 30, e: 16 * 60 + 30 },
  );
});

test('a job spanning the clock change keeps its wall-clock length', () => {
  // Israel's clocks go back on the night of 24–25 October 2026. A two-hour job
  // starting 01:00 that night covers three hours of elapsed time, so adding
  // absolute milliseconds ended it at 02:00 instead of 03:00 — the window was
  // one wall-clock hour short and the last hour was bookable by somebody else.
  // One hour a year, Israel included.
  //
  // A child process because TZ is read once, at process start, and CI runs UTC.
  const end = execFileSync(process.execPath, [
    '-e',
    `import('${bookingSlotUrl}').then(m => {
       const d = m.endDateOf({ bookingDate: '2026-10-25', startTime: '01:00', hours: 2 });
       process.stdout.write(JSON.stringify({ h: d.getHours(), day: d.getDate() }));
     })`,
  ], { env: { ...process.env, TZ: 'Asia/Jerusalem' } }).toString();

  assert.deepEqual(JSON.parse(end), { h: 3, day: 25 },
    'two hours from 01:00 is 03:00 on the clock, whatever the offset did in between');
});
