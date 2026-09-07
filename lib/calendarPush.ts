/**
 * What a silent push is asking the device to do about its calendar.
 *
 * A cancelled booking has to come out of BOTH parties' calendars, but only the
 * person who pressed cancel is in the app at that moment — the other side used
 * to keep a confirmed cleaning in their calendar, alarm and all, until they
 * next opened the app. A cancellation made on the website cleared nobody's,
 * because a browser cannot touch a device calendar at all.
 *
 * So the server sends a data-only push and the device does the removal. This
 * module is the part of that with no I/O in it: read an untrusted payload,
 * decide what it authorises, and say no to everything else. Kept separate so it
 * can be tested — the task around it needs a real device and cannot be.
 *
 * The payload is not trusted. It arrives from the network, and the only thing
 * it is allowed to cause is the removal of an event this device created for a
 * booking, for the user it names. A push that names a different user removes
 * nothing: the stored event ids are keyed per uid, and the mismatch means the
 * push was meant for a different account on a shared device.
 */

/** A booking whose calendar entry should be removed, for a specific user. */
export interface CalendarRemoval {
  bookingId: string;
  /** Whose calendar entry — the stored event ids are keyed per user. */
  uid: string;
}

/** The `data` block of an incoming push, as it arrives: anything at all. */
export type PushPayload = Record<string, unknown> | null | undefined;

/**
 * Read a removal instruction out of a push payload, or null if there is none.
 *
 * Null is the answer for anything unexpected — a different notification type, a
 * missing id, a payload that is not an object. Acting on a malformed push is
 * strictly worse than ignoring it: nothing here is urgent enough to guess.
 */
export function readCalendarRemoval(data: PushPayload): CalendarRemoval | null {
  if (!data || typeof data !== 'object') return null;
  // Both spellings. `booking_cancelled` is what the apps have sent on the
  // visible cancellation notification since long before this existed, and
  // reusing that push is what makes this work without a Cloud Function — the
  // project is on the Spark plan and cannot deploy one (see the website's
  // src/lib/features.ts). `booking-cancelled` is what the server-side trigger
  // sends, for the day the project moves to Blaze.
  if (data.type !== 'booking_cancelled' && data.type !== 'booking-cancelled') return null;

  const bookingId = typeof data.bookingId === 'string' ? data.bookingId.trim() : '';
  const uid = typeof data.uid === 'string' ? data.uid.trim() : '';
  if (!bookingId || !uid) return null;

  return { bookingId, uid };
}

/**
 * Dig the notification's own `data` block out of what a background task is
 * handed.
 *
 * expo-notifications has moved this around between versions and it differs by
 * platform: Android's headless task gets the raw FCM message, iOS gets
 * something shaped like a Notification object, and a foreground listener hands
 * over a third shape again. None of that can be exercised without a device, so
 * every shape that has existed is accepted and the choice is made here, where
 * it can be tested, instead of inside the task where it cannot.
 *
 * Unknown shape means null, and null means do nothing.
 */
export function extractPushData(taskData: unknown): PushPayload {
  const seen = new Set<unknown>();
  let node: any = taskData;

  // Walk the known nestings, deepest-first, without looping forever on a
  // self-referential object.
  for (let i = 0; i < 6; i += 1) {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);

    // A payload that already carries our marker is the answer.
    if (typeof node.type === 'string' && typeof node.bookingId === 'string') {
      return node as Record<string, unknown>;
    }

    const next =
      node.request?.content?.data
      ?? node.notification?.request?.content?.data
      ?? node.notification?.data
      ?? node.content?.data
      ?? node.data;

    if (next === undefined || next === node) return null;
    node = next;
  }
  return null;
}
