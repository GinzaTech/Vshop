import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { useCombatPoll } from "~/features/combat/useCombatPoll";

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
});
