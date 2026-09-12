import { runIdleSequence } from "~/utils/idle-task";

describe("idle preload sequence", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("yields between heavy mounts instead of mounting every tab in one turn", () => {
    const calls: number[] = [];
    const sequence = runIdleSequence([() => calls.push(1), () => calls.push(2)]);
    expect(calls).toEqual([]);
    jest.advanceTimersByTime(241);
    expect(calls).toEqual([1]);
    jest.advanceTimersByTime(241);
    expect(calls).toEqual([1, 2]);
    sequence.cancel();
  });

  it("cancels the remaining mounts when navigating away", () => {
    const mount = jest.fn();
    const sequence = runIdleSequence([mount, mount, mount]);
    jest.advanceTimersByTime(241);
    sequence.cancel();
    jest.runAllTimers();
    expect(mount).toHaveBeenCalledTimes(1);
  });

  it("cancels before the first mount and handles an empty queue", () => {
    const mount = jest.fn();
    runIdleSequence([mount]).cancel();
    runIdleSequence([]).cancel();
    jest.runAllTimers();
    expect(mount).not.toHaveBeenCalled();
  });
});
