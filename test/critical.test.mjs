import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRole } from '../.tsbuild/resolveRole.mjs';
import { mustVerifyEmail, VERIFY_REQUIRED_FROM } from '../.tsbuild/verifyRule.mjs';
import { isAvailableNow } from '../.tsbuild/displayOrder.mjs';
import { startDateOf, endDateOf, bookingHours, DEFAULT_BOOKING_HOURS } from '../.tsbuild/bookingSlot.mjs';

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
