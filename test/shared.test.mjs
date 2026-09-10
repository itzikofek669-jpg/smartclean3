import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// The two products share one Firebase project. Where they claim to agree, a
// difference is not a style issue — it lets an account blocked on one side in
// through the other.

/**
 * Where the website repo sits. Absolute paths used to be baked in here, which
 * meant these comparisons could only ever run on one laptop and never in CI —
 * the two repos live under different GitHub accounts, so no job can check out
 * both. `../A-M-Clean` is the layout on that machine; SITE_REPO overrides it.
 *
 * When it is not there the cross-repo checks skip rather than fail, because in
 * CI they are not the guard that matters: scripts/shared-hash.mjs compares each
 * repo's own copies against a manifest both repos carry, which needs no access
 * to the other side at all. These tests are the sharper version of the same
 * check, for when both repos are in front of you.
 */
const SITE = process.env.SITE_REPO
  ?? path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', 'A-M-Clean');
const APP = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const haveSite = fs.existsSync(path.join(SITE, 'package.json'));
const crossRepo = { skip: haveSite ? false : `website repo not found at ${SITE}` };

const read = p => fs.readFileSync(p, 'utf8');
const appFile = rel => path.join(APP, rel);
const siteFile = rel => path.join(SITE, rel);
const cutoff = src => src.match(/VERIFY_REQUIRED_FROM = Date\.parse\('([^']+)'\)/)?.[1];

test('both products use the same email-verification cutoff', crossRepo, () => {
  const app  = cutoff(read(appFile('lib/verifyRule.ts')));
  const site = cutoff(read(siteFile('src/lib/verifyRule.ts')));
  assert.ok(app, 'the app declares a cutoff');
  assert.equal(app, site, 'a differing cutoff lets a blocked account in through the other product');
});

test('registration is never followed by a sign-out', crossRepo, () => {
  // The bug: signing the new account out meant a verification email that never
  // arrived left the account unreachable — nobody could complete a signup.
  for (const p of [appFile('app/register.tsx'),
                   siteFile('src/pages/Register.tsx')]) {
    assert.ok(!/signOut\(/.test(read(p)), `${p} signs the new account out`);
  }
});

test('both products enforce the same Firestore rules', crossRepo, () => {
  // One project, one rules file. Whichever product deploys last wins, so a
  // difference here means the deployed rules depend on deploy order.
  const app  = read(appFile('firestore.rules'));
  const site = read(siteFile('firestore.rules'));
  assert.equal(app, site, 'firestore.rules differs; the deployed rules depend on which product deployed last');
});

// ── The drift guard's own guard ────────────────────────────────────────────
// A comparison that can be fooled is worse than none: it reports "identical"
// and everyone stops looking. Each case below defeated the regex version.

const OPEN  = '/' + '*';
const CLOSE = '*' + '/';

// ── The shared files themselves ───────────────────────────────────────────
// Comment-stripping is gone. Two versions of it were written and a review broke
// both — a character scanner read the `//` inside `/^https?:\\/\\//` as a comment,
// and the line-based rewrite that replaced it still swallowed everything to
// end-of-file when a line inside a template literal began with a block-comment
// opener. Both times two different files hashed the same, which is the one
// outcome this guard exists to prevent. The copies carry identical prose now and
// the comparison is over raw bytes, so there is nothing left to fool.

const SHARED_PAIRS = [
  ['lib/verifyRule.ts',    'src/lib/verifyRule.ts'],
  ['lib/displayOrder.ts',  'src/lib/displayOrder.ts'],
  ['lib/urgentRequest.ts', 'src/lib/urgentRequest.ts'],
  ['lib/cleanerTraits.ts', 'src/lib/cleanerTraits.ts'],
  ['lib/bookingSlot.ts',   'src/lib/bookingSlot.ts'],
  ['lib/bookingActions.ts', 'src/lib/bookingActions.ts'],
  // Added after an audit found it duplicated and unguarded: occupiesCleanerTime
  // and bookingOrigin answered the same question opposite ways, and only one of
  // them was in this list.
  ['lib/bookingOrigin.ts', 'src/lib/bookingOrigin.ts'],
  ['firestore.rules',      'firestore.rules'],
];

test('every shared file is byte-identical between the products', crossRepo, () => {
  for (const [appPath, sitePath] of SHARED_PAIRS) {
    assert.equal(
      read(appFile(appPath)),
      read(siteFile(sitePath)),
      `${appPath} differs from ${sitePath}`,
    );
  }
});

test('the manifest covers every file that is supposed to be shared', () => {
  // A shared file left out of the manifest is one nothing checks. This caught
  // cleanerTraits.ts, which carried a header saying the two copies must agree
  // while nothing compared them.
  // By NAME, not by count. Comparing lengths passed for a manifest holding the
  // right number of wrong names, or a duplicate — and this list is the third
  // hardcoded copy of the shared set, alongside SHARED in shared-hash.mjs.
  const manifest = read(appFile('shared-files.sha256'));
  const inManifest = manifest.trim().split('\n')
    .map(l => l.trim().split(/\s+/)[1])
    .filter(Boolean)
    .sort();
  const expected = [...new Set(SHARED_PAIRS.map(([appPath]) =>
    appPath.replace(/^lib\//, '').replace(/\.ts$/, '').replace('firestore.rules', 'firestoreRules'),
  ))].sort();
  assert.deepEqual(inManifest, expected,
    'the manifest and this file disagree about which files are shared');
  assert.equal(inManifest.length, new Set(inManifest).size, 'the manifest lists a file twice');
});

test('both products derive a busy window with the same default length', crossRepo, () => {
  // The bug: the claim path wrote the window through bookingSlot, whose default
  // is two hours, and both overlap checks defaulted to one. A booking with no
  // stated length was written 10:00–12:00 and read 10:00–11:00, so a second
  // booking at 11:00 was approved and genuinely collided. Not a shared file, so
  // nothing compared the two copies — this is the cheapest thing that does.
  for (const [label, src] of [
    ['app',  read(appFile('lib/jobUtils.ts'))],
    ['site', read(siteFile('src/lib/bookings.ts'))],
  ]) {
    assert.match(src, /const hours = bookingHours\(j\);/, `${label} derives its own default length`);
    assert.doesNotMatch(src, /Number\(j\?\.hours\) > 0 \? Number\(j\.hours\) : 1/, `${label} still defaults to one hour`);
  }
});
