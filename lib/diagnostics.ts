// Per-device diagnostics: an in-app log, and louder failures while it is on.
//
// This exists because a release build has been unable to explain itself. Every
// recovery point in the app calls logError, and logError was:
//
//   if (__DEV__) console.warn(...)
//
// — which is nothing at all in the build people actually run. Three of the six
// calendar-sync outcomes are deliberately silent in the UI as well, so "the
// booking never reached my calendar" and "it reached a calendar you cannot see"
// and "the query that would have added it failed" all look identical from the
// outside. That is why the calendar bug survived five rounds.
//
// The log is always collected — it is a bounded array of strings and costs
// nothing. The flag only controls whether failures also interrupt the user.

import * as SecureStore from 'expo-secure-store';
import { auth } from './firebase';

const KEY = () => `amclean_diagnostics_${auth.currentUser?.uid ?? 'anon'}`;

/** Kept small deliberately: this is the tail of what just happened, not history. */
const MAX_LINES = 120;
const lines: string[] = [];

// Read synchronously by call sites that cannot await, so it is cached in memory
// and primed once at startup — the same shape as lib/demoMode.
let enabled = false;

/** True when this device has diagnostics turned on. */
export function diagnosticsEnabled(): boolean {
  return enabled;
}

/** Load the stored preference. Called once, at app start. */
export async function loadDiagnostics(): Promise<void> {
  try {
    enabled = (await SecureStore.getItemAsync(KEY())) === '1';
  } catch {
    // A device that cannot read the flag simply runs without diagnostics.
  }
}

/** Turn diagnostics on or off for this device, and remember it. */
export async function setDiagnostics(on: boolean): Promise<void> {
  enabled = on;
  try {
    if (on) await SecureStore.setItemAsync(KEY(), '1');
    else await SecureStore.deleteItemAsync(KEY());
  } catch {
    // Not worth failing over; the in-memory flag still applies this session.
  }
}

/** Append a line. Oldest is dropped once the buffer is full. */
export function record(context: string, detail?: unknown): void {
  const stamp = new Date().toISOString().slice(11, 19);
  let text = '';
  if (detail instanceof Error) text = detail.message;
  else if (typeof detail === 'string') text = detail;
  else if (detail !== undefined) {
    try { text = JSON.stringify(detail); } catch { text = String(detail); }
  }
  lines.push(`${stamp}  ${context}${text ? '  ' + text : ''}`);
  if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
}

/** Newest first, for display. */
export function getLog(): string[] {
  return [...lines].reverse();
}

export function clearLog(): void {
  lines.length = 0;
}
