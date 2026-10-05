import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { BlurView } from "expo-blur";
import { NavigationBarBackdrop } from "~/features/navigation/NavigationBarBackdrop";
import { NAV_GLASS_MATERIAL } from "~/constants/DesignSystem";

jest.mock("expo-blur", () => ({ BlurView: "BlurView" }));

const osDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
const versionDescriptor = Object.getOwnPropertyDescriptor(Platform, "Version")!;
let mockReduceTransparency = false;
jest.mock("~/components/ui/liquid-glass-native-policy", () => ({
  useNativeGlassPreferences: () => ({ reduceTransparency: mockReduceTransparency, reduceMotion: false }),
}));
describe("static navigation backdrop blur", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  beforeEach(() => {
    mockReduceTransparency = false;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
    Object.defineProperty(Platform, "Version", { configurable: true, value: 36 });
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", osDescriptor);
    Object.defineProperty(Platform, "Version", versionDescriptor);
  });
  it("renders one static blur first, then its readable veil and rim, using a committed target", () => {
    jest.replaceProperty(NAV_GLASS_MATERIAL as { opaque: boolean }, "opaque", false);
    const target = { current: {} as View };
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={target} />); });
    const backdrop = renderer.root.findByType(NavigationBarBackdrop);
    const blur = renderer.root.findByType(BlurView);
    expect(backdrop.children[0]).toBe(blur);
    expect(blur.props).toMatchObject({ blurTarget: target, blurMethod: "dimezisBlurViewSdk31Plus", intensity: 18, tint: "systemUltraThinMaterialLight", pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    expect(blur.props.experimentalBlurMethod).toBeUndefined();
    expect(StyleSheet.flatten(blur.props.style)).toEqual(StyleSheet.absoluteFill);
    const veil = renderer.root.findByProps({ testID: "primary-tab-glass-veil" });
    expect(StyleSheet.flatten(veil.props.style).backgroundColor).toBe(NAV_GLASS_MATERIAL.veil);
    expect(Number(NAV_GLASS_MATERIAL.veil.match(/([\d.]+)\)$/)?.[1])).toBeLessThanOrEqual(0.4);
    expect(Number(NAV_GLASS_MATERIAL.nativeLensTint.match(/([\d.]+)\)$/)?.[1])).toBeLessThanOrEqual(0.6);
    expect(veil.props.accessibilityElementsHidden).toBe(true);
    act(() => renderer.update(<NavigationBarBackdrop blurTarget={target} />));
    expect(renderer.root.findByType(BlurView)).toBe(blur);
    expect(blur.props.intensity).toBe(18);
  });
  it("restores a white translucent glass veil with one light blur instead of disabling glass", () => {
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={{ current: {} as View }} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(1);
    expect(renderer.root.findByType(BlurView).props.tint).toBe("systemUltraThinMaterialLight");
    expect(NAV_GLASS_MATERIAL.opaque).toBe(false);
    expect(NAV_GLASS_MATERIAL.veil).toMatch(/^rgba\(255,\s*255,\s*255,/);
    expect(Number(NAV_GLASS_MATERIAL.veil.match(/([\d.]+)\)$/)?.[1])).toBeLessThanOrEqual(0.4);
    expect(NAV_GLASS_MATERIAL.fallback).toBe("#ffffff");
    const veil = renderer.root.findByProps({ testID: "primary-tab-glass-veil" });
    expect(StyleSheet.flatten(veil.props.style).backgroundColor).toBe(NAV_GLASS_MATERIAL.veil);
    expect(veil.props.pointerEvents).toBe("none");
    expect(veil.props.accessibilityElementsHidden).toBe(true);
  });
  it("falls back to opaque white when Reduce Transparency is enabled", () => {
    jest.replaceProperty(NAV_GLASS_MATERIAL as { opaque: boolean }, "opaque", false);
    mockReduceTransparency = true;
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={{ current: {} as View }} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(0);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-glass-veil" }).props.style).backgroundColor).toBe(NAV_GLASS_MATERIAL.fallback);
  });
  it("retires and restores light blur on live transparency preference changes", () => {
    const target = { current: {} as View };
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={target} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(1);
    mockReduceTransparency = true;
    act(() => renderer.update(<NavigationBarBackdrop blurTarget={target} />));
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(0);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-glass-veil" }).props.style).backgroundColor).toBe(NAV_GLASS_MATERIAL.fallback);
    mockReduceTransparency = false;
    act(() => renderer.update(<NavigationBarBackdrop blurTarget={target} />));
    expect(renderer.root.findByType(BlurView).props.blurTarget).toBe(target);
  });
  it("does not sample the page while the bar is hidden or collapsed", () => {
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={{ current: {} as View }} enabled={false} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(0);
  });
  it.each([undefined, { current: null }])("uses opaque material until a real target exists (%s)", (target) => {
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={target} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(0);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-glass-veil" }).props.style).backgroundColor).toBe(NAV_GLASS_MATERIAL.fallback);
  });
  it.each([["android", 30], ["web", 36], ["windows", 36]] as const)("falls back without native blur on %s / %s", (os, version) => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: os });
    Object.defineProperty(Platform, "Version", { configurable: true, value: version });
    act(() => { renderer = TestRenderer.create(<NavigationBarBackdrop blurTarget={{ current: {} as View }} />); });
    expect(renderer.root.findAllByType(BlurView)).toHaveLength(0);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-glass-veil" }).props.style).backgroundColor).toBe(NAV_GLASS_MATERIAL.fallback);
  });
});
