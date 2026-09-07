import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { codeOnly } from '../scripts/shared-hash.mjs';

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

// One copy of the comparison, imported rather than repeated. This file used to
// carry its own byte-identical duplicate of codeOnly, so a fix to one would
// have left the other fooled — a drifting copy of the code that decides whether
// two copies have drifted.

test('both products order and rank identically', crossRepo, () => {
  // Comparing the email cutoff alone was not enough. `available` was computed
  // in each product separately and the two disagreed: a cleaner mid-job was
  // busy in the app and available on the web. It is the first key
  // compareCleaners sorts on, so the shared ordering diverged with it.
  //
  // The whole module is compared now, not one constant, because every export
  // in it is a promise that the two products show the same people the same way.
  const app  = codeOnly(read(appFile('lib/displayOrder.ts')));
  const site = codeOnly(read(siteFile('src/lib/displayOrder.ts')));
  assert.equal(app, site, 'displayOrder.ts has drifted between the app and the website');
});

test('the verification rule is the same code, not just the same date', crossRepo, () => {
  const app  = codeOnly(read(appFile('lib/verifyRule.ts')));
  const site = codeOnly(read(siteFile('src/lib/verifyRule.ts')));
  assert.equal(app, site, 'verifyRule.ts has drifted between the app and the website');
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

test('a behaviour change hidden between two string delimiters is still caught', () => {
  // The regex version deleted everything between these, guard included.
  const clean  = `const A = '${OPEN}'; const B = '${CLOSE}';`;
  const smuggled = `const A = '${OPEN}'; if (x !== true) return false; const B = '${CLOSE}';`;
  assert.notEqual(codeOnly(clean), codeOnly(smuggled),
    'a guard smuggled between two string literals compared equal');
});

test('a changed constant after a slashed string is still caught', () => {
  // The regex spared `://` for URLs, so any other `//` in a string ate the
  // rest of the line — and the constant sitting after it went with it.
  const five = "const DOCS = '//docs/ranking'; export const DISTANCE_BAND_KM = 5;";
  const nine = "const DOCS = '//docs/ranking'; export const DISTANCE_BAND_KM = 9;";
  assert.notEqual(codeOnly(five), codeOnly(nine), 'a changed band width compared equal');
});

test('a regex containing // is not mistaken for a comment', () => {
  // The scanner version read the `//` inside this regex as a comment and
  // deleted the rest of the line, so a changed constant after it compared
  // equal. There is no way to tell a regex from division without parsing
  // JavaScript, so the comparison no longer looks inside a line of code.
  const five = 'const RE = /^https?:\\/\\//; const LIMIT = 5;';
  const many = 'const RE = /^https?:\\/\\//; const LIMIT = 999;';
  assert.notEqual(codeOnly(five), codeOnly(many));
});

test('a regex that looks like a block comment does not eat the file', () => {
  // `/a/*b/` sent the scanner hunting for a terminator that never came, and
  // everything from there to end of file vanished from the hash.
  const a = 'const r = /a/*b/; const Z = 1;\nexport const AFTER = 10;';
  const b = 'const r = /a/*b/; const Z = 2;\nexport const AFTER = 20;';
  assert.notEqual(codeOnly(a), codeOnly(b));
  assert.ok(codeOnly(a).includes('AFTER'), 'the rest of the file survived');
});

test('a newline that changes what a function returns is not collapsed away', () => {
  // Whitespace is not always insignificant: one of these returns undefined.
  const asi  = 'function f(){ return\n{ok:1} }';
  const same = 'function f(){ return {ok:1} }';
  assert.notEqual(codeOnly(asi), codeOnly(same));
});

test('reformatting IS reported, and that is the deliberate trade', () => {
  // Line structure is preserved now, so rewrapping a signature reads as drift.
  // That direction is chosen on purpose: a false alarm gets looked at, a false
  // pass does not — and the false passes above were real.
  const oneLine = 'export function f(a, b) { return a + b; }';
  const wrapped = 'export function f(\n  a,\n  b,\n) {\n  return a + b;\n}';
  assert.notEqual(codeOnly(oneLine), codeOnly(wrapped));
});

test('comments may differ, code may not', () => {
  const hebrew  = `${OPEN}* הסבר בעברית ${CLOSE}\nexport const N = 1;`;
  const english = `${OPEN}* An explanation in English ${CLOSE}\nexport const N = 1;`;
  assert.equal(codeOnly(hebrew), codeOnly(english), 'prose is allowed to differ');
  const changed = `${OPEN}* An explanation in English ${CLOSE}\nexport const N = 2;`;
  assert.notEqual(codeOnly(english), codeOnly(changed), 'the value is not');
});

test('a URL inside a string survives intact', () => {
  const a = "const U = 'https://example.com/a'; const K = 1;";
  const b = "const U = 'https://example.com/b'; const K = 1;";
  assert.notEqual(codeOnly(a), codeOnly(b), 'a changed URL is a changed string');
  assert.ok(codeOnly(a).includes('https://example.com/a'), 'the URL was not eaten');
});

test('an escaped quote does not end the string early', () => {
  const a = `const S = 'it\\'s'; const N = 1;`;
  const b = `const S = 'it\\'s'; const N = 2;`;
  assert.notEqual(codeOnly(a), codeOnly(b));
});
