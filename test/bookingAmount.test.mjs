/**
 * What a booking is worth, and the extension the client approves
 * (lib/bookingAmount — shared, byte-identical with the website's copy).
 *
 * The same file runs in both repos: the app's `npm test` and the website's
 * `npm run test:units` compile the module into .tsbuild first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agreedTotal, bookingAmount, pendingExtension, lastExtensionAnswer, sameExtension,
  extensionRoom, extensionOptions, canAskForExtension, extensionTotal, extensionRequestOf,
  extensionApproval, extensionDecline, termsBeforeExtension, EXTENSION_MAX_HOURS,
} from '../.tsbuild/bookingAmount.mjs';

// ── The amount: "earned ₪1, 0 hours" ────────────────────────────────────────

test('a job closed minutes after "start" before the fix counts at the agreed amount', () => {
  // Ending a job used to write the hourly price × the minutes elapsed.
  const old = { status: 'done', total: 300, hours: 3, pricePerHour: 100, actualTotal: 1, actualHours: 0 };
  assert.equal(bookingAmount(old), 300);
  assert.equal(bookingAmount({ ...old, actualTotal: 0 }), 300, 'zero is below the agreed amount too');
});

test('a recorded figure above the agreed amount counts only for a job closed before the rule', () => {
  // Billed by the minute then: the client paid for the extra half hour.
  assert.equal(bookingAmount({ status: 'done', total: 300, actualTotal: 360, finishedAt: '2026-11-05T12:00:00.000Z' }), 360);
  // Since then extra comes only through an extension the client approved —
  // which is in `total`. A closing write may still record up to twice the
  // total (old builds), and that must not reach the client's history or the
  // admin's revenue (review 13.11.2026).
  assert.equal(bookingAmount({ status: 'done', total: 300, actualTotal: 700, finishedAt: '2026-11-13T09:00:00.000Z' }), 300);
  assert.equal(bookingAmount({ status: 'done', total: 300, actualTotal: 700 }), 300, 'no close time: the agreed amount');
  // An approved extension is the agreed amount.
  assert.equal(bookingAmount({ status: 'done', total: 360, origTotal: 270, actualTotal: 360, finishedAt: '2026-11-13T09:00:00.000Z' }), 360);
});

test('the agreed amount is the price × the hours when no total was stored', () => {
  assert.equal(agreedTotal({ hours: 2.5, pricePerHour: 90 }), 225);
  assert.equal(bookingAmount({ total: null, hours: '3', pricePerHour: '80', actualTotal: 2 }), 240);
});

test('a job with no budget and nothing recorded is worth nothing, never NaN', () => {
  assert.equal(bookingAmount({ total: null }), 0);
  assert.equal(bookingAmount({ total: null, actualTotal: 120 }), 120);
  assert.equal(bookingAmount({ total: 'abc', actualTotal: 'x' }), 0);
  assert.equal(bookingAmount(null), 0);
  assert.equal(bookingAmount(undefined), 0);
});

test('a live job is worth its agreed total', () => {
  assert.equal(bookingAmount({ status: 'confirmed', total: 250, hours: 2.5 }), 250);
});

// ── The extension ────────────────────────────────────────────────────────────

const active = (over = {}) => ({ status: 'active', hours: 3, total: 300, ...over });
const NOW = new Date('2026-11-12T10:00:00.000Z');

test('the provider is offered half-hour steps up to four hours', () => {
  assert.deepEqual(extensionOptions(active()), [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
  assert.equal(EXTENSION_MAX_HOURS, 4);
  assert.equal(canAskForExtension(active()), true);
});

test('four hours in all, however many extensions', () => {
  const extended = active({ hours: 6, total: 600, origHours: 3, origTotal: 300 });
  assert.equal(extensionRoom(extended), 1);
  assert.deepEqual(extensionOptions(extended), [0.5, 1]);
  assert.equal(canAskForExtension(active({ hours: 7, total: 700, origHours: 3, origTotal: 300 })), false);
});

test('only on a job she has started, with nothing already waiting', () => {
  assert.equal(canAskForExtension(active({ status: 'onway' })), false);
  assert.equal(canAskForExtension(active({ status: 'done' })), false);
  assert.equal(canAskForExtension(active({ extRequest: { hours: 1, total: 400, at: 'x' } })), false);
});

test('not on a job with no budget or no hours: there is no rate to extend at', () => {
  assert.equal(canAskForExtension(active({ total: null })), false);
  assert.equal(canAskForExtension(active({ hours: '3' })), false, 'the rules want numbers');
  assert.equal(canAskForExtension(active({ hours: 0 })), false);
});

test('more time is priced at the job\'s own rate — a discount carries over', () => {
  assert.equal(extensionTotal(active(), 1), 400);
  assert.equal(extensionTotal(active({ hours: 2.5, total: 250 }), 0.5), 300);
  assert.equal(extensionTotal(active({ hours: 3, total: 270 }), 1), 360);
  // Rounded to a shekel, and always above the current total (the rules refuse anything else).
  assert.equal(extensionTotal(active({ hours: 3, total: 200 }), 0.5), 233);
  assert.equal(extensionTotal(active({ hours: 4, total: 1 }), 0.5), 2);
});

test('the request is what the rules accept: hours, total, time — and nothing off the menu', () => {
  assert.deepEqual(extensionRequestOf(active(), 1, NOW), { hours: 1, total: 400, at: NOW.toISOString() });
  assert.equal(extensionRequestOf(active(), 0.75, NOW), null);
  assert.equal(extensionRequestOf(active(), 4.5, NOW), null);
  assert.equal(extensionRequestOf(active({ status: 'pending' }), 1, NOW), null);
});

test('a request is pending only on a job still under way', () => {
  const req = { hours: 1, total: 400, at: 'a' };
  assert.deepEqual(pendingExtension(active({ extRequest: req })), req);
  assert.deepEqual(pendingExtension(active({ status: 'onway', extRequest: req })), req, 'an undone "start" keeps it');
  assert.equal(pendingExtension(active({ status: 'done', extRequest: req })), null);
  assert.equal(pendingExtension(active({ status: 'cancelled', extRequest: req })), null);
  assert.equal(pendingExtension(active({ extRequest: { hours: '1', total: 400, at: 'a' } })), null);
});

test('approving moves hours and total to what was asked and keeps the first agreed figures', () => {
  const b = active({ extRequest: { hours: 1, total: 400, at: 'a' } });
  assert.deepEqual(extensionApproval(b, NOW), {
    hours: 4, total: 400, origHours: 3, origTotal: 300,
    extResult: { status: 'approved', hours: 1, total: 400, at: NOW.toISOString() },
  });
  // A second extension: the first agreed figures stay.
  const again = active({ hours: 4, total: 400, origHours: 3, origTotal: 300, extRequest: { hours: 0.5, total: 450, at: 'b' } });
  const w = extensionApproval(again, NOW);
  assert.equal(w.hours, 4.5);
  assert.equal(w.total, 450);
  assert.equal(w.origHours, 3);
  assert.equal(w.origTotal, 300);
});

test('declining leaves the total as it was, and says so', () => {
  const b = active({ extRequest: { hours: 1, total: 400, at: 'a' } });
  assert.deepEqual(extensionDecline(b, NOW), { extResult: { status: 'declined', hours: 1, total: 300, at: NOW.toISOString() } });
  assert.equal(extensionDecline(active(), NOW), null, 'nothing to decline');
  assert.equal(extensionApproval(active(), NOW), null, 'nothing to approve');
});

test('the answer the provider sees, and none while a new request waits', () => {
  const res = { status: 'declined', hours: 1, total: 300, at: 'c' };
  assert.deepEqual(lastExtensionAnswer(active({ extResult: res })), res);
  assert.equal(lastExtensionAnswer(active({ extResult: res, extRequest: { hours: 1, total: 400, at: 'd' } })), null);
  assert.equal(lastExtensionAnswer(active({ extResult: { ...res, status: 'maybe' } })), null);
});

test('the client answers the request she was shown, not one that replaced it', () => {
  const shown = { hours: 1, total: 400, at: 'a' };
  assert.equal(sameExtension(shown, { ...shown }), true);
  assert.equal(sameExtension(shown, { ...shown, at: 'b' }), false);
  assert.equal(sameExtension(shown, { hours: 4, total: 700, at: 'a' }), false);
  assert.equal(sameExtension(shown, null), false);
});

test('the next visit of a recurring job is booked at the first agreed terms', () => {
  assert.deepEqual(termsBeforeExtension({ hours: 4, total: 400, origHours: 3, origTotal: 300 }), { hours: 3, total: 300 });
  assert.deepEqual(termsBeforeExtension({ hours: 3, total: 300 }), { hours: 3, total: 300 });
  assert.deepEqual(termsBeforeExtension({ hours: 2, total: null }), { hours: 2, total: null });
});
