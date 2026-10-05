import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useNativeSplashHandoff } from "~/hooks/useNativeSplashHandoff";
import { MOTION_DURATION } from "~/constants/Motion";

const mockExpoHide = jest.fn();
const mockProbeSetup = jest.fn();
jest.mock("expo-splash-screen", () => ({ hideAsync: () => mockExpoHide() }));
jest.mock("~/constants/Motion", () => ({ MOTION_DURATION: { fast: 140 } }));

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
let controls: ReturnType<typeof useNativeSplashHandoff>;
let renderer: TestRenderer.ReactTestRenderer | undefined;
const devGlobal = globalThis as typeof globalThis & { __DEV__: boolean };
const originalDev = __DEV__;
function Probe({ hide, requestOnMount = false }: { hide?: () => Promise<void>; requestOnMount?: boolean }) {
  const value = useNativeSplashHandoff(hide);
  const { hideNativeSplash } = value;
  React.useLayoutEffect(() => { controls = value; }, [value]);
  React.useEffect(() => {
    mockProbeSetup();
    if (requestOnMount) hideNativeSplash();
  }, [requestOnMount, hideNativeSplash]);
  return null;
}
const mount = async (hide?: () => Promise<void>) => {
  await act(async () => { renderer = TestRenderer.create(React.createElement(Probe, { hide })); });
};
const request = async () => { await act(async () => { controls.hideNativeSplash(); }); };
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

beforeEach(() => {
  // Keep React's act microtask scheduler real; only hook retry timers are fake.
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  mockExpoHide.mockResolvedValue(undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = undefined;
  devGlobal.__DEV__ = originalDev;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("is unreleased before a request and uses the default Expo hide only on demand", async () => {
  await mount();
  expect(controls.nativeSplashReleased).toBe(false);
  expect(mockExpoHide).not.toHaveBeenCalled();
  await request();
  expect(mockExpoHide).toHaveBeenCalledTimes(1);
  expect(controls.nativeSplashReleased).toBe(true);
  await request();
  expect(mockExpoHide).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("deduplicates pending hide requests and exposes release only after success", async () => {
  const pending = deferred();
  const hide = jest.fn(() => pending.promise);
  await mount(hide);
  const callback = controls.hideNativeSplash;
  await request(); await request();
  expect(hide).toHaveBeenCalledTimes(1);
  expect(controls.nativeSplashReleased).toBe(false);
  await act(async () => { pending.resolve(); });
  expect(controls.nativeSplashReleased).toBe(true);
  expect(controls.hideNativeSplash).toBe(callback);
  await request();
  expect(hide).toHaveBeenCalledTimes(1);
});

it("retries without a second readiness event and deduplicates during retry delay", async () => {
  const hide = jest.fn().mockRejectedValueOnce(new Error("first failure")).mockResolvedValue(undefined);
  await mount(hide); await request();
  expect(controls.nativeSplashReleased).toBe(false);
  expect(jest.getTimerCount()).toBe(1);
  await request();
  await advance(MOTION_DURATION.fast - 1);
  expect(hide).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(hide).toHaveBeenCalledTimes(2);
  expect(controls.nativeSplashReleased).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it("stops after three attempts, leaves no infinite timer, and lets a later request restart the budget", async () => {
  const hide = jest.fn().mockRejectedValue(new Error("persistent failure"));
  await mount(hide); await request();
  await advance(MOTION_DURATION.fast); await advance(MOTION_DURATION.fast);
  expect(hide).toHaveBeenCalledTimes(3);
  expect(controls.nativeSplashReleased).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  await advance(10_000);
  expect(hide).toHaveBeenCalledTimes(3);
  hide.mockResolvedValueOnce(undefined);
  await request();
  expect(hide).toHaveBeenCalledTimes(4);
  expect(controls.nativeSplashReleased).toBe(true);
});

it("catches synchronous native failure and logs sanitized diagnostics only in DEV", async () => {
  devGlobal.__DEV__ = true;
  const hide = jest.fn(() => { throw new Error("secret=private-fixture"); });
  await mount(hide); await request();
  expect(console.warn).toHaveBeenCalledWith("[startup] Native splash handoff failed", { name: "Error", message: "Operation failed" });
  expect(JSON.stringify(jest.mocked(console.warn).mock.calls)).not.toContain("private-fixture");
  expect(controls.nativeSplashReleased).toBe(false);
  devGlobal.__DEV__ = false;
  jest.mocked(console.warn).mockClear();
  await advance(MOTION_DURATION.fast);
  expect(console.warn).not.toHaveBeenCalled();
});

it("cleans retry timers and ignores a retained request after unmount", async () => {
  const hide = jest.fn().mockRejectedValue(new Error("failure"));
  await mount(hide); await request();
  const retained = controls.hideNativeSplash;
  act(() => renderer!.unmount()); renderer = undefined;
  expect(jest.getTimerCount()).toBe(0);
  await act(async () => { retained(); jest.advanceTimersByTime(10_000); });
  expect(hide).toHaveBeenCalledTimes(1);
});

it.each(["resolve", "reject"] as const)("ignores late %s from a retired lifetime without affecting a new mount", async (result) => {
  const old = deferred();
  const hide = jest.fn().mockReturnValueOnce(old.promise).mockResolvedValue(undefined);
  await mount(hide); await request();
  act(() => renderer!.unmount()); renderer = undefined;
  await mount(hide);
  await act(async () => {
    if (result === "resolve") old.resolve(); else old.reject(new Error("retired failure"));
  });
  expect(controls.nativeSplashReleased).toBe(false);
  expect(console.warn).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  await request();
  expect(controls.nativeSplashReleased).toBe(true);
});

it("uses the latest injected hide on the next retry without losing the request", async () => {
  const first = jest.fn().mockRejectedValue(new Error("first"));
  const latest = jest.fn().mockResolvedValue(undefined);
  await mount(first); await request();
  await act(async () => { renderer!.update(React.createElement(Probe, { hide: latest })); });
  await advance(MOTION_DURATION.fast);
  expect(first).toHaveBeenCalledTimes(1);
  expect(latest).toHaveBeenCalledTimes(1);
  expect(controls.nativeSplashReleased).toBe(true);
});

it("preserves an automatic one-shot request through StrictMode effect replay", async () => {
  const pending = deferred();
  const hide = jest.fn(() => pending.promise);
  const options = { createNodeMock: () => null, unstable_strictMode: true };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.StrictMode, null,
      React.createElement(Probe, { hide, requestOnMount: true })), options);
  });
  expect(mockProbeSetup.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(hide).toHaveBeenCalledTimes(1);
  await act(async () => { pending.resolve(); });
  expect(controls.nativeSplashReleased).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

it("keeps the same three-attempt budget when an adopted StrictMode promise rejects", async () => {
  const pending = deferred();
  const hide = jest.fn().mockReturnValueOnce(pending.promise).mockRejectedValue(new Error("retry failure"));
  const options = { createNodeMock: () => null, unstable_strictMode: true };
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(React.StrictMode, null,
      React.createElement(Probe, { hide, requestOnMount: true })), options);
  });
  expect(mockProbeSetup.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(hide).toHaveBeenCalledTimes(1);
  await act(async () => { pending.reject(new Error("first failure")); });
  expect(jest.getTimerCount()).toBe(1);
  await advance(MOTION_DURATION.fast); await advance(MOTION_DURATION.fast);
  expect(hide).toHaveBeenCalledTimes(3);
  expect(controls.nativeSplashReleased).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});
