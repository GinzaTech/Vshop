import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("useAsyncRefresh lifecycle", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let result: ReturnType<typeof useAsyncRefresh>;
  let warn: jest.SpyInstance;
  function Probe({ refresh, session }: { refresh: () => Promise<unknown>; session?: string }) {
    result = useAsyncRefresh(refresh, session);
    return <Text>{String(result.refreshing)}</Text>;
  }
  const mount = async (refresh: () => Promise<unknown>) => {
    await act(async () => { renderer = TestRenderer.create(<Probe refresh={refresh} />); });
  };

  beforeEach(() => { warn = jest.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; warn.mockRestore(); });

  it("deduplicates pulls and resets after completion", async () => {
    const pending = deferred();
    const refresh = jest.fn(() => pending.promise);
    await mount(refresh);
    let task!: Promise<void>;
    act(() => { task = result.onRefresh(); void result.onRefresh(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result!.refreshing).toBe(true);
    await act(async () => { pending.resolve(); await task; });
    expect(result!.refreshing).toBe(false);
    await act(async () => { await result.onRefresh(); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not treat a new callback identity as an unmount", async () => {
    const pending = deferred();
    await mount(() => pending.promise);
    let task!: Promise<void>;
    act(() => { task = result.onRefresh(); });
    const nextRefresh = jest.fn(async () => {});
    await act(async () => { renderer!.update(<Probe refresh={nextRefresh} />); });
    await act(async () => { await result.onRefresh(); });
    expect(nextRefresh).not.toHaveBeenCalled();
    expect(result!.refreshing).toBe(true);
    await act(async () => { pending.resolve(); await task; });
    await act(async () => { await result.onRefresh(); });
    expect(nextRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not invoke a retained handler after unmount", async () => {
    const refresh = jest.fn(async () => {});
    await mount(refresh);
    const retained = result!.onRefresh;
    act(() => { renderer!.unmount(); });
    await retained();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("releases the old session's refresh and ignores its completion during a newer refresh", async () => {
    const old = deferred();
    const current = deferred();
    const refresh = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await mount(refresh);
    let oldTask!: Promise<void>;
    let currentTask!: Promise<void>;
    const retained = result!.onRefresh;
    act(() => { oldTask = result.onRefresh(); });
    await act(async () => { renderer!.update(<Probe refresh={refresh} session="b" />); });
    expect(result!.refreshing).toBe(false);
    await act(async () => { await retained(); });
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => { currentTask = result.onRefresh(); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { old.resolve(); await oldTask; });
    expect(result!.refreshing).toBe(true);
    await act(async () => { current.resolve(); await currentTask; });
    expect(result!.refreshing).toBe(false);
  });

  it("ignores a rejected refresh after unmount", async () => {
    const pending = deferred();
    await mount(() => pending.promise);
    let task!: Promise<void>;
    act(() => { task = result.onRefresh(); });
    act(() => { renderer!.unmount(); });
    pending.reject(new Error("old request"));
    await task;
    expect(warn).not.toHaveBeenCalled();
  });

  it("redacts refresh errors and allows another pull after failure", async () => {
    const failure = { message: "Network error", config: { headers: { Authorization: "Bearer test-private-token" } } };
    const refresh = jest.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(undefined);
    await mount(refresh);
    await act(async () => { await result.onRefresh(); });
    expect(result!.refreshing).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("test-private-token");
    await act(async () => { await result.onRefresh(); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
