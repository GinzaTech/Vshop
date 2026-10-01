import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { BlurView } from "expo-blur";
import { NavigationBarBackdrop } from "~/features/navigation/NavigationBarBackdrop";
import { GLASS_MATERIAL } from "~/constants/DesignSystem";

jest.mock("expo-blur", () => ({ BlurView: "BlurView" }));

const osDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
const versionDescriptor = Object.getOwnPropertyDescriptor(Platform, "Version")!;
describe("static navigation backdrop blur", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    Object.defineProperty(Platform, "Version", { configurable: true, value: 36 });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    Object.defineProperty(Platform, "OS", osDescriptor);
    Object.defineProperty(Platform, "Version", versionDescriptor);
  });
  it("renders one static blur first, then its readable veil and rim, using a committed target", () => {
    const target = { current: {} as View };
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={target} />); });
    const backdrop = renderer.root.findByType(NavigationBarBackdrop);
    const blur = renderer.root.findByType(BlurView);
    expect(backdrop.children[0]).toBe(blur);
    expect(blur.props).toMatchObject({ blurTarget: target, blurMethod: "dimezisBlurViewSdk31Plus", intensity: 55, tint: "light", pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    expect(blur.props.experimentalBlurMethod).toBeUndefined();
    expect(StyleSheet.flatten(blur.props.style)).toEqual(StyleSheet.absoluteFill);
    const veil = renderer.root.findByProps({ testID: "primary-tab-glass-veil" });
    expect(StyleSheet.flatten(veil.props.style).backgroundColor).toBe(GLASS_MATERIAL.navVeil);
    expect(veil.props.accessibilityElementsHidden).toBe(true);
    act(() => renderer.update(<NavigationBarBackdrop blurTarget={target} />));
    expect(renderer.root.findByType(BlurView)).toBe(blur);
    expect(blur.props.intensity).toBe(55);
  });
  it.each([undefined, { current: null }])("uses opaque material until a real target exists (%s)", (target) => {
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={target} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(0);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-glass-veil" }).props.style).backgroundColor).toBe(GLASS_MATERIAL.fallback);
  });
  it.each([["android", 30], ["web", 36], ["windows", 36]] as const)("falls back without native blur on %s / %s", (os, version) => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: os });
    Object.defineProperty(Platform, "Version", { configurable: true, value: version });
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={{ current: {} as View }} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(0);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-glass-veil" }).props.style).backgroundColor).toBe(GLASS_MATERIAL.fallback);
  });
});
