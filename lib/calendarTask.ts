/**
 * Take a cancelled cleaning out of the device calendar without the app being
 * opened.
 *
 * The device calendar can only be written by a process on that device holding
 * calendar permission — no server can reach into it. So a cancellation reached
 * the other party's calendar only when they next opened the app, and until then
 * their phone still showed a confirmed cleaning, with its alarm. A cancellation
 * made on the website cleared nobody's calendar at all, because a browser has no
 * access to one either.
 *
 * A data-only push (sent by the onBookingCancelled function in the website
 * repo) wakes this task and it does the removal. Limits worth knowing, because
 * this is an improvement and not a guarantee:
 *
 *   • Android runs this reliably in the background, but Doze and the aggressive
 *     battery managers some vendors ship can delay or drop it.
 *   • iOS throttles silent pushes and does not deliver them at all while the app
 *     is force-quit from the app switcher.
 *
 * In both cases the existing on-launch sync is still there and still catches
 * whatever the push missed. Nothing here replaces it.
 *
 * The task must be DEFINED at module scope and this module imported for its side
 * effect before any notification is handled — see app/_layout.tsx. Defining it
 * inside a component would register it too late in a cold background start.
 */
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { removeBookingFromCalendar } from './calendarSync';
import { readCalendarRemoval, extractPushData } from './calendarPush';
import { logError } from './logError';
import { record } from './diagnostics';

export const CALENDAR_PUSH_TASK = 'calendar-remove-on-cancel';

TaskManager.defineTask(CALENDAR_PUSH_TASK, async ({ data, error }) => {
  if (error) {
    logError('calendarTask:delivery', error);
    return;
  }
  const removal = readCalendarRemoval(extractPushData(data));
  // Not for us — a chat push, a broadcast, anything else. Silence is correct.
  if (!removal) return;

  try {
    // The uid comes from the payload rather than from auth.currentUser: this
    // runs in a fresh JS context where auth persistence has not been restored,
    // so currentUser is null for a moment and the stored event ids are keyed
    // per user. Reading it anyway would look like a clean no-op while the entry
    // stayed in the calendar.
    await removeBookingFromCalendar(removal.bookingId, undefined, { uid: removal.uid });
    record('calendar:pushRemoved', { id: removal.bookingId });
  } catch (err) {
    logError('calendarTask:remove', err);
  }
});

/**
 * Ask the OS to deliver background notifications to the task above.
 *
 * Safe to call repeatedly. Failure is not worth surfacing to the user: it costs
 * the promptness of the removal, not the removal itself, which the on-launch
 * sync still performs.
 */
export async function registerCalendarPushTask(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(CALENDAR_PUSH_TASK)) return;
    await Notifications.registerTaskAsync(CALENDAR_PUSH_TASK);
    record('calendar:taskRegistered', {});
  } catch (err) {
    logError('calendarTask:register', err);
  }
}
