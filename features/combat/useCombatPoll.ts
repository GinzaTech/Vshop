import React from "react";
import { sanitizeErrorForLog } from "~/utils/log-redaction";

const POLL_INTERVAL = 10_000;

/** Schedule after settlement and retain the in-flight guard across blur/effect restarts. */
export function useCombatPoll<T>({ enabled, repeat, request, onResult, onError, isCurrent }: {
  enabled: boolean;
  repeat: boolean;
  request: (isCurrent: () => boolean) => Promise<T>;
  onResult?: (value: T) => void;
  onError?: () => void;
  isCurrent: () => boolean;
}) {
  const pending = React.useRef<Promise<void> | null>(null);
  const generation = React.useRef(0);
  React.useEffect(() => {
    const requestId = ++generation.current;
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => generation.current === requestId && isCurrent();
    const schedule = () => {
      if (repeat && current()) timer = setTimeout(() => { void poll(); }, POLL_INTERVAL);
    };
    const poll = async () => {
      if (!current()) return;
      if (pending.current) {
        await pending.current;
        // A cancelled request cannot deliver into the resumed effect.
        if (repeat) schedule();
        else if (current()) void poll();
        return;
      }
      const task = (async () => {
        try {
          const value = await request(current);
          if (current()) onResult?.(value);
        } catch (error) {
          if (current()) {
            if (__DEV__) console.warn("[combat] Refresh failed", sanitizeErrorForLog(error));
            onError?.();
          }
        }
      })();
      pending.current = task;
      await task;
      if (pending.current === task) pending.current = null;
      schedule();
    };
    void poll();
    return () => {
      generation.current += 1;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [enabled, isCurrent, onError, onResult, repeat, request]);
}
