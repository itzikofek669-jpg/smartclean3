import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The two products share one Firebase project. Where they claim to agree, a
// difference is not a style issue — it lets an account blocked on one side in
// through the other.

const read = p => fs.readFileSync(p, 'utf8');
const cutoff = src => src.match(/VERIFY_REQUIRED_FROM = Date\.parse\('([^']+)'\)/)?.[1];

test('both products use the same email-verification cutoff', () => {
  const app  = cutoff(read('/Users/ofek/Projects/smartclean3/lib/verifyRule.ts'));
  const site = cutoff(read('/Users/ofek/Projects/A-M-Clean/src/lib/verifyRule.ts'));
  assert.ok(app, 'the app declares a cutoff');
  assert.equal(app, site, 'a differing cutoff lets a blocked account in through the other product');
});

test('registration is never followed by a sign-out', () => {
  // The bug: signing the new account out meant a verification email that never
  // arrived left the account unreachable — nobody could complete a signup.
  for (const p of ['/Users/ofek/Projects/smartclean3/app/register.tsx',
                   '/Users/ofek/Projects/A-M-Clean/src/pages/Register.tsx']) {
    assert.ok(!/signOut\(/.test(read(p)), `${p} signs the new account out`);
  }
});

/**
 * Strip comments and blank lines, so prose about "the app" vs "the website"
 * may differ while a single line of behaviour may not.
 */
const codeOnly = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean)
  .join('\n');

test('both products order and rank identically', () => {
  // Comparing the email cutoff alone was not enough. `available` was computed
  // in each product separately and the two disagreed: a cleaner mid-job was
  // busy in the app and available on the web. It is the first key
  // compareCleaners sorts on, so the shared ordering diverged with it.
  //
  // The whole module is compared now, not one constant, because every export
  // in it is a promise that the two products show the same people the same way.
  const app  = codeOnly(read('/Users/ofek/Projects/smartclean3/lib/displayOrder.ts'));
  const site = codeOnly(read('/Users/ofek/Projects/A-M-Clean/src/lib/displayOrder.ts'));
  assert.equal(app, site, 'displayOrder.ts has drifted between the app and the website');
});

test('the verification rule is the same code, not just the same date', () => {
  const app  = codeOnly(read('/Users/ofek/Projects/smartclean3/lib/verifyRule.ts'));
  const site = codeOnly(read('/Users/ofek/Projects/A-M-Clean/src/lib/verifyRule.ts'));
  assert.equal(app, site, 'verifyRule.ts has drifted between the app and the website');
});

test('both products enforce the same Firestore rules', () => {
  // One project, one rules file. Whichever product deploys last wins, so a
  // difference here means the deployed rules depend on deploy order.
  const app  = read('/Users/ofek/Projects/smartclean3/firestore.rules');
  const site = read('/Users/ofek/Projects/A-M-Clean/firestore.rules');
  assert.equal(app, site, 'firestore.rules differs; the deployed rules depend on which product deployed last');
});
