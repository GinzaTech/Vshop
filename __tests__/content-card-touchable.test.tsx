import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ContentCardTouchable from "~/components/ui/ContentCardTouchable";

describe("content-only press feedback", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  afterEach(() => act(() => renderer?.unmount()));

  it("keeps media/content opaque and mounted while only the inset border changes", () => {
    const mounts = jest.fn();
    const unmounts = jest.fn();
    function Media() {
      React.useEffect(() => { mounts(); return () => unmounts(); }, []);
      return <View testID="sharp-media"><Text>Content</Text></View>;
    }
    act(() => { renderer = TestRenderer.create(<ContentCardTouchable style={{ width: 96, height: 100, borderRadius: 16 }}><Media /></ContentCardTouchable>); });
    const media = renderer.root.findByType(Media);
    const touch = renderer.root.findByType(TouchableOpacity);
    const frame = StyleSheet.flatten(touch.props.style);
    expect(touch.props.activeOpacity).toBe(1);
    expect(frame.opacity ?? 1).toBe(1);
    expect(frame.transform).toBeUndefined();
    expect(frame).toMatchObject({ width: 96, height: 100, borderRadius: 16 });
    const feedback = () => renderer.root.findByProps({ testID: "content-card-press-outline" });
    expect(StyleSheet.flatten(feedback().props.style).opacity).toBe(0);
    act(() => touch.props.onPressIn({}));
    expect(renderer.root.findByType(Media)).toBe(media);
    expect(StyleSheet.flatten(feedback().props.style).opacity).toBe(1);
    expect(feedback().props.pointerEvents).toBe("none");
    expect(feedback().props.accessible).toBe(false);
    act(() => touch.props.onPressOut({}));
    expect(StyleSheet.flatten(feedback().props.style).opacity).toBe(0);
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(unmounts).not.toHaveBeenCalled();
  });

  it("forwards native actions, long press, hit geometry and accessibility state", () => {
    const press = jest.fn(); const longPress = jest.fn(); const pressIn = jest.fn(); const pressOut = jest.fn();
    act(() => { renderer = TestRenderer.create(<ContentCardTouchable accessibilityRole="button" accessibilityLabel="Actual action"
      accessibilityState={{ selected: true, busy: true }} hitSlop={8} delayLongPress={500}
      onPress={press} onLongPress={longPress} onPressIn={pressIn} onPressOut={pressOut}><Text>Action</Text></ContentCardTouchable>); });
    const touch = renderer.root.findByType(TouchableOpacity);
    expect(touch.props).toMatchObject({ accessibilityRole: "button", accessibilityLabel: "Actual action", hitSlop: 8,
      delayLongPress: 500, accessibilityState: { selected: true, busy: true } });
    act(() => { touch.props.onPressIn({}); touch.props.onPress({}); touch.props.onLongPress({}); touch.props.onPressOut({}); });
    expect(press).toHaveBeenCalledTimes(1); expect(longPress).toHaveBeenCalledTimes(1);
    expect(pressIn).toHaveBeenCalledTimes(1); expect(pressOut).toHaveBeenCalledTimes(1);
  });

  it("does not invoke actions or illuminate the press outline when disabled", () => {
    const press = jest.fn(); const longPress = jest.fn();
    act(() => { renderer = TestRenderer.create(<ContentCardTouchable disabled onPress={press} onLongPress={longPress}><Text>Disabled</Text></ContentCardTouchable>); });
    const touch = renderer.root.findByType(TouchableOpacity);
    expect(touch.props.disabled).toBe(true);
    act(() => { touch.props.onPressIn({}); touch.props.onPress?.({}); touch.props.onLongPress?.({}); });
    expect(press).not.toHaveBeenCalled(); expect(longPress).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(0);
  });

  it("retires feedback across a busy-disable cycle without replaying a held press", () => {
    const view = (disabled: boolean) => <ContentCardTouchable disabled={disabled}><Text>Content</Text></ContentCardTouchable>;
    act(() => { renderer = TestRenderer.create(view(false)); });
    act(() => renderer.root.findByType(TouchableOpacity).props.onPressIn({}));
    act(() => renderer.update(view(true)));
    act(() => renderer.update(view(false)));
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(0);
  });

  it.each(["onPress", "onLongPress"] as const)("retires the held outline before %s even when native press-out is interrupted", (action) => {
    const result = Promise.resolve();
    const callback = jest.fn(() => result);
    act(() => { renderer = TestRenderer.create(<ContentCardTouchable {...{ [action]: callback }}><Text>Action</Text></ContentCardTouchable>); });
    const touch = renderer.root.findByType(TouchableOpacity);
    act(() => touch.props.onPressIn({}));
    let returned: unknown;
    act(() => { returned = touch.props[action]({}); });
    expect(returned).toBe(result);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(0);
  });
});
