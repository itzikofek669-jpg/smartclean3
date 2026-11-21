// lib/freeSlots — "התפנה לי מקום": which windows are on offer, and what may be put up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeFreeSlots, freeSlotProblem, freeSlotDays, freeSlotTaken, FREE_SLOT_MAX } from '../.tsbuild/freeSlots.mjs';
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
