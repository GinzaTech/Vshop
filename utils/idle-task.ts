export type IdleTask = {
  cancel: () => void;
};

/** Yield between mounts so a preload wave cannot monopolize one JS turn. */
export function runIdleSequence(tasks: readonly (() => void)[], delayMs = 240): IdleTask {
  let cancelled = false;
  let index = 0;
  let idleTask: IdleTask | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (cancelled || index >= tasks.length) return;
    timer = setTimeout(() => {
      idleTask = runWhenIdle(() => {
        if (cancelled) return;
        tasks[index++]();
        schedule();
      });
    }, delayMs);
  };
  schedule();
  return { cancel() {
    cancelled = true;
    clearTimeout(timer);
    idleTask?.cancel();
  } };
}

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
