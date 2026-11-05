import { useEffect, useState } from 'react';

/**
 * The current time as reactive state, re-read on a timer.
 *
 * Countdowns — "3 days left to review", "expires in 12 minutes" — were computing
 * `Date.now()` in the middle of render. Two things are wrong with that. The
 * React Compiler is enabled in app.json, and an impure read during render may be
 * memoised: the number can freeze at whatever it was the first time the screen
 * drew, and a wrong review deadline is worse than a stale one. And even without
 * the compiler it never actually counted down — it only moved when something
 * else happened to re-render the screen.
 *
 * As state with a tick, the value is a real input: pure to read, and it changes
 * on its own.
 */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Tick on the boundary — the top of the minute for 60_000 — so a cleaner whose
    // day ends at 18:00 turns red at 18:00, not up to a minute later, and every
    // screen that reads the clock moves together.
    let id: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), everyMs);
    }, everyMs - (Date.now() % everyMs));
    return () => { clearTimeout(first); if (id !== undefined) clearInterval(id); };
  }, [everyMs]);
  return now;
}
