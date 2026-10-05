import { auth } from './firebase';
import { logError } from './logError';

/**
 * The notification server — the website's worker/notify.js, on Cloudflare.
 *
 * The app used to send every push itself, straight to Expo, reading the
 * recipient's token off their public profile. Expo asks for no credentials,
 * so any account could do the same with any text. Events now go here instead:
 * the server checks the sender is a party to the event, picks the recipient
 * from the document, writes the words and rings the phone — and holds a chat
 * push back when the recipient already has that conversation open.
 */
export const NOTIFY_URL = 'https://am-clean-notify.amclean.workers.dev';

export type NotifyEvent =
  | {
      event:
        | 'new_booking' | 'booking_confirmed' | 'booking_claimed'
        | 'booking_cancelled' | 'booking_released'
        | 'onway' | 'started' | 'ended' | 'recurring_created';
      bookingId: string;
    }
  | { event: 'urgent'; requestId: string; recipients: string[] }
  | { event: 'urgent_claimed'; requestId: string }
  | { event: 'message'; chatId: string }
  | { event: 'admin_broadcast'; title: string; body: string; recipients: string[] };

/**
 * Report an event. Resolves to how many phones rang and how many recipients
 * were skipped. Never throws: whatever happened already happened, whether or
 * not a phone buzzes about it.
 */
export async function notify(e: NotifyEvent): Promise<{ sent: number; skipped: number }> {
  const none = { sent: 0, skipped: 0 };
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return none;
    const res = await fetch(`${NOTIFY_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(e),
    });
    if (!res.ok) {
      logError('notify', new Error(`${e.event}: ${res.status}`));
      return none;
    }
    const body = await res.json().catch(() => null);
    return { sent: Number(body?.sent) || 0, skipped: Number(body?.skipped) || 0 };
  } catch (err) {
    logError('notify', err);
    return none;
  }
}

// The server takes at most this many recipients per broadcast request.
const BROADCAST_CHUNK = 400;

/**
 * An admin broadcast to `uids`, in as many requests as it takes. The server
 * looks up who has a phone registered; those who do not come back as skipped.
 */
export async function broadcast(title: string, body: string, uids: string[]): Promise<{ sent: number; skipped: number }> {
  // The lengths the server keeps. Cut here too: the server checks the request's
  // size before it trims, and a long text on top of 400 ids is refused.
  const t = title.trim().slice(0, 80);
  const b = body.trim().slice(0, 300);
  const all = Array.from(new Set(uids.filter(Boolean)));
  const total = { sent: 0, skipped: 0 };
  for (let i = 0; i < all.length; i += BROADCAST_CHUNK) {
    const r = await notify({ event: 'admin_broadcast', title: t, body: b, recipients: all.slice(i, i + BROADCAST_CHUNK) });
    total.sent += r.sent;
    total.skipped += r.skipped;
  }
  return total;
}
