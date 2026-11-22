import * as FileSystem from 'expo-file-system/legacy';
import { RecordingPresets, type RecordingOptions } from 'expo-audio';

/**
 * Chat voice notes — read a finished recording into the data URI that goes
 * straight into the Firestore message document.
 *
 * ── Why they live in Firestore ──────────────────────────────────────────────
 * The cleaner side of the chat (app/profile.tsx) used to upload voice notes to
 * Cloud Storage. Firebase Storage was never enabled on this project — the
 * bucket does not exist, and creating one has needed the Blaze plan since
 * October 2024 — so every one of those sends failed. Silently: the handler
 * swallowed the error into a generic alert, and nobody connected the two.
 *
 * The client side never used Storage; it has always written `audioBase64`
 * inline and has always worked. This module makes that the one way it is done,
 * so the two halves of the same conversation can no longer disagree.
 *
 * ── Why there is a cap ──────────────────────────────────────────────────────
 * A Firestore document is capped at 1 MiB, and base64 inflates bytes by ~33%.
 * The old guard was 700,000 characters — around a minute of audio, close enough
 * to the ceiling that a message could be rejected by Firestore itself, which
 * surfaces as an unreadable error. `MAX_VOICE_SECONDS` is the honest limit, and
 * it is the one the UI has been promising in every language: "הקלטה מקסימלית
 * ~30 שניות".
 */

/**
 * The one way every screen records a voice note (audit 22.11.2026).
 *
 * The chat tab recorded with LOW_QUALITY, which on Android is 3GP/AMR-NB —
 * stored under an m4a label, so neither the website nor an iPhone could play
 * it. The other screens recorded HIGH_QUALITY at 128 kbps stereo, ~16 KB/s,
 * and anything past ~18 s was refused after it had been recorded. AAC in MP4,
 * mono, 48 kbps plays everywhere and keeps 30 s near 180 KB.
 */
export const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 48000,
};

/** The advertised limit. `t.audioTooLongMsg` says this number out loud. */
export const MAX_VOICE_SECONDS = 30;

/**
 * Character cap on the base64 payload.
 *
 * expo-audio's HIGH_QUALITY preset records AAC at roughly 8 KB/s, so 30 s is
 * about 240 KB, or ~320 K base64 characters. The cap is set at 400,000 to leave
 * room for a higher-bitrate device without letting a two-minute recording
 * through — and it is still less than half a document, so the write itself is
 * never the thing that fails.
 */
export const MAX_VOICE_BASE64_CHARS = 400_000;

/** Thrown when a recording is over the limit. Callers show `t.audioTooLongMsg`. */
export class VoiceNoteTooLongError extends Error {
  constructor() {
    super(`voice note exceeds ~${MAX_VOICE_SECONDS}s`);
    this.name = 'VoiceNoteTooLongError';
  }
}

/**
 * Read a recorded file into a `data:audio/m4a;base64,…` URI.
 *
 * Throws `VoiceNoteTooLongError` when it is over the cap, and a plain Error if
 * the file cannot be read — never returns something oversized, because that
 * would only move the failure to the Firestore write where the message is
 * unreadable.
 */
export async function readVoiceNote(uri: string): Promise<string> {
  const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  if (!base64Data) throw new Error('readVoiceNote: empty recording');
  if (base64Data.length > MAX_VOICE_BASE64_CHARS) throw new VoiceNoteTooLongError();
  return `data:audio/m4a;base64,${base64Data}`;
}

/**
 * Play-side helper: a message may carry the inline note, or — for the handful
 * written before this change — a Storage URL that no longer resolves.
 */
export function voiceNoteSource(m: { audioBase64?: string; audioUrl?: string } | null | undefined): string {
  // Inline notes only: an audioUrl could point anywhere (audit 22.11.2026), and
  // the Storage ones from before no longer resolve.
  const v = typeof m?.audioBase64 === 'string' ? m.audioBase64 : '';
  return v.startsWith('data:audio/') ? v : '';
}
