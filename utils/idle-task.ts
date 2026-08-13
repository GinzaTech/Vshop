export type IdleTask = {
  cancel: () => void;
};

/**
 * Run non-urgent JS work when the runtime is idle while keeping cancellation
 * semantics for screens that unmount before the callback executes.
 */
export function runWhenIdle(callback: () => void, timeoutMs = 1_000): IdleTask {
  let cancelled = false;

  if (typeof globalThis.requestIdleCallback === "function") {
    const idleCallbackId = globalThis.requestIdleCallback(
      () => {
        if (!cancelled) callback();
      },
      { timeout: timeoutMs }
    );

    return {
      cancel() {
        if (cancelled) return;
        cancelled = true;
        globalThis.cancelIdleCallback(idleCallbackId);
      },
    };
  }

  const timeoutId = setTimeout(() => {
    if (!cancelled) callback();
  }, 0);

  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeoutId);
    },
  };
}
