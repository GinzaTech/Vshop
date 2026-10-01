import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { useCombatPoll } from "~/features/combat/useCombatPoll";
import { useCombatSessionPolling } from "~/features/combat/useCombatSessionPolling";
import { useRiotScreenSession } from "~/hooks/useRiotScreenSession";
import { invalidateSessionOperations } from "~/utils/session-operations";

let mockUser = { id: "self", region: "ap", accessToken: "test-access", entitlementsToken: "test-ent" };
let mockActive = true;
const mockFetchSession = jest.fn();
const isActiveNow = () => mockActive;
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockUser }) } }));
jest.mock("~/hooks/useCombatStore", () => ({ useCombatStore: <T,>(select: (state: { fetchSession: typeof mockFetchSession }) => T) => select({ fetchSession: mockFetchSession }) }));

jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ message: "redacted" }) }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function Probe(props: Parameters<typeof useCombatPoll<string>>[0]) {
  useCombatPoll(props);
  return <Text>Mounted</Text>;
}

describe("combat poll scheduling", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  beforeEach(() => { renderer = undefined; jest.useFakeTimers(); });
  afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
  const render = async (props: React.ComponentProps<typeof Probe>) => {
    await act(async () => {
      if (renderer) renderer.update(<Probe {...props} />);
      else renderer = TestRenderer.create(<Probe {...props} />);
    });
  };

  it("waits for an obsolete one-shot fetch to finish before resuming with fresh data", async () => {
    const pending = deferred<string>();
    const request = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue("new");
    const onResult = jest.fn();
    const isCurrent = () => true;
    const props = { enabled: true, repeat: false, request, onResult, isCurrent };
    await render(props);
    await render({ ...props, enabled: false });
    await render(props);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve("old"); });
    expect(request).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith("new");
    await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("stops a scheduled tick as soon as the live account/focus guard turns false", async () => {
    let current = true;
    const isCurrent = () => current;
    const request = jest.fn().mockResolvedValue("done");
    await render({ enabled: true, repeat: true, request, isCurrent });
    current = false;
    await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not publish or log a request that fails after blur", async () => {
    const pending = deferred<string>();
    const request = jest.fn().mockReturnValue(pending.promise);
    const onResult = jest.fn();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const props = { enabled: true, repeat: true, request, onResult, isCurrent: () => true };
    await render(props);
    await render({ ...props, enabled: false });
    await act(async () => { pending.reject(new Error("late")); });
    expect(onResult).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("continues polling after a handled failure without an error callback", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = jest.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValue("recovered");
    const onResult = jest.fn();
    await render({ enabled: true, repeat: true, request, onResult, isCurrent: () => true });
    await act(async () => { await jest.advanceTimersByTimeAsync(10_000); });
    expect(onResult).toHaveBeenCalledWith("recovered");
  });

  it("retains the default 10000ms interval", async () => {
    const request = jest.fn().mockResolvedValue("done");
    await render({ enabled: true, repeat: true, request, isCurrent: () => true });
    await act(async () => { await jest.advanceTimersByTimeAsync(9999); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("uses 3000ms after settlement without overlapping slow requests", async () => {
    const pending = deferred<string>();
    const request = jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValue("new");
    await render({ enabled: true, repeat: true, intervalMs: 3000, request, isCurrent: () => true });
    await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve("done"); });
    await act(async () => { await jest.advanceTimersByTimeAsync(2999); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("cancels a 3000ms tick on background/disable and unmount", async () => {
    const request = jest.fn().mockResolvedValue("done");
    const props = { enabled: true, repeat: true, intervalMs: 3000, request, isCurrent: () => true };
    await render(props);
    await render({ ...props, enabled: false });
    await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
    expect(request).toHaveBeenCalledTimes(1);
    await render(props);
    act(() => renderer?.unmount());
    await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
    expect(request).toHaveBeenCalledTimes(2);
  });
});

let refreshSession: () => Promise<unknown>;
function SessionProbe({ phase }: { phase: "idle" | "pregame" | "live" }) {
  const session = useRiotScreenSession(mockUser);
  const refresh = useCombatSessionPolling(session, phase !== "idle", { isActive: mockActive, isActiveNow });
  React.useEffect(() => { refreshSession = refresh; });
  return null;
}

describe("tracker session polling", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const render = async (phase: React.ComponentProps<typeof SessionProbe>["phase"] = "pregame") => { await act(async () => {
    if (renderer) renderer.update(<SessionProbe phase={phase} />);
    else renderer = TestRenderer.create(<SessionProbe phase={phase} />);
  }); };
  const advance = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
  beforeEach(() => {
    renderer = undefined; jest.useFakeTimers(); mockActive = true;
    mockUser = { id: "self", region: "ap", accessToken: "test-access", entitlementsToken: "test-ent" };
    mockFetchSession.mockReset().mockResolvedValue({ state: "pregame" });
  });
  afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); });
  it.each(["pregame", "live"] as const)("repeats %s every 3000ms", async (phase) => {
    await render(phase); await advance(2999); expect(mockFetchSession).toHaveBeenCalledTimes(1);
    await advance(1); expect(mockFetchSession).toHaveBeenCalledTimes(2);
  });
  it("keeps idle one-shot and rejects missing credentials", async () => {
    await render("idle"); await advance(30_000); expect(mockFetchSession).toHaveBeenCalledTimes(1);
    mockUser = { ...mockUser, accessToken: "" }; await render();
    await act(async () => { await refreshSession(); }); expect(mockFetchSession).toHaveBeenCalledTimes(1);
  });
  it("shares manual refresh, waits for obsolete waves after background/refocus and cleans timers", async () => {
    const pending = deferred<string>(); mockFetchSession.mockReturnValueOnce(pending.promise);
    await render(); const oldRefresh = refreshSession;
    await advance(30_000); expect(mockFetchSession).toHaveBeenCalledTimes(1);
    let manual!: Promise<unknown>; act(() => { manual = refreshSession(); });
    expect(mockFetchSession).toHaveBeenCalledTimes(1);
    mockActive = false; await render(); await act(async () => { await oldRefresh(); });
    await advance(30_000); expect(mockFetchSession).toHaveBeenCalledTimes(1);
    mockActive = true; await render(); expect(mockFetchSession).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve("obsolete"); await manual; });
    await advance(3000); expect(mockFetchSession).toHaveBeenCalledTimes(2);
    act(() => renderer?.unmount()); await advance(30_000); expect(mockFetchSession).toHaveBeenCalledTimes(2);
  });
  it("does not start a tick after account/token/generation invalidation before render", async () => {
    await render(); const retained = refreshSession;
    invalidateSessionOperations(); await advance(3000);
    await act(async () => { await retained(); }); expect(mockFetchSession).toHaveBeenCalledTimes(1);
    mockUser = { ...mockUser, accessToken: "renewed" }; await render();
    expect(mockFetchSession).toHaveBeenCalledTimes(2);
    mockUser = { ...mockUser, id: "other" }; await advance(3000);
    expect(mockFetchSession).toHaveBeenCalledTimes(2);
  });
});
