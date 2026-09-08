/**
 * The rule: who has to confirm their email address.
 *
 * Split from the sending on purpose. Sending touches Firebase; the rule is a
 * pure function of the user — and that is the difference between a decision
 * that can be tested and one that is only ever exercised in production, on
 * real people.
 *
 * Byte-identical to the other product's copy: the two products
 * share one Firebase project, and a cutoff that differed between them would let
 * a blocked account in through the other door. test/shared.test.mjs fails if
 * they drift apart.
 */
export const VERIFY_REQUIRED_FROM = Date.parse('2026-09-01T00:00:00Z');

/** Everything the decision needs about a user, and nothing more. */
export interface VerifiableUser {
  emailVerified: boolean;
  metadata?: { creationTime?: string | null } | null;
}

export function mustVerifyEmail(user: VerifiableUser): boolean {
  if (user.emailVerified) return false;
  const created = Date.parse(user.metadata?.creationTime ?? '');
  // No readable creation time — let them in. A sign-in that fails open costs a
  // little spam filtering; one that fails closed locks out a paying user over a
  // missing metadata field.
  return !Number.isNaN(created) && created >= VERIFY_REQUIRED_FROM;
}
