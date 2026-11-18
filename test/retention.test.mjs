// lib/retention — the offer to book the same cleaner again, and the admin
// screens' count of client–cleaner pairs that came back or stopped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldOfferRebook, pairRetention, repeatRate, GONE_AFTER_DAYS } from '../.tsbuild/retention.mjs';

const done = { id: 'b1', status: 'done', clientUid: 'c1', cleanerId: 'k1', bookingDate: '2026-11-10', startTime: '09:00' };

test('book her again is offered after a good rating only', () => {
  assert.equal(shouldOfferRebook(done, 5, [done]), true);
  assert.equal(shouldOfferRebook(done, 4, [done]), true);
  assert.equal(shouldOfferRebook(done, 3, [done]), false);
  assert.equal(shouldOfferRebook(done, 0, [done]), false);
  assert.equal(shouldOfferRebook(done, undefined, [done]), false);
});

test('not while something is already booked with her, nor for a job that is not done', () => {
  const now = new Date('2026-11-18T12:00:00');
  for (const status of ['pending', 'confirmed', 'onway', 'active']) {
    const next = { id: 'b2', status, clientUid: 'c1', cleanerId: 'k1', bookingDate: '2026-11-25', startTime: '09:00' };
    assert.equal(shouldOfferRebook(done, 5, [done, next], now), false, status);
  }
  // A request or a confirmed visit whose hour has gone is not a next visit;
  // one under way is, whatever its date.
  const past = { id: 'b6', clientUid: 'c1', cleanerId: 'k1', bookingDate: '2026-11-01', startTime: '09:00' };
  assert.equal(shouldOfferRebook(done, 5, [done, { ...past, status: 'pending' }], now), true);
  assert.equal(shouldOfferRebook(done, 5, [done, { ...past, status: 'confirmed' }], now), true);
  assert.equal(shouldOfferRebook(done, 5, [done, { ...past, status: 'active' }], now), false);
  // No date at all: nothing says it is over, so it still counts.
  assert.equal(shouldOfferRebook(done, 5, [done, { id: 'b7', status: 'confirmed', cleanerId: 'k1' }], now), false);
  // Something with ANOTHER cleaner, or a cancelled one with her, does not count.
  assert.equal(shouldOfferRebook(done, 5, [done, { id: 'b3', status: 'confirmed', cleanerId: 'k2' }]), true);
  assert.equal(shouldOfferRebook(done, 5, [done, { id: 'b4', status: 'cancelled', cleanerId: 'k1' }]), true);
  // An older document naming her as cleanerUid is the same cleaner.
  assert.equal(shouldOfferRebook(done, 5, [done, { id: 'b5', status: 'pending', cleanerUid: 'k1' }]), false);
  // The current field wins over the old one.
  assert.equal(shouldOfferRebook(done, 5, [done, { id: 'b8', status: 'pending', cleanerId: 'k2', cleanerUid: 'k1' }]), true);
  assert.equal(shouldOfferRebook({ ...done, status: 'active' }, 5, []), false);
  assert.equal(shouldOfferRebook({ ...done, cleanerId: '' }, 5, []), false);
  assert.equal(shouldOfferRebook(null, 5, []), false);
});

test('pairs: came back, stopped, stopped after a good rating, too early', () => {
  const now = new Date('2026-11-18T12:00:00');
  const old = '2026-09-01';                 // well over GONE_AFTER_DAYS ago
  const recent = '2026-11-10';
  const rows = [
    // c1+k1: two cleanings → came back
    { id: '1', status: 'done', clientUid: 'c1', cleanerId: 'k1', bookingDate: old, startTime: '09:00' },
    { id: '2', status: 'done', clientUid: 'c1', cleanerId: 'k1', bookingDate: recent, startTime: '09:00' },
    // c2+k1: one cleaning and the next one booked → came back
    { id: '3', status: 'done', clientUid: 'c2', cleanerId: 'k1', bookingDate: old },
    { id: '4', status: 'confirmed', clientUid: 'c2', cleanerId: 'k1', bookingDate: '2026-11-25' },
    // c3+k2: one cleaning long ago, rated 5 → stopped, after a good rating
    { id: '5', status: 'done', clientUid: 'c3', cleanerId: 'k2', bookingDate: old, cleanerRating: 5 },
    // c4+k2: one cleaning long ago, rated 2, and a cancelled one since → stopped
    { id: '6', status: 'done', clientUid: 'c4', cleanerId: 'k2', bookingDate: old, cleanerRating: 2 },
    { id: '7', status: 'cancelled', clientUid: 'c4', cleanerId: 'k2', bookingDate: recent },
    // c5+k3: one cleaning last week → too early
    { id: '8', status: 'done', clientUid: 'c5', cleanerId: 'k3', bookingDate: recent },
    // c6+k3: nothing finished yet → not a pair to count
    { id: '9', status: 'pending', clientUid: 'c6', cleanerId: 'k3', bookingDate: '2026-11-30' },
    // c7+k3: one cleaning long ago, then a request she never answered whose
    // hour went by → stopped, not "came back"
    { id: '11', status: 'done', clientUid: 'c7', cleanerId: 'k3', bookingDate: old },
    { id: '12', status: 'pending', clientUid: 'c7', cleanerId: 'k3', bookingDate: '2026-10-01', startTime: '10:00' },
    // c8+k3: one cleaning long ago, then a confirmed visit never closed → came back
    { id: '13', status: 'done', clientUid: 'c8', cleanerId: 'k3', bookingDate: old },
    { id: '14', status: 'confirmed', clientUid: 'c8', cleanerId: 'k3', bookingDate: '2026-10-01', startTime: '10:00' },
    // Unreadable rows are skipped.
    null, { id: '10', status: 'done', clientUid: '', cleanerId: 'k1' },
  ];
  const r = pairRetention(rows, now);
  assert.deepEqual(r, { pairs: 7, repeat: 3, gone: 3, goneHappy: 1, tooEarly: 1 });
  assert.equal(repeatRate(r), 50);
});

test('the edge of "stopped" is GONE_AFTER_DAYS, and finishedAt wins over the booked day', () => {
  const now = new Date('2026-11-18T12:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  const at = (days) => new Date(now.getTime() - days * day).toISOString();
  const one = (finishedAt) => [{ id: 'x', status: 'done', clientUid: 'c', cleanerId: 'k', bookingDate: '2020-01-01', finishedAt }];
  assert.equal(pairRetention(one(at(GONE_AFTER_DAYS + 1)), now).gone, 1);
  assert.equal(pairRetention(one(at(GONE_AFTER_DAYS - 1)), now).tooEarly, 1);
  // No date anywhere: cannot tell yet.
  assert.equal(pairRetention([{ status: 'done', clientUid: 'c', cleanerId: 'k' }], now).tooEarly, 1);
  assert.equal(repeatRate({ pairs: 0, repeat: 0, gone: 0, goneHappy: 0, tooEarly: 0 }), null);
});

test('the level: silver at 5 rated jobs averaging 4.5, gold at 20 averaging 4.8 — any spelling of the count', async () => {
  const { cleanerLevel, levelProgress, levelRank } = await import('../.tsbuild/retention.mjs');
  assert.equal(cleanerLevel({ rating: 5, reviewCount: 4 }), null);
  assert.equal(cleanerLevel({ rating: 4.5, reviewCount: 5 }), 'silver');
  assert.equal(cleanerLevel({ rating: 4.4, reviewCount: 50 }), null);
  assert.equal(cleanerLevel({ rating: 4.8, reviews: 20 }), 'gold');
  assert.equal(cleanerLevel({ rating: 4.79, reviewsCount: 20 }), 'silver');
  assert.equal(cleanerLevel(null), null);
  // Sample profiles never get one, whatever they claim.
  for (const id of ['bot_3', 'bot-ta-1', '12']) assert.equal(cleanerLevel({ id, rating: 5, reviewCount: 200 }), null, id);
  assert.equal(cleanerLevel({ id: 'Prpj4GssZNXI7KS8rA9woYOmJ10h', rating: 5, reviewCount: 200 }), 'gold');
  assert.ok(levelRank('gold') > levelRank('silver') && levelRank('silver') > levelRank(null));
  assert.deepEqual(levelProgress({ rating: 4.9, reviewCount: 3 }), { level: null, next: 'silver', reviewsToGo: 2, ratingNeeded: null, reviews: 3, rating: 4.9 });
  assert.deepEqual(levelProgress({ rating: 4.6, reviewCount: 25 }), { level: 'silver', next: 'gold', reviewsToGo: 0, ratingNeeded: 4.8, reviews: 25, rating: 4.6 });
  assert.equal(levelProgress({ rating: 5, reviewCount: 30 }).next, null);
});

test('among equally near and equally rated cleaners, the level orders them — never above a better rating', async () => {
  const { compareCleaners } = await import('../.tsbuild/displayOrder.mjs');
  const gold = { id: 'g', rating: 4.9, reviewCount: 25, distKm: 1 };
  const plain = { id: 'p', rating: 4.9, reviewCount: 2, distKm: 1 };
  assert.ok(compareCleaners(gold, plain) < 0);
  assert.ok(compareCleaners(plain, gold) > 0);
  // A better rating band still wins over a level.
  const silverLow = { id: 's', rating: 4.5, reviewCount: 40, distKm: 1 };
  const newTop = { id: 'n', rating: 5, reviewCount: 1, distKm: 1 };
  assert.ok(compareCleaners(newTop, silverLow) < 0);
});
