import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRole } from '../.tsbuild/resolveRole.mjs';
import { mustVerifyEmail, VERIFY_REQUIRED_FROM } from '../.tsbuild/verifyRule.mjs';

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
