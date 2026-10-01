import React from "react";
import { AppState, Platform, StyleSheet, View, type AppStateStatus } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { GLASS_MATERIAL, GLASS_TAB_BAR } from "~/constants/DesignSystem";
// Android entry is intentional: the default Jest platform is iOS.
import { RefractionLens, RefractionTarget } from "~/features/navigation/NativeRefraction.android";
import { RefractionLens as FallbackLens, RefractionTarget as FallbackTarget } from "~/features/navigation/NativeRefraction";

let mockApiVersion: number | undefined = 1;
let mockPreferences = { reduceTransparency: false, reduceMotion: false };
jest.mock("~/components/ui/liquid-glass-native-policy", () => ({
  useNativeGlassPreferences: () => mockPreferences,
}));
jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => mockApiVersion == null ? null : { apiVersion: mockApiVersion },
  requireNativeViewManager: jest.fn((_module: string, name: string) => name),
}));

describe("optional native backdrop bridge", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const os = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  const version = Object.getOwnPropertyDescriptor(Platform, "Version")!;
  let onAppState: (state: AppStateStatus) => void;
  const remove = jest.fn();
  beforeEach(() => {
    mockApiVersion = 1;
    mockPreferences = { reduceTransparency: false, reduceMotion: false };
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    Object.defineProperty(Platform, "Version", { configurable: true, value: 35 });
    AppState.currentState = "active";
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      onAppState = listener;
      return { remove };
    });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", os);
    Object.defineProperty(Platform, "Version", version);
  });
  it("passes real page target and approved material without touching hit testing", () => {
    act(() => { renderer = TestRenderer.create(<RefractionLens targetTag={17} enabled />); });
    const lens = renderer.root.findByProps({ testID: "navigation-native-refraction" });
    expect(lens.props).toMatchObject({ targetTag: 17, enabled: true, tint: GLASS_MATERIAL.lensFallback,
      magnification: GLASS_TAB_BAR.magnify, pointerEvents: "none", accessible: false,
      importantForAccessibility: "no-hide-descendants" });
    expect(StyleSheet.flatten(lens.props.style)).toEqual(StyleSheet.absoluteFill);
    act(() => onAppState("background"));
    expect(renderer.toJSON()).toBeNull();
    act(() => onAppState("active"));
    expect(renderer.root.findByProps({ testID: "navigation-native-refraction" })).toBeDefined();
    act(() => renderer.unmount());
    expect(remove).toHaveBeenCalled();
  });
  it.each([null, -1, 0, NaN, 0.5])("does not construct a renderer for missing/invalid target %s", (targetTag) => {
    act(() => { renderer = TestRenderer.create(<RefractionLens targetTag={targetTag} enabled />); });
    expect(renderer.toJSON()).toBeNull();
  });
  it("drops old target immediately and respects hidden/reduced state", () => {
    act(() => { renderer = TestRenderer.create(<RefractionLens targetTag={17} enabled />); });
    act(() => renderer.update(<RefractionLens targetTag={23} enabled />));
    expect(renderer.root.findByProps({ testID: "navigation-native-refraction" }).props.targetTag).toBe(23);
    act(() => renderer.update(<RefractionLens targetTag={23} enabled={false} />));
    expect(renderer.toJSON()).toBeNull();
  });
  it.each([undefined, 2])("old or incompatible binary (%s) preserves pages and fallback", (api) => {
    mockApiVersion = api;
    const ready = jest.fn();
    act(() => { renderer = TestRenderer.create(<><RefractionTarget enabled onTargetReady={ready}><View testID="page" /></RefractionTarget><RefractionLens targetTag={17} enabled /></>); });
    expect(renderer.root.findAllByProps({ testID: "page" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: "navigation-native-refraction" })).toHaveLength(0);
  });
  it("reduce transparency keeps the fallback tint and skips capture/refraction", () => {
    mockPreferences = { reduceTransparency: true, reduceMotion: false };
    const ready = jest.fn();
    act(() => { renderer = TestRenderer.create(<><RefractionTarget enabled onTargetReady={ready}><View testID="page" /></RefractionTarget><RefractionLens targetTag={17} enabled /></>); });
    expect(renderer.root.findByProps({ testID: "navigation-refraction-target" }).props.enabled).toBe(false);
    expect(renderer.root.findAllByProps({ testID: "navigation-native-refraction" })).toHaveLength(0);
    mockPreferences = { reduceTransparency: false, reduceMotion: false };
    act(() => renderer.update(<RefractionLens targetTag={17} enabled />));
    expect(renderer.root.findByProps({ testID: "navigation-native-refraction" })).toBeDefined();
  });
  it("publishes only valid target tags and disables capture while backgrounded", () => {
    const ready = jest.fn();
    act(() => { renderer = TestRenderer.create(<RefractionTarget enabled onTargetReady={ready}><View /></RefractionTarget>); });
    const target = renderer.root.findByProps({ testID: "navigation-refraction-target" });
    act(() => target.props.onReady({ nativeEvent: { targetTag: -1 } }));
    expect(ready).not.toHaveBeenCalled();
    act(() => target.props.onReady({ nativeEvent: { targetTag: 17 } }));
    expect(ready).toHaveBeenLastCalledWith(17);
    act(() => onAppState("background"));
    expect(target.props.enabled).toBe(false);
  });
  it("web/iOS boundary keeps the page and never loads a shader", () => {
    act(() => { renderer = TestRenderer.create(<><FallbackTarget enabled onTargetReady={jest.fn()}><View testID="fallback-page" /></FallbackTarget><FallbackLens targetTag={17} enabled /></>); });
    expect(renderer.root.findAllByProps({ testID: "fallback-page" }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: "navigation-native-refraction" })).toHaveLength(0);
  });
});
