/**
 * Will this phone stay silent for its account — and why?
 *
 * A provider's alerts could be off with nothing anywhere saying so. One tap on
 * the profile's red button switched them off with no question asked, and from
 * then on the notification server skipped the account: urgent jobs still
 * popped up while the app was open, so everything looked fine, and no phone
 * rang once it was closed. The owner lost a day of testing to exactly that.
 *
 *   'opted-out'    — alerts were switched off in the profile (`pushOptOut`).
 *   'blocked'      — the system permission is off; only the phone's own
 *                    settings can bring it back.
 *   'unregistered' — permission is there, but registering this phone failed
 *                    just now: it holds no token to be rung on.
 *   null           — nothing known to be in the way.
 *
 * `permissionGranted` is null until the system has been asked, and that is not
 * a warning: the answer has not come back yet.
 */
export type PushSilence = 'opted-out' | 'blocked' | 'unregistered' | null;

export function pushSilence(
  pushOptOut: unknown,
  permissionGranted: boolean | null | undefined,
  registrationFailed = false,
): PushSilence {
  if (pushOptOut === true) return 'opted-out';
  if (permissionGranted === false) return 'blocked';
  if (registrationFailed) return 'unregistered';
  return null;
}
