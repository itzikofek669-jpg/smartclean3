import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * A stable Animated.Value, created once per component instance.
 *
 * `useRef(new Animated.Value(0)).current` is the standard React Native idiom and
 * it is correct — the value is created once, read once during render, and never
 * reassigned. But app.json turns the React Compiler on, and its rules flag every
 * one of those reads as "cannot access refs during render". There were 26 across
 * the app, which is 40% of the lint errors and enough noise to bury the handful
 * that are real.
 *
 * So the idiom lives here, once, with one justified suppression, and every
 * screen calls this instead. `new Animated.Value(...)` is not constructed on
 * later renders: the ref is only filled when it is still null.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  const ref = useRef<Animated.Value | null>(null);
  // eslint-disable-next-line react-hooks/react-compiler -- see above: created
  // once, never reassigned, and the alternative is 26 copies of this comment.
  if (ref.current === null) ref.current = new Animated.Value(initial);
  return ref.current;
}

/** The same, for a fixed-length row of them (star ratings, dot loaders). */
export function useAnimatedValues(count: number, initial: number): Animated.Value[] {
  const ref = useRef<Animated.Value[] | null>(null);
  // eslint-disable-next-line react-hooks/react-compiler -- see useAnimatedValue.
  if (ref.current === null) {
    ref.current = Array.from({ length: count }, () => new Animated.Value(initial));
  }
  return ref.current;
}
