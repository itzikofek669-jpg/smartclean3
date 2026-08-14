import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * A cleaner's "my work" gallery — one Firestore document per cleaner.
 *
 * ── Why this is not on the user document ────────────────────────────────────
 * It used to be: `users/{uid}.portfolio` held an array of base64 data URIs.
 * That is the same mistake the avatar had (see lib/photos.ts), only multiplied:
 *
 *  1. The cleaner list reads every cleaner document, and the SDK cannot project
 *     a subset of fields. So browsing cleaners downloaded every portfolio photo
 *     of every cleaner before a single card could render.
 *  2. A document is capped at 1 MiB, shared with every other profile field.
 *     Five photos at ~150 KB and a cleaner can no longer save their own price.
 *
 * The gallery now lives alone in `userPortfolios/{uid}` and is fetched only
 * when somebody actually opens the profile.
 *
 * ── Reading old profiles ────────────────────────────────────────────────────
 * `fetchPortfolio` falls back to the legacy inline array, so galleries built by
 * older builds keep rendering with no migration step. Saving from either
 * platform moves that cleaner across.
 *
 * Mirrored in A-M-Clean-web/src/lib/portfolio.ts. The two must agree: they
 * write to the same Firestore project, and the caps below are also written
 * into firestore.rules.
 */

const PORTFOLIOS = 'userPortfolios';

/** Hard ceiling, mirrored in firestore.rules. Twelve is already a lot to scroll. */
export const MAX_PORTFOLIO_IMAGES = 12;

/**
 * Per-image ceiling in characters, mirrored in the web copy. Rules cannot check
 * this (no way to iterate a list), so the clients are the only enforcement
 * before Firestore's own 1 MiB document limit.
 */
export const MAX_PORTFOLIO_IMAGE_CHARS = 260_000;

/** Session cache, so reopening a profile doesn't pay for the read twice. */
const cache = new Map<string, Promise<string[]>>();

export class PortfolioFullError extends Error {
  constructor() { super('PORTFOLIO_FULL'); this.name = 'PortfolioFullError'; }
}

/** Keep only usable image data URIs, capped at the maximum count. */
function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((u): u is string => typeof u === 'string' && u.startsWith('data:image/'))
    .slice(0, MAX_PORTFOLIO_IMAGES);
}

/**
 * Read a cleaner's gallery. Never throws — a profile that fails to load its
 * photos should still render everything else.
 */
export function fetchPortfolio(uid: string, legacy?: unknown): Promise<string[]> {
  if (!uid) return Promise.resolve([]);
  const hit = cache.get(uid);
  if (hit) return hit;

  const pending = getDoc(doc(db, PORTFOLIOS, uid))
    .then(snap => (snap.exists() ? clean((snap.data() as any)?.images) : clean(legacy)))
    // A denied or offline read still shows whatever the user document carried.
    .catch(() => clean(legacy));
  cache.set(uid, pending);
  return pending;
}

/** Overwrite the gallery. The caller owns ordering; this only validates. */
export async function savePortfolio(uid: string, images: string[]): Promise<void> {
  if (!uid) throw new Error('savePortfolio: missing uid');
  const next = clean(images);
  if (next.length > MAX_PORTFOLIO_IMAGES) throw new PortfolioFullError();
  await setDoc(doc(db, PORTFOLIOS, uid), {
    images: next,
    updatedAt: new Date().toISOString(),
  });
  cache.set(uid, Promise.resolve(next));
}

/** Drop the cached copy so the next read hits the server. */
export function invalidatePortfolio(uid: string): void {
  cache.delete(uid);
}
