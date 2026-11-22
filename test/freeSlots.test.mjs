// lib/freeSlots — "התפנה לי מקום": which windows are on offer, and what may be put up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFreeSlots, freeSlotProblem, freeSlotDays, freeSlotTaken, FREE_SLOT_MAX, cancelledOnClient, freeMeetsCancelled, suggestFreeSlot } from '../.tsbuild/freeSlots.mjs';
import { diaryAgenda } from '../.tsbuild/workDiary.mjs';

const now = new Date(2026, 10, 21, 10, 15);            // Sat 21 Nov 2026, 10:15
const F = (id, date, s, e) => ({ id, date, s, e });

test('the seven days on offer start today', () => {
  const d = freeSlotDays(now);
  assert.equal(d.length, 7);
  assert.equal(d[0], '2026-11-21');
  assert.equal(d[6], '2026-11-27');
});

test('a window is on offer until it is taken or over, and comes back when the booking goes', () => {
  const a = F('a', '2026-11-24', 540, 780);              // Tue 09:00–13:00
  const b = F('b', '2026-11-21', 600, 720);              // today 10:00–12:00: running — offered from 11:00
  const b2 = F('b2', '2026-11-21', 600, 660);            // today 10:00–11:00: no whole hour left
  const c = F('c', '2026-11-21', 480, 600);              // today 08:00–10:00: over
  const d = F('d', '2026-11-20', 540, 600);              // yesterday: over
  const on = activeFreeSlots([a, b, b2, c, d], [], [], now);
  assert.deepEqual(on.map((f) => f.id), ['b', 'a']);
  assert.equal(on[0].s, 660, 'a running window is offered from the next whole hour');
  // A pending booking at Tue 11:00 takes it; declined (gone from pending), it is back.
  const held = [{ date: '2026-11-24', s: 660, e: 780 }];
  assert.deepEqual(activeFreeSlots([a], [], held, now), []);
  assert.deepEqual(activeFreeSlots([a], held, [], now), []);
  assert.deepEqual(activeFreeSlots([a], [], [], now).map((f) => f.id), ['a']);
  // Touching is not overlapping.
  assert.equal(freeSlotTaken(a, [{ date: '2026-11-24', s: 780, e: 900 }]), false);
  // Unreadable stored entries are ignored, not shown.
  assert.deepEqual(activeFreeSlots([{ id: 'x' }, 'nope', null, F('y', '2026-11-24', 600, 540)], [], [], now), []);
});

test('what may be put up: two at most, the coming week, whole hours, not past, not over work', () => {
  const ok = F('n', '2026-11-25', 540, 720);
  assert.equal(freeSlotProblem(ok, [], [], [], now), null);
  assert.equal(FREE_SLOT_MAX, 2);
  assert.equal(freeSlotProblem(ok, [F('a', '2026-11-24', 540, 600), F('b', '2026-11-26', 540, 600)], [], [], now), 'full');
  assert.equal(freeSlotProblem(F('n', '2026-11-28', 540, 720), [], [], [], now), 'day');      // 8th day
  assert.equal(freeSlotProblem(F('n', '2026-11-20', 540, 720), [], [], [], now), 'day');      // yesterday
  assert.equal(freeSlotProblem(F('n', '2026-11-25', 570, 720), [], [], [], now), 'time');     // 09:30
  assert.equal(freeSlotProblem(F('n', '2026-11-25', 540, 540), [], [], [], now), 'time');
  assert.equal(freeSlotProblem(F('n', '2026-11-21', 600, 720), [], [], [], now), 'past');     // today 10:00 at 10:15
  assert.equal(freeSlotProblem(F('n', '2026-11-21', 660, 720), [], [], [], now), null);       // today 11:00
  assert.equal(freeSlotProblem(ok, [F('a', '2026-11-25', 660, 780)], [], [], now), 'overlap');
  assert.equal(freeSlotProblem(ok, [], [{ date: '2026-11-25', s: 600, e: 660, p: 1 }], [], now), 'busy');   // a private job
  assert.equal(freeSlotProblem(ok, [], [], [{ date: '2026-11-25', s: 700, e: 760 }], now), 'busy');
  // Her working days and hours, as the booking forms read them (Wed 25 Nov).
  const week = { sun: { active: true, start: 8, end: 16 }, mon: { active: true, start: 8, end: 16 }, tue: { active: true, start: 8, end: 16 },
    wed: { active: true, start: 8, end: 16 }, thu: { active: true, start: 8, end: 16 }, fri: { active: false, start: 8, end: 13 }, sat: { active: false, start: 8, end: 13 } };
  const hours = { availability: week, availabilitySet: true };
  assert.equal(freeSlotProblem(ok, [], [], [], now, hours), null);                                   // 09–12
  assert.equal(freeSlotProblem(F('n', '2026-11-25', 840, 1080), [], [], [], now, hours), 'offHours'); // 14–18, her day ends 16
  assert.equal(freeSlotProblem(F('n', '2026-11-27', 540, 720), [], [], [], now, hours), 'dayOff');    // Friday
  // Never set her hours: nothing to hold her to — but no start after 20:00.
  assert.equal(freeSlotProblem(F('n', '2026-11-25', 1260, 1320), [], [], [], now), 'offHours');      // 21:00
  assert.equal(freeSlotProblem(F('n', '2026-11-25', 1200, 1260), [], [], [], now), null);            // 20:00
});

test('the diary shows a window on offer beside the jobs, in no total', () => {
  const a = diaryAgenda([], [], '2026-11-21', 7, [F('a', '2026-11-24', 540, 780)]);
  assert.deepEqual(a.days.map((d) => d.date), ['2026-11-24']);
  assert.equal(a.days[0].items[0].kind, 'free');
  assert.equal(a.days[0].items[0].startTime, '09:00');
  assert.equal(a.days[0].items[0].hours, 4);
  assert.deepEqual(a.app, { count: 0, hours: 0, money: 0 });
  assert.deepEqual(a.private, { count: 0, hours: 0, money: 0 });
});

test('hours a cleaner cancelled on the client, still ahead and not taken since', () => {
  const B = (o) => ({ status: 'cancelled', cancelledBy: 'cleaner', cleanerId: 'c1', bookingDate: '2026-11-24', startTime: '10:00', hours: 2, ...o });
  assert.deepEqual(cancelledOnClient([B({})], now), [{ date: '2026-11-24', s: 600, e: 720, cleanerId: 'c1' }]);
  assert.deepEqual(cancelledOnClient([B({ cancelledFrom: 'pending' })], now).length, 1, 'turned down counts too');
  assert.equal(cancelledOnClient([B({ cancelledBy: 'client' })], now).length, 0, 'he cancelled it himself');
  assert.equal(cancelledOnClient([B({ bookingDate: '2026-11-20' })], now).length, 0, 'already past');
  assert.equal(cancelledOnClient([B({ bookingDate: '2026-11-21', startTime: '08:00', hours: 2 })], now).length, 0, 'ended this morning');
  assert.equal(cancelledOnClient([B({ bookingDate: '2026-11-21', startTime: '09:00', hours: 3 })], now).length, 1, 'still running today');
  assert.equal(cancelledOnClient([B({}), { status: 'confirmed', cleanerId: 'c2', bookingDate: '2026-11-24', startTime: '11:00', hours: 2 }], now).length, 0,
    'booked again since, over those hours');
  assert.equal(cancelledOnClient([B({}), { status: 'pending', open: true, cleanerId: '', bookingDate: '2026-11-24', startTime: '10:00', hours: 2 }], now).length, 1,
    'back on the board with nobody on it: still without a cleaner');
  assert.equal(cancelledOnClient([B({}), { status: 'confirmed', cleanerId: 'c2', bookingDate: '2026-11-25', startTime: '10:00', hours: 2 }], now).length, 1,
    'booked on another day');
  assert.equal(cancelledOnClient([B({ startTime: '' }), B({ bookingDate: 'x' }), null, 'junk'], now).length, 0, 'unreadable');
  assert.deepEqual(cancelledOnClient([B({ hours: undefined })], now)[0], { date: '2026-11-24', s: 600, e: 720, cleanerId: 'c1' },
    'no hours stored: the usual two');
  assert.equal(cancelledOnClient([B({}), { status: 'confirmed', cleanerId: 'c2', bookingDate: '2026-11-24', startTime: '10:00' }], now).length, 0,
    'booked again, hours not stored');
  // Handed back to the board after a cleaner took it (rejectionUpdate).
  const back = { id: 'j', status: 'pending', open: true, cleanerId: '', releasedAt: '2026-11-21T08:00:00Z', bookingDate: '2026-11-24', startTime: '10:00', hours: 2 };
  assert.deepEqual(cancelledOnClient([back], now), [{ date: '2026-11-24', s: 600, e: 720, cleanerId: '' }], 'handed back to the board');
  assert.equal(cancelledOnClient([{ ...back, releasedAt: undefined }], now).length, 0, 'never taken: not a cancellation');
  // Put back up, then given up by him.
  const orig = B({ id: 'o' });
  assert.equal(cancelledOnClient([orig, { repostedFrom: 'o', status: 'pending', open: true, cleanerId: '', bookingDate: '2026-11-24', startTime: '10:00', hours: 2 }], now).length, 1,
    'reposted, nobody on it yet');
  assert.equal(cancelledOnClient([orig, { repostedFrom: 'o', status: 'cancelled', cancelledBy: 'client', bookingDate: '2026-11-24', startTime: '10:00', hours: 2 }], now).length, 0,
    'the repost cancelled by him');
  assert.equal(cancelledOnClient([orig, { repostedFrom: 'o', status: 'cancelled', cancelledBy: 'client', replacedBy: 'x', bookingDate: '2026-11-24', startTime: '10:00', hours: 2 }], now).length, 0,
    'the repost moved to another day');
  assert.deepEqual(cancelledOnClient(undefined, now), []);
});

test('an opening on hours cancelled on him, by another cleaner', () => {
  const cancelled = [{ date: '2026-11-24', s: 600, e: 720, cleanerId: 'c1' }];
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 540, 660)], cancelled, 'c2'), true, 'overlaps');
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 720, 900)], cancelled, 'c2'), false, 'starts as they end');
  assert.equal(freeMeetsCancelled([F('a', '2026-11-25', 600, 720)], cancelled, 'c2'), false, 'another day');
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 600, 720)], cancelled, 'c1'), false, 'the cleaner who cancelled');
  // c1 walked away, c2 then declined the same hours: neither is offered back.
  const both = [{ date: '2026-11-24', s: 600, e: 720, cleanerId: 'c1' }, { date: '2026-11-24', s: 600, e: 720, cleanerId: 'c2' }];
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 600, 720)], both, 'c1'), false, 'c1 not through c2');
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 600, 720)], both, 'c2'), false, 'c2 not through c1');
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 600, 720)], both, 'c3'), true, 'someone else');
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 600, 720)], [{ date: '2026-11-24', s: 600, e: 720, cleanerId: '' }], 'c3'), true, 'handed back, canceller unknown');
  assert.equal(freeMeetsCancelled([], cancelled, 'c2'), false);
  assert.equal(freeMeetsCancelled(undefined, cancelled, 'c2'), false);
  assert.equal(freeMeetsCancelled([F('a', '2026-11-24', 600, 720)], [], 'c2'), false);
});

// Audit 22.11.2026: the editor proposed the next hour plus three whatever her
// hours were, and publishing that default was refused as outside her hours.
test('the proposed window is inside her working hours', () => {
  const at16 = new Date(2026, 10, 22, 15, 20);           // Sun 22 Nov, 15:20
  const hours = { availabilitySet: true, availability: {
    sun: { active: true, start: 8, end: 18 }, mon: { active: true, start: 8, end: 18 },
  } };
  const f = suggestFreeSlot(at16, hours);
  // Today from 16:00: two hours still fit before 18:00.
  assert.deepEqual(f, { date: '2026-11-22', s: 16 * 60, e: 18 * 60 });
  assert.equal(freeSlotProblem({ id: 'x', ...f }, [], [], [], at16, hours), null);
  // Past her day: the next day she works, from its start.
  const late = suggestFreeSlot(new Date(2026, 10, 22, 17, 30), hours);
  assert.deepEqual(late, { date: '2026-11-23', s: 8 * 60, e: 11 * 60 });
  // Hours not set: the old proposal, next hour and three.
  assert.deepEqual(suggestFreeSlot(at16, {}), { date: '2026-11-22', s: 16 * 60, e: 19 * 60 });
});
