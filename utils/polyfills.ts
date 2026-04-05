/**
 * Polyfills for Hermes JS engine (React Native Android).
 *
 * Hermes (especially older versions bundled with certain React Native releases)
 * does not ship `Promise.allSettled`.  This file must be imported at the very
 * top of the app entry point (_layout.tsx) so the polyfill is available before
 * any other module that relies on it.
 */

if (typeof Promise.allSettled !== "function") {
  Promise.allSettled = function allSettled<T extends readonly unknown[] | []>(
    promises: T
  ): Promise<{
    -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>>;
  }> {
    return Promise.all(
      Array.from(promises).map((promise) =>
        Promise.resolve(promise).then(
          (value) =>
            ({ status: "fulfilled" as const, value }) as PromiseFulfilledResult<typeof value>,
          (reason) =>
            ({ status: "rejected" as const, reason }) as PromiseRejectedResult
        )
      )
    ) as any;
  };
}
