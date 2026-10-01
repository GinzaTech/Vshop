import React from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { BlurTargetView, BlurView } from "expo-blur";
import { CachedImage } from "~/components/CachedImage";
import LiquidGlassBackdrop from "~/components/ui/LiquidGlassBackdrop";

jest.mock("expo-blur", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");
  return { BlurView: "BlurView", BlurTargetView: React.forwardRef<View, React.ComponentProps<typeof View>>(function MockBlurTarget(props, ref) { return <View {...props} ref={ref} />; }) };
});
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));

const renderers: TestRenderer.ReactTestRenderer[] = [];
const originalPlatform = Platform.OS;
const originalVersion = Platform.Version;
const events = new Map<string, (value: boolean) => void>();
const removals: jest.Mock[] = [];
beforeEach(() => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  Object.defineProperty(Platform, "Version", { configurable: true, value: 36 });
  jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  // This test exercises only boolean preferences, not the announcement overload.
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((name: string, callback: (value: boolean) => void) => {
    events.set(name, callback);
    const remove = jest.fn();
    removals.push(remove);
    return { remove };
  }) as unknown as typeof AccessibilityInfo.addEventListener);
});
afterEach(() => {
  act(() => renderers.splice(0).forEach((renderer) => renderer.unmount()));
  jest.restoreAllMocks(); events.clear(); removals.length = 0;
  Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
  Object.defineProperty(Platform, "Version", { configurable: true, value: originalVersion });
});
async function mount(count = 1) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<View>{Array.from({ length: count }, (_, index) =>
      <LiquidGlassBackdrop key={index} artworkUri={`https://example.com/${index}.png`} cacheId={`skin:${index}:display`} radius={8} />)}</View>,
    { createNodeMock: () => ({ nativeTarget: true }) });
  });
  renderers.push(renderer);
  return renderer;
}
function blurNodes(root: TestRenderer.ReactTestInstance) { return root.findAllByType(BlurView); }
function ready(root: TestRenderer.ReactTestInstance) {
  act(() => {
    root.findAllByType(BlurTargetView).forEach((target) => target.props.onLayout({ nativeEvent: { layout: { width: 150, height: 200 } } }));
    root.findAllByType(CachedImage).forEach((image) => image.props.onLoad());
  });
}

it("renders artwork before native blur, waits for actual target/image readiness, and keeps the layer decorative", async () => {
  const { root } = await mount();
  expect(blurNodes(root)).toHaveLength(0);
  ready(root);
  const blur = blurNodes(root)[0];
  expect(blur.props).toMatchObject({ intensity: 45, tint: "light", blurMethod: "dimezisBlurViewSdk31Plus" });
  expect(blur.props.blurTarget.current).not.toBeNull();
  expect(StyleSheet.flatten(root.findByType(BlurTargetView).props.style)).toEqual(StyleSheet.absoluteFill);
  expect(blur.props.experimentalBlurMethod).toBeUndefined();
  const image = root.findByType(CachedImage);
  expect(image.props).toMatchObject({ cacheId: "skin:0:display", source: { uri: "https://example.com/0.png" }, transition: 0, contentFit: "cover" });
  const layer = root.findByType(LiquidGlassBackdrop).findAllByType(View)[0];
  expect(layer.props).toMatchObject({ pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
  expect(StyleSheet.flatten(layer.props.style)).toMatchObject({ position: "absolute", borderRadius: 8, overflow: "hidden" });
  expect(root.findAll((node) => node.type === BlurTargetView || node.type === BlurView).map((node) => node.type)).toEqual([BlurTargetView, BlurView]);
});

it("caps native blur at six and releases a slot when a ready card unmounts", async () => {
  const first = await mount(6);
  ready(first.root);
  const waiting = await mount();
  ready(waiting.root);
  expect(blurNodes(first.root)).toHaveLength(6);
  expect(blurNodes(waiting.root)).toHaveLength(0);
  act(() => first.unmount());
  expect(blurNodes(waiting.root)).toHaveLength(1);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(2);
});

it.each(["reduceTransparencyChanged", "reduceMotionChanged"])("%s immediately removes blur and backdrop art", async (event) => {
  const { root } = await mount(); ready(root);
  expect(blurNodes(root)).toHaveLength(1);
  act(() => events.get(event)?.(true));
  expect(blurNodes(root)).toHaveLength(0);
  expect(root.findAllByType(CachedImage)).toHaveLength(0);
  act(() => events.get(event)?.(false));
  ready(root);
  expect(blurNodes(root)).toHaveLength(1);
});

it.each([["web", 36], ["android", 30]] as const)("uses static fallback on %s / SDK %s", async (os, version) => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: os });
  Object.defineProperty(Platform, "Version", { configurable: true, value: version });
  const { root } = await mount();
  expect(root.findAllByType(BlurTargetView)).toHaveLength(0);
  expect(blurNodes(root)).toHaveLength(0);
  expect(AccessibilityInfo.addEventListener).not.toHaveBeenCalled();
});

it("an image error keeps fallback and cleans OS subscriptions on last unmount", async () => {
  const renderer = await mount();
  act(() => renderer.root.findByType(CachedImage).props.onError());
  ready(renderer.root);
  expect(blurNodes(renderer.root)).toHaveLength(0);
  act(() => renderer.unmount());
  removals.forEach((remove) => expect(remove).toHaveBeenCalledTimes(1));
});

it("stays opaque when preferences are unknown or the OS query rejects", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockRejectedValue(new Error("Unavailable"));
  const { root } = await mount();
  expect(blurNodes(root)).toHaveLength(0);
  expect(root.findAllByType(CachedImage)).toHaveLength(0);
});

it("does not overwrite a newer transparency event with an older initial query", async () => {
  let resolveTransparency!: (value: boolean) => void;
  jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockReturnValue(new Promise<boolean>((resolve) => { resolveTransparency = resolve; }));
  const { root } = await mount();
  act(() => events.get("reduceTransparencyChanged")?.(true));
  await act(async () => { resolveTransparency(false); });
  expect(root.findAllByType(CachedImage)).toHaveLength(0);
  act(() => events.get("reduceTransparencyChanged")?.(false));
  ready(root);
  expect(blurNodes(root)).toHaveLength(1);
});

it("resets blur readiness when artwork changes and ignores the old image callback", async () => {
  const renderer = await mount(); ready(renderer.root);
  const staleLoad = renderer.root.findByType(CachedImage).props.onLoad;
  await act(async () => renderer.update(<View><LiquidGlassBackdrop key={0} artworkUri="https://example.com/new.png" cacheId="skin:new:display" /></View>));
  expect(blurNodes(renderer.root)).toHaveLength(0);
  act(() => staleLoad());
  expect(blurNodes(renderer.root)).toHaveLength(0);
  ready(renderer.root);
  expect(blurNodes(renderer.root)).toHaveLength(1);
  expect(renderer.root.findByType(CachedImage).props.source).toEqual({ uri: "https://example.com/new.png" });
});
