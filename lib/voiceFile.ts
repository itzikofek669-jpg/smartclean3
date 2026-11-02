/**
 * The temp file a voice note is written to before it plays.
 *
 * The extension is not decoration: AVPlayer goes by it, so a note recorded on the
 * website as WAV and saved as .m4a will not open on an iPhone. Everything else in
 * a chat is AAC in MP4, the app's own recordings included.
 */
export function voiceFileName(src: string, msgId: string): string {
  return `voice_${msgId}${/^data:audio\/(x-)?wav/.test(src) ? '.wav' : '.m4a'}`;
}
