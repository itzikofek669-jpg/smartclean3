/**
 * Is this build older than the oldest one the admin still allows?
 *
 * Read from the public `settings/appVersion` document (rules: anyone may read
 * that one document; only an admin writes it). Builds before 206 stopped being
 * able to send pushes once the notification server took them over (phase D,
 * 11.11.2026), and nothing could tell their users to update. From this build
 * on, the admin raises the minimum and older builds show an update screen.
 *
 * Fails open on purpose: no document, a field that is not a number, or a build
 * number that cannot be read all mean "not outdated". A wrong value here must
 * never lock anyone out of a working app.
 */
export type AppVersionConfig = {
  minAndroidBuild?: unknown;
  minIosBuild?: unknown;
  updateUrl?: unknown;
  updateUrlIos?: unknown;
};

/**
 * A minimum this far above the running build is a typo, not a release: CI adds
 * one per build, so nobody is 500 builds behind. 12360 typed for 1236 would
 * otherwise lock every user out — the admin too, whose own app shows the
 * screen — with the website the only way back (review 13.11.2026).
 */
export const MAX_BUILDS_AHEAD = 500;

export function outdatedBuild(
  cfg: AppVersionConfig | null | undefined,
  platform: string,
  nativeBuild: string | number | null | undefined,
): boolean {
  if (!cfg) return false;
  // Android only for now. The iOS build number (CFBundleVersion) is "1" on
  // every build — app.json sets none and CI stamps none — so any iPhone
  // minimum above 1 would lock out every iPhone, for good. When CI stamps one,
  // read cfg.minIosBuild here.
  if (platform !== 'android') return false;
  const min = cfg.minAndroidBuild;
  if (typeof min !== 'number' || !Number.isFinite(min) || min <= 0) return false;
  const cur = typeof nativeBuild === 'number' ? nativeBuild : Number(String(nativeBuild ?? '').trim());
  if (!Number.isFinite(cur) || cur <= 0) return false;
  if (min - cur > MAX_BUILDS_AHEAD) return false;
  return cur < min;
}

/** Where the update button goes: an http(s) link, or nothing. */
export function updateLinkFor(cfg: AppVersionConfig | null | undefined, platform: string): string {
  if (!cfg) return '';
  const raw = platform === 'ios' && typeof cfg.updateUrlIos === 'string' && cfg.updateUrlIos ? cfg.updateUrlIos : cfg.updateUrl;
  const url = typeof raw === 'string' ? raw.trim() : '';
  return /^https:\/\/[^\s]+$/i.test(url) ? url : '';
}
