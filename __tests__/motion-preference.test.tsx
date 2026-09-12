import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { useMotionPreference } from "~/hooks/useMotionPreference";

jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));

function Probe() {
  const reduced = useMotionPreference();
  return <Text>{String(reduced)}</Text>;
}

it("applies live OS changes and ignores an older async snapshot", async () => {
  let listener: ((value: boolean) => void) | undefined;
  let resolveSnapshot!: (value: boolean) => void;
  const remove = jest.fn();
  const query = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(
    () => new Promise<boolean>((resolve) => { resolveSnapshot = resolve; }),
  );
  const subscribe = jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(
    ((_event: string, callback: (value: boolean) => void) => {
      listener = callback;
      return { remove };
    }) as unknown as typeof AccessibilityInfo.addEventListener,
  );
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<><Probe /><Probe /></>); });
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    act(() => listener?.(true));
    await act(async () => { resolveSnapshot(false); });
    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual(["true", "true"]);
    act(() => listener?.(false));
    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual(["false", "false"]);
    act(() => renderer.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  } finally {
    query.mockRestore();
    subscribe.mockRestore();
  }
});
