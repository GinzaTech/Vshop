import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { LinearGradient, Stop } from "react-native-svg";
import type { SharedValue } from "react-native-reanimated";
import { GLASS_MATERIAL, GLASS_TAB_BAR } from "~/constants/DesignSystem";
import { getNavigationOptics } from "~/features/navigation/navigation-optics";
import { NavigationLensMaterial } from "~/features/navigation/NavigationLensMaterial";

jest.mock("react-native-reanimated", () => ({
  __esModule: true, default: { View: jest.requireActual("react-native").View },
  useAnimatedStyle: (factory: () => object) => factory(),
}));

describe("reference-preserving liquid lens optics", () => {
  it("preserves approved material opacity, geometry and magnification", () => {
    expect(GLASS_MATERIAL.surface).toBe("rgba(255, 255, 255, 0.88)");
    expect(GLASS_MATERIAL.lensFallback).toBe("rgba(235, 235, 235, 0.92)");
    expect(GLASS_TAB_BAR).toMatchObject({ height: 54, lensHeight: 50, magnify: 1.065, iconSize: 24, labelSize: 11 });
  });
  it.each([0, 1, -1, 2, NaN])("has no lingering motion optics at rest/invalid progress %s", (progress) => {
    expect(getNavigationOptics(progress, 1, false)).toEqual({ leftOpacity: 0, rightOpacity: 0, offset: 0 });
  });
  it.each([0.12, 0.92])("hides fringe at the declared transition boundary %s", (progress) => {
    expect(getNavigationOptics(progress, 1, false)).toMatchObject({ leftOpacity: 0, rightOpacity: 0 });
  });
  it("bounds fringe and refraction in both travel directions without adding a loop", () => {
    expect(getNavigationOptics(0.5, 4, false)).toEqual({ leftOpacity: 0.18, rightOpacity: 0.1, offset: 1.5 });
    expect(getNavigationOptics(0.5, -4, false).offset).toBe(-1.5);
    expect(getNavigationOptics(0.2, 0, false)).toMatchObject({ offset: 0 });
    expect(getNavigationOptics(0.2, 1, false).leftOpacity).toBeCloseTo(0.09);
    expect(getNavigationOptics(0.84, 1, false).leftOpacity).toBeCloseTo(0.09);
  });
  it.each([0.2, 0.5, 0.8])("disables every moving optical layer under Reduce Motion at %s", (progress) => {
    expect(getNavigationOptics(progress, 1, true)).toEqual({ leftOpacity: 0, rightOpacity: 0, offset: 0 });
  });
  it("renders the actual three-stop specular gradient without changing layout or hit testing", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<NavigationLensMaterial progress={{ value: 0.5 } as SharedValue<number>} reduceMotion={false} />); });
    try {
      const layer = renderer.root.findByProps({ testID: "navigation-lens-optics" });
      expect(layer.props).toMatchObject({ pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
      expect(StyleSheet.flatten(layer.props.style)).toEqual(StyleSheet.absoluteFill);
      expect(renderer.root.findByType(LinearGradient).props).toMatchObject({ x1: "50%", y1: "0%", x2: "50%", y2: "100%" });
      const stops = renderer.root.findAllByType(Stop).map((stop) =>
        React.createElement(Stop, stop.props));
      const extractGradient = jest.requireActual<{ default: (
        props: { id: string; children: React.ReactElement[] }, parent: null,
      ) => { gradient: number[] } }>("react-native-svg/lib/commonjs/lib/extract/extractGradient").default;
      // Exercise installed SVG's real native serialization: rgba alpha alone
      // is discarded by this version, so props-only color assertions miss it.
      const native = extractGradient({ id: "lens-native-alpha", children: stops }, null);
      const alphas = native.gradient.filter((_, index) => index % 2 === 1).map((color) => (color >>> 24) / 255);
      expect(alphas[0]).toBeCloseTo(0.72, 2);
      expect(alphas[1]).toBeCloseTo(0.16, 2);
      expect(alphas[2]).toBe(0);
      expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "navigation-lens-fringe-left" }).props.style).opacity).toBe(0.18);
      act(() => renderer.update(<NavigationLensMaterial progress={{ value: 0.5 } as SharedValue<number>} reduceMotion />));
      expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "navigation-lens-fringe-left" }).props.style).opacity).toBe(0);
      expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "navigation-lens-fringe-right" }).props.style).opacity).toBe(0);
    } finally { act(() => renderer.unmount()); }
  });
});
