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
 * It used to print in development and do nothing otherwise, which meant the
 * build people actually run could not explain itself: a released app hitting
 * one of these paths produced no console, no log, no trace of any kind. Every
 * call now also lands in the in-app diagnostics buffer, which costs a string in
 * a bounded array and is what makes a fault reproducible on a real device
 * without a laptop attached to it. See lib/diagnostics.ts.
 */
import { record } from './diagnostics';

export function logError(context: string, err: unknown): void {
  if (__DEV__) {
    console.warn(`[${context}]`, err);
  }
  record(context, err);
}
