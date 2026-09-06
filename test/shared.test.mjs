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
