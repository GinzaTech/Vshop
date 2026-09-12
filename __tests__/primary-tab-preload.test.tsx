import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { usePrimaryTabPreload, type TabTransitionNavigation } from "~/hooks/usePrimaryTabPreload";
jest.mock("~/constants/Motion", () => ({ MOTION_DURATION: { standard: 220 } }));

const routes = [{ key: "a", name: "a" }, { key: "b", name: "b" }, { key: "c", name: "c" }];
describe("transition-aware tab preload", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup() {
    const listeners = new Map<string, Set<(event: { target?: string }) => void>>();
    const descriptors = Object.fromEntries(routes.map(({ key }) => [key, {
      navigation: { addListener: (type, listener) => {
        const name = `${key}:${type}`;
        const bucket = listeners.get(name) ?? new Set();
        bucket.add(listener);
        listeners.set(name, bucket);
        return () => { bucket.delete(listener); };
      } } satisfies TabTransitionNavigation,
    }]));
    let pause!: (key: string) => void;
    const preload = jest.fn();
    function Harness({ activeKey, enabled = true }: { activeKey: string; enabled?: boolean }) {
      pause = usePrimaryTabPreload({ routes, activeKey, enabled,
        preload: (name) => preload(name), descriptors: { ...descriptors } });
      return null;
    }
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<Harness activeKey="a" />); });
    const emit = (key: string, type: string) => act(() => {
      listeners.get(`${key}:${type}`)?.forEach((listener) => listener({ target: key }));
    });
    return { preload, listeners, renderer, emit,
      pause: (key: string) => act(() => pause(key)),
      update: (activeKey: string, enabled = true) => act(() => {
        renderer.update(<Harness activeKey={activeKey} enabled={enabled} />);
      }),
    };
  }

  it("cancels queued mounts on press, ignores an older end, then resumes after idle", () => {
    const h = setup();
    h.pause("b");
    h.update("b");
    h.emit("b", "transitionStart");
    h.pause("c");
    h.update("c");
    h.emit("c", "transitionStart");
    h.emit("b", "transitionEnd");
    act(() => jest.advanceTimersByTime(1000));
    expect(h.preload).not.toHaveBeenCalled();
    h.emit("c", "transitionEnd");
    act(() => jest.runAllTimers());
    // Both destinations were already visited; no redundant mounts.
    expect(h.preload).not.toHaveBeenCalled();
    act(() => h.renderer.unmount());
    expect([...h.listeners.values()].every((bucket) => bucket.size === 0)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("preloads one remaining scene after transitionEnd without restarting on identity changes", () => {
    const h = setup();
    act(() => jest.advanceTimersByTime(150));
    h.update("a");
    act(() => jest.advanceTimersByTime(100));
    expect(h.preload.mock.calls).toEqual([["b"]]);
    h.pause("b");
    h.update("b");
    h.emit("b", "transitionStart");
    act(() => jest.advanceTimersByTime(1000));
    expect(h.preload).toHaveBeenCalledTimes(1);
    h.emit("b", "transitionEnd");
    act(() => jest.advanceTimersByTime(239));
    expect(h.preload).toHaveBeenCalledTimes(1);
    act(() => jest.runAllTimers());
    expect(h.preload.mock.calls).toEqual([["b"], ["c"]]);
    act(() => h.renderer.unmount());
  });

  it("cancels idle work when hidden or unmounted", () => {
    const h = setup();
    h.update("a", false);
    act(() => jest.runAllTimers());
    expect(h.preload).not.toHaveBeenCalled();
    h.update("a");
    act(() => h.renderer.unmount());
    act(() => jest.runAllTimers());
    expect(h.preload).not.toHaveBeenCalled();
  });

  it("recovers when batched A->B->A produces no transition events", () => {
    const h = setup();
    h.pause("b");
    h.pause("a");
    act(() => jest.runAllTimers());
    expect(h.preload.mock.calls).toEqual([["b"], ["c"]]);
    act(() => h.renderer.unmount());
  });
});
