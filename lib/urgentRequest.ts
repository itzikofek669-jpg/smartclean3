/**
 * When an urgent request is still live, and when it may be deleted.
 *
 * These were two questions being answered by one expression, differently, in
 * five places. `!r.expiresAt || parse(r.expiresAt) > now` in two of them treated
 * a request with no expiry as live; `!r.expiresAt || parse(r.expiresAt) <= now`
 * in two others treated it as expired AND deleted it; a fifth required the field
 * and hid the request without it. An unparseable timestamp inverted all of them
 * at once, because both `NaN > now` and `NaN <= now` are false.
 *
 * So one legacy document without the field showed on both job boards, was
 * invisible in the app's urgent popup, and was deleted out from under all of
 * them the moment its owner opened their dashboard.
 *
 * Splitting the two questions is what makes them answerable:
 *
 *   • Showing a request we cannot bound is wrong — it might have lapsed weeks
 *     ago and a cleaner would be told to hurry.
 *   • Deleting a request we cannot bound is worse, and irreversible. The
 *     timestamp is our own bug; the client's request is real. Deletion requires
 *     a timestamp that actually parses and has actually passed.
 *
 * Kept identical between the two products — shared-files.sha256 covers it.
 */

export interface ExpirableRequest {
  /** ISO 8601. Written by both products since urgent requests existed. */
  expiresAt?: string | null;
  /** The slot the client asked for, local time: YYYY-MM-DD and HH:MM. */
  dateStr?: string | null;
  startTime?: string | null;
}

/** When the requested slot starts, or null when it cannot be read. */
export function slotOf(r: ExpirableRequest | null | undefined): number | null {
  const d = typeof r?.dateStr === 'string' ? r.dateStr : '';
  const s = typeof r?.startTime === 'string' ? r.startTime : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{2}:\d{2}$/.test(s)) return null;
  const t = new Date(`${d}T${s}`).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Milliseconds since the epoch, or null when the value is not a real instant. */
export function expiryOf(r: ExpirableRequest | null | undefined): number | null {
  const raw = r?.expiresAt;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/**
 * Should this request be shown to anyone?
 *
 * No usable expiry means no: an unbounded request is one nobody can say is
 * still wanted.
 */
export function isUrgentRequestLive(
  r: ExpirableRequest | null | undefined,
  now: Date = new Date(),
): boolean {
  const t = expiryOf(r);
  if (t === null || t <= now.getTime()) return false;
  // Nor once the hour it asks for has gone. A request a cleaner hands back gets a
  // fresh window of at least an hour, so one released after its slot read as
  // live for that hour — on both boards and claimable — and the pending booking
  // the claim made was swept straight back as "your cleaner cancelled".
  const start = slotOf(r);
  return start === null || start > now.getTime();
}

/**
 * May this request be swept away?
 *
 * True for a request that has genuinely lapsed, AND for one whose expiry
 * cannot be read at all.
 *
 * The undateable case was excluded at first, on the reasoning that the missing
 * timestamp is our defect and the client's request is real. A review showed
 * that made things worse, not safer. Nothing displays such a request — every
 * list filters on isUrgentRequestLive, including its owner's own dashboard —
 * so the "it stays hidden until a person looks at it" escape hatch did not
 * exist. Meanwhile hasClashingRequest treats anything not cancelled, expired or
 * done as a clash — and a legacy document sits at `status: 'open'` — so an
 * invisible, undeletable request permanently blocked its own owner from posting
 * anything at that date and time, with nothing on screen to explain why and no
 * control that could clear it.
 *
 * Sweeping it is safe because only the owner ever does: both products filter
 * their sweep to `clientUid == me`, which is also the only case the Firestore
 * rules permit. So this deletes a person's own unreadable request, which is
 * exactly what used to happen before the unification and what unblocks them.
 */
export function isUrgentRequestExpired(
  r: ExpirableRequest | null | undefined,
  now: Date = new Date(),
): boolean {
  const t = expiryOf(r);
  return t === null || t <= now.getTime();
}

// ── When an urgent cleaning may start ─────────────────────────────────────────
//
// The app's picker ran to 23:30 and the website's to 23:30 as well, so a client
// could broadcast a 🚨 request for a cleaning starting at half past eleven at
// night — and every cleaner in range was woken by a high-priority push for it.
// Urgent is the one notification channel allowed to interrupt a cleaner, so the
// window it can fire for is a business rule, not a UI preference: nothing
// starts after 22:00.
//
// Lives here, in the shared file, so the two products cannot drift: the app's
// wheel, the website's stepper and both send paths read the same number.

/** Latest hour an urgent cleaning may start, local time. 22 = 22:00. */
export const URGENT_LAST_START_HOUR = 22;

/**
 * Earliest hour an urgent cleaning may start, local time. 7 = 07:00.
 *
 * Capping the evening left the night wide open: a request made at 00:10 was
 * pre-filled for 01:00 and sent, and every cleaner who never set her hours —
 * the ones worksAt deliberately keeps alertable — was woken by it. The website
 * already started its stepper at 07:00; now both products refuse earlier.
 */
export const URGENT_FIRST_START_HOUR = 7;

/** "HH:MM" → hours as a number: "21:30" → 21.5. NaN when unparseable. */
export function hourOfTime(hhmm: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m) return NaN;
  return Number(m[1]) + Number(m[2]) / 60;
}

/** May an urgent cleaning start at this hour? 07:00 to 22:00, both included. */
export function urgentStartAllowed(hour: number): boolean {
  return Number.isFinite(hour) && hour >= URGENT_FIRST_START_HOUR && hour <= URGENT_LAST_START_HOUR;
}

/**
 * The first hour a form may offer for an urgent cleaning today: now plus the
 * form's lead time, rounded up to the half hour, and never before 07:00.
 */
export function urgentFirstSlot(now: Date = new Date(), leadMinutes = 0): number {
  const mins = now.getHours() * 60 + now.getMinutes() + leadMinutes;
  return Math.max(URGENT_FIRST_START_HOUR, Math.ceil(mins / 30) * 30 / 60);
}

/**
 * Is today already past the last urgent start?
 *
 * The first slot a form can offer is "now", rounded up to the next half hour,
 * plus whatever lead time that form adds (`leadMinutes` — the website keeps a
 * 30-minute buffer, the app none). When that first slot is later than 22:00
 * there is nothing left to pick today, and the form must move to tomorrow
 * rather than offer an empty wheel or a time that will be refused.
 */
export function urgentTodayClosed(now: Date = new Date(), leadMinutes = 0): boolean {
  return urgentFirstSlot(now, leadMinutes) > URGENT_LAST_START_HOUR;
}

/** What an edited request carries over from the one it replaces. */
export interface UrgentEditContext {
  /** Everyone who was already alerted about this request, in any of its versions. */
  alerted: string[];
  /** The ids this request has had, oldest first — the last one is the request being edited. */
  chain: string[];
  /** Whose request it is, and when ✏️ was pressed (see liveUrgentEdit). */
  owner: string;
  at: number;
}

/**
 * The longest an ✏️ can stay in progress: the life of an urgent request. A
 * backstop only — the forms themselves end the edit when they close.
 */
export const URGENT_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

const stringsOf = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && !!x);

/**
 * Editing an urgent request withdraws it and sends a corrected one. To the
 * cleaners it is the same request with different details, not a second call:
 * whoever was alerted the first time is not alerted again — the change simply
 * shows on the request. This reads, from the request being withdrawn, who that
 * was and which request the corrected one continues.
 *
 * `pushedCleaners` is who was actually rung, and `alertedBefore` who had been
 * rung for the versions before it — counted on its own too, in case the write
 * that folds it into `pushedCleaners` never landed. A request sent before
 * either field existed has only `notifiedCleaners`, everyone it reached; they
 * stand in.
 */
export function urgentEditContext(
  id: string,
  old: {
    pushedCleaners?: unknown; notifiedCleaners?: unknown; alertedBefore?: unknown;
    editChain?: unknown; clientUid?: unknown;
  } | null | undefined,
  now: number = Date.now(),
): UrgentEditContext {
  const rung = Array.isArray(old?.pushedCleaners) ? stringsOf(old?.pushedCleaners) : stringsOf(old?.notifiedCleaners);
  return {
    alerted: Array.from(new Set([...stringsOf(old?.alertedBefore), ...rung])),
    chain: [...stringsOf(old?.editChain), id].slice(-20),
    owner: typeof old?.clientUid === 'string' ? old.clientUid : '',
    at: now,
  };
}

/**
 * The ✏️ still in progress, if there is one — and it is the ONLY thing that
 * holds a push back. A request is the corrected one when it is sent from the
 * form ✏️ opened, in that sitting: each form drops the context when it closes,
 * so anything sent afterwards is a new request and rings everyone. This adds
 * the two checks a form cannot make for itself: the same account, and not
 * hours later.
 */
export function liveUrgentEdit(
  edit: UrgentEditContext | null | undefined,
  uid: string | null | undefined,
  now: number = Date.now(),
): UrgentEditContext | null {
  if (!edit || !uid || edit.owner !== uid) return null;
  const age = now - edit.at;
  return age >= 0 && age <= URGENT_EDIT_WINDOW_MS ? edit : null;
}

/**
 * Who to ring for a request, given who would be rung for a new one (`ring`)
 * and — when it is an edit — who was alerted already.
 *
 *   push    — the cleaners to alert now: nobody twice, and at most `limit`
 *             (what one call to the notification server carries).
 *   alerted — everyone alerted so far, to store on the request for the next edit.
 */
export function urgentPushPlan(
  ring: readonly string[],
  edit: UrgentEditContext | null | undefined,
  limit = 500,
): { push: string[]; alerted: string[] } {
  const before = Array.from(new Set(edit?.alerted ?? []));
  const push = Array.from(new Set(ring)).filter((uid) => !before.includes(uid)).slice(0, limit);
  return { push, alerted: before.concat(push).slice(-2000) };
}

/**
 * Who counts as alerted once the push was attempted. The newly rung only when
 * the server rang somebody (`sent`): a push that failed outright alerted no
 * one, and the corrected request is then their first alert, not a repeat.
 */
export function urgentAlertedAfter(
  plan: { push: string[]; alerted: string[] },
  edit: UrgentEditContext | null | undefined,
  sent: number,
): string[] {
  return sent > 0 ? plan.alerted : Array.from(new Set(edit?.alerted ?? []));
}
