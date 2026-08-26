import * as Sentry from "@sentry/react";

const startupStartedAt = globalThis.performance?.now?.() ?? Date.now();
let interactiveMarked = false;

/** Record the first usable route once; route names contain no account data. */
export const markAppInteractive = (route: string): void => {
  if (interactiveMarked) return;
  interactiveMarked = true;

  const now = globalThis.performance?.now?.() ?? Date.now();
  const durationMs = Math.max(0, now - startupStartedAt);
  globalThis.performance?.mark?.("vshop.app_interactive");

  if (Sentry.isEnabled()) {
    Sentry.metrics.distribution("app.start_to_interactive", durationMs, {
      unit: "millisecond",
      attributes: { route },
    });
  }
};
