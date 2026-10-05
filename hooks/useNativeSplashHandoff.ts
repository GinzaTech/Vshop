import { useCallback, useEffect, useRef, useState } from "react";
import { hideAsync } from "expo-splash-screen";
import { MOTION_DURATION } from "~/constants/Motion";
import { sanitizeErrorForLog } from "~/utils/log-redaction";

export type NativeSplashHide = () => Promise<void>;
const MAX_HIDE_ATTEMPTS = 3;

/**
 * Request once; retry at most twice, each after MOTION_DURATION.fast (140ms).
 * Pending calls and retry waits share one budget. After exhaustion, a new manual
 * request starts a fresh budget. Release means hide resolved, never just started.
 * StrictMode replay adopts the same native promise and remaining budget; cleanup
 * cancels timers and retires observers. Native I/O itself cannot be cancelled.
 */
export function useNativeSplashHandoff(hide: NativeSplashHide = hideAsync) {
  const [nativeSplashReleased, setReleased] = useState(false);
  const latestHide = useRef(hide);
  latestHide.current = hide;
  const released = useRef(false);
  const retired = useRef(false);
  const lifetime = useRef(0);
  const requested = useRef(false);
  const attempts = useRef(0);
  const pending = useRef<Readonly<{ promise: Promise<void> }> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resume = useRef<(() => void) | null>(null);

  const hideNativeSplash = useCallback(() => {
    if (retired.current || released.current || requested.current) return;
    requested.current = true;
    attempts.current = 0;
    resume.current?.();
  }, []);

  useEffect(() => {
    retired.current = false;
    const generation = ++lifetime.current;
    const current = () => !retired.current && lifetime.current === generation;

    function scheduleRetry() {
      if (!current() || timer.current !== null) return;
      timer.current = setTimeout(() => {
        if (!current()) return;
        timer.current = null;
        attemptHide();
      }, MOTION_DURATION.fast);
    }

    function observe(operation: Readonly<{ promise: Promise<void> }>) {
      void operation.promise.then(() => {
        if (!current() || pending.current !== operation) return;
        pending.current = null;
        requested.current = false;
        released.current = true;
        setReleased(true);
      }, (error: unknown) => {
        if (!current() || pending.current !== operation) return;
        pending.current = null;
        if (__DEV__) console.warn("[startup] Native splash handoff failed", sanitizeErrorForLog(error));
        if (attempts.current < MAX_HIDE_ATTEMPTS) scheduleRetry();
        else requested.current = false;
      });
    }

    function attemptHide() {
      if (!current() || released.current || !requested.current || pending.current) return;
      attempts.current += 1;
      let promise: Promise<void>;
      try { promise = Promise.resolve(latestHide.current()); }
      catch (error: unknown) { promise = Promise.reject(error); }
      const operation = { promise };
      pending.current = operation;
      observe(operation);
    }

    resume.current = () => {
      if (!current() || !requested.current || released.current) return;
      if (pending.current) observe(pending.current);
      else if (attempts.current === 0) attemptHide();
      else if (attempts.current < MAX_HIDE_ATTEMPTS) scheduleRetry();
    };
    resume.current();
    return () => {
      retired.current = true;
      lifetime.current += 1;
      resume.current = null;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  return { hideNativeSplash, nativeSplashReleased };
}
