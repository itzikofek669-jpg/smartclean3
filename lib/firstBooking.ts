import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logError } from './logError';

/**
 * Remember, permanently, that this client has booked a cleaner.
 *
 * The home screen's "past bookings" banner was derived from the live bookings
 * list: it appeared the moment a booking existed and disappeared again with
 * it. So it flickered on every load — the list starts empty and fills a
 * moment later — and a client who cancelled, or whose only booking was
 * cleared, lost the way back to the cleaner who had worked for them.
 *
 * The flag answers a different question from the list. The list says "which
 * cleaners worked for you", which changes; this says "you have booked at least
 * once", which cannot stop being true. It is written once, on the client's own
 * user document, and nothing clears it.
 *
 * A failed write is not an error the client should ever see: the booking
 * itself has already been written, and the banner is a shortcut, not the
 * product. It is logged and retried the next time the home screen loads.
 */
let marked = '';

export async function markHasBooked(uid: string): Promise<void> {
  if (!uid || marked === uid) return;
  marked = uid;
  try {
    // updateDoc, not setDoc+merge: a client always has a user document by the
    // time they can book, and a merge would quietly create a profile carrying
    // nothing but this flag — no name, no role — for an account that has none.
    await updateDoc(doc(db, 'users', uid), { hasBooked: true });
  } catch (err) {
    marked = '';
    logError('markHasBooked', err);
  }
}
