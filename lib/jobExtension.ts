import { deleteField, doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { notify } from './notify';
import {
  extensionApproval, extensionDecline, extensionRequestOf, pendingExtension, sameExtension,
  type ExtensionRequest,
} from './bookingAmount';

/**
 * More time, with the client's approval — where the writes are sent from.
 * What they contain is the shared lib/bookingAmount, and firestore.rules
 * checks exactly that. Each one reads the booking afresh in a transaction: the
 * card on screen can be a snapshot behind (an extension approved a moment ago
 * changes the hours and the rate the next one is priced at). The website does
 * the same in src/lib/jobExtension.ts.
 */

/** The request changed or went while the client was looking at it. */
export class ExtensionChangedError extends Error {
  constructor() {
    super('extension-changed');
    this.name = 'ExtensionChangedError';
  }
}

/** The provider asks for `extra` more hours. False when it may not be asked (any more). */
export async function requestExtension(bookingId: string, extra: number): Promise<boolean> {
  const ref = doc(db, 'bookings', bookingId);
  const asked = await runTransaction(db, async (tx) => {
    const cur = (await tx.get(ref)).data();
    const req = cur ? extensionRequestOf(cur, extra) : null;
    if (!req) return false;
    // The last answer goes with a new request: a "declined" left under a fresh
    // question would read as the answer to it.
    tx.update(ref, { extRequest: req, ...(cur?.extResult ? { extResult: deleteField() } : {}) });
    return true;
  });
  if (asked) void notify({ event: 'extension_requested', bookingId });
  return asked;
}

/** The provider takes her request back. False when there was none left to take. */
export async function withdrawExtension(bookingId: string): Promise<boolean> {
  const ref = doc(db, 'bookings', bookingId);
  return runTransaction(db, async (tx) => {
    const cur = (await tx.get(ref)).data();
    if (!cur?.extRequest) return false;
    tx.update(ref, { extRequest: deleteField() });
    return true;
  });
}

/**
 * The client approves or declines the request she was shown. Throws
 * ExtensionChangedError when it is no longer the one standing — withdrawn,
 * or withdrawn and asked again for other hours, which is a new question.
 */
export async function answerExtension(bookingId: string, shown: ExtensionRequest, approve: boolean): Promise<void> {
  const ref = doc(db, 'bookings', bookingId);
  await runTransaction(db, async (tx) => {
    const cur = (await tx.get(ref)).data();
    if (!cur || !sameExtension(pendingExtension(cur), shown)) throw new ExtensionChangedError();
    const write = approve ? extensionApproval(cur) : extensionDecline(cur);
    if (!write) throw new ExtensionChangedError();
    tx.update(ref, { ...write, extRequest: deleteField() });
  });
  void notify({ event: 'extension_answered', bookingId });
}
