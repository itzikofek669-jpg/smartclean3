/**
 * One place for "this failed and we chose to keep going".
 *
 * This app had 89 `catch (_) {}` blocks. Each one was a deliberate decision —
 * don't let a non-essential write break the screen — but written as an empty
 * block it also throws away the evidence. That is how a real bug survived for
 * months: the web app's rating update was rejected by the Firestore rules on
 * every single review, inside an empty catch, so cleaner ratings silently never
 * moved and nothing anywhere said a word.
 *
 * Swallowing the error is often right. Swallowing the *knowledge* never is.
 *
 * Use at any recovery point:
 *
 *   try { await optionalThing(); } catch (err) { logError('where', err); }
 *
 * In development it prints with context; in production it stays quiet. Swap the
 * body for Crashlytics/Sentry when you add one and every call site starts
 * reporting without being touched again.
 */
export function logError(context: string, err: unknown): void {
  if (__DEV__) {
    console.warn(`[${context}]`, err);
  }
  // Production hook: report(context, err)
}
