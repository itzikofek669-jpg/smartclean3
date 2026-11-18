// lib/workDiary — the cleaner's private jobs: their visits, their busy hours,
// the agenda next to her app jobs, and the bounds the rules hold them to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaryVisits, diaryBusySlots, diaryAgenda, diaryEntryProblem, addDays, prunedSkip, DIARY_DAYS_PUBLISHED } from '../.tsbuild/workDiary.mjs';

const base = { id: 'e1', clientName: 'משפחת כהן', date: '2026-11-24', startTime: '09:00', hours: 3, price: 270, repeat: 'weekly' };

test('a weekly job repeats every 7 days from its first date, and skipped dates are off', () => {
  const v = diaryVisits([base], '2026-11-18', 21);
  assert.deepEqual(v.map((x) => x.date), ['2026-11-24', '2026-12-01', '2026-12-08']);
  const skipped = diaryVisits([{ ...base, skip: ['2026-12-01'] }], '2026-11-18', 21);
  assert.deepEqual(skipped.map((x) => x.date), ['2026-11-24', '2026-12-08']);
});

test('a series that began before the window joins it on its own weekday; biweekly keeps its rhythm', () => {
  // Started 3 Nov (a Tuesday): from 18 Nov the next weekly visit is 24 Nov.
  assert.deepEqual(diaryVisits([{ ...base, date: '2026-11-03' }], '2026-11-18', 8).map((x) => x.date), ['2026-11-24']);
  // Biweekly from 3 Nov: 17 Nov, 1 Dec, 15 Dec — 17 Nov is before the window.
  assert.deepEqual(diaryVisits([{ ...base, date: '2026-11-03', repeat: 'biweekly' }], '2026-11-18', 28).map((x) => x.date),
    ['2026-12-01', '2026-12-15']);
  // Across the turn of the month and the year.
  assert.deepEqual(diaryVisits([{ ...base, date: '2026-12-29' }], '2026-12-28', 15).map((x) => x.date), ['2026-12-29', '2027-01-05']);
});

test('a one-time job shows once, inside the window only', () => {
  const once = { ...base, repeat: 'once' };
  assert.equal(diaryVisits([once], '2026-11-18', 14).length, 1);
  assert.equal(diaryVisits([once], '2026-11-25', 14).length, 0);   // already past
  assert.equal(diaryVisits([once], '2026-11-01', 10).length, 0);   // beyond the window
});

test('entries that break the bounds are left out, not half-shown', () => {
  assert.equal(diaryVisits([{ ...base, date: '2026-02-30' }], '2026-01-01', 400).length, 0);
  assert.equal(diaryVisits([{ ...base, hours: 20 }], '2026-11-18', 14).length, 0);
  assert.equal(diaryVisits([null, undefined], '2026-11-18', 14).length, 0);
});

test('busy slots have the shape a booking slot has, and stop at the published horizon', () => {
  const slots = diaryBusySlots([base], '2026-11-18');
  assert.ok(slots.length >= 7 && slots.length <= 8);
  // The booking slot's shape, plus `p`: not a booking's hour, so the notify
  // Worker never frees it on a cancellation.
  assert.deepEqual(Object.keys(slots[0]).sort(), ['date', 'e', 'from', 'p', 's', 'until']);
  assert.equal(slots[0].p, 1);
  assert.equal(slots[0].date, '2026-11-24');
  assert.equal(slots[0].s, 9 * 60);
  assert.equal(slots[0].e, 12 * 60);
  assert.ok(Date.parse(slots[0].until) - Date.parse(slots[0].from) === 3 * 3600000);
  assert.ok(slots.every((s) => s.date < addDays('2026-11-18', DIARY_DAYS_PUBLISHED)));
});

test('the agenda puts app jobs and private visits side by side, by day and time, with separate totals', () => {
  const app = [
    { id: 'b1', status: 'confirmed', bookingDate: '2026-11-24', startTime: '13:00', hours: 2, total: 180, clientName: 'דנה', addrCity: 'תל אביב' },
    { id: 'b2', status: 'pending', bookingDate: '2026-11-20', startTime: '10:00', hours: 3, total: 270, clientName: 'רון' },
    { id: 'b3', status: 'cancelled', bookingDate: '2026-11-21', startTime: '10:00', hours: 3, total: 270 },   // not in a diary
    { id: 'b4', status: 'done', bookingDate: '2026-11-19', startTime: '08:00', hours: 2, total: 180, actualTotal: 1 },
  ];
  const a = diaryAgenda(app, [base], '2026-11-18', 7);
  assert.deepEqual(a.days.map((d) => d.date), ['2026-11-19', '2026-11-20', '2026-11-24']);
  assert.deepEqual(a.days[2].items.map((i) => i.kind), ['private', 'app']);   // 09:00 before 13:00
  assert.deepEqual(a.app, { count: 3, hours: 7, money: 180 + 270 + 180 });   // the done one at the agreed ₪180
  assert.deepEqual(a.private, { count: 1, hours: 3, money: 270 });
});

test('the form is told which field is wrong, with the same bounds as the rules', () => {
  assert.equal(diaryEntryProblem(base), null);
  assert.equal(diaryEntryProblem({ ...base, clientName: '  ' }), 'name');
  assert.equal(diaryEntryProblem({ ...base, date: '24/11/2026' }), 'date');
  assert.equal(diaryEntryProblem({ ...base, startTime: '25:00' }), 'time');
  assert.equal(diaryEntryProblem({ ...base, hours: 0 }), 'hours');
  assert.equal(diaryEntryProblem({ ...base, hours: 12.5 }), 'hours');
  assert.equal(diaryEntryProblem({ ...base, price: -1 }), 'price');
  assert.equal(diaryEntryProblem({ ...base, price: null }), null);
  assert.equal(diaryEntryProblem({ ...base, repeat: 'daily' }), 'repeat');
  assert.equal(diaryEntryProblem({ ...base, notes: 'x'.repeat(501) }), 'text');
  // Over by midnight.
  assert.equal(diaryEntryProblem({ ...base, startTime: '22:00', hours: 2 }), null);
  assert.equal(diaryEntryProblem({ ...base, startTime: '22:30', hours: 2 }), 'end');
  assert.equal(diaryEntryProblem({ ...base, startTime: '23:30', hours: 12 }), 'end');
});

test('skipped dates: past ones are dropped, the new one is added once', () => {
  assert.deepEqual(prunedSkip(['2026-10-01', '2026-11-25', '2026-11-20'], '2026-11-18', '2026-12-02'), ['2026-11-20', '2026-11-25', '2026-12-02']);
  assert.deepEqual(prunedSkip(['2026-11-25'], '2026-11-18', '2026-11-25'), ['2026-11-25']);
  assert.deepEqual(prunedSkip(undefined, '2026-11-18'), []);
});
