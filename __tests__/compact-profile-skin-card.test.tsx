import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { CachedImage } from "~/components/CachedImage";
import { FALLBACK_IMAGE, type EquippedWeapon } from "~/components/GalleryProfile";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import { GLASS_MATERIAL, RADIUS, SHADOWS } from "~/constants/DesignSystem";
import { CompactProfileSkinCard } from "~/features/profile/CompactProfileSkinCard";
import { getContentTierVisual } from "~/utils/content-tier";

jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));

const weapon: EquippedWeapon = {
  weaponId: "vandal", weaponName: "Vandal", category: "Rifle",
  skinId: "skin", skinLevelId: "level", chromaId: "chroma",
  skinName: "Actual equipped skin", image: "https://example.com/skin.png",
  contentTierName: "Premium", upgradeLevel: 2, maxUpgradeLevel: 4,
};
const renderers: TestRenderer.ReactTestRenderer[] = [];
function renderCard(props: Partial<React.ComponentProps<typeof CompactProfileSkinCard>> = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<CompactProfileSkinCard weapon={weapon} width={96} {...props} />); });
  renderers.push(renderer);
  return renderer;
}
afterEach(() => { act(() => renderers.forEach((renderer) => renderer.unmount())); renderers.length = 0; });

describe("compact equipped skin glass presentation", () => {
  it.each([72, 96, 136])("keeps supplied width %s, tier border and clear contained artwork", (width) => {
    const root = renderCard({ width }).root;
    const decoration = root.findByType(LiquidGlassDecoration);
    const card = decoration.parent!;
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      width, backgroundColor: GLASS_MATERIAL.surface,
      borderColor: getContentTierVisual(undefined, "Premium").border,
      borderRadius: RADIUS.sm, minHeight: 48, ...SHADOWS.xs,
    });
    expect(root.findAll((node) => node.type === LiquidGlassDecoration || node.type === CachedImage).map((node) => node.type)).toEqual([LiquidGlassDecoration, CachedImage]);
    expect(decoration.props).toMatchObject({ radius: RADIUS.sm, density: "dense", tone: "light" });
    const opticalLayer = decoration.findAllByType(View)[0];
    expect(opticalLayer.props).toMatchObject({ pointerEvents: "none", accessible: false, accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    expect(StyleSheet.flatten(opticalLayer.props.style).position).toBe("absolute");
    const image = root.findByType(CachedImage);
    expect(image.props).toMatchObject({ cacheId: "skin-image:chroma:display", source: { uri: weapon.image }, contentFit: "contain", recyclingKey: weapon.skinId });
    expect(StyleSheet.flatten(image.parent!.props.style).aspectRatio).toBe(1.45);
    expect(root.findAllByType(Text).map((node) => node.props.children)).toEqual(["PREMIUM", "2/4", weapon.weaponName, weapon.skinName]);
  });

  it.each([false, true])("preserves press handler and announces disabled=%s", (disabled) => {
    const onPress = jest.fn();
    const button = renderCard({ disabled, onPress }).root.findByType(TouchableOpacity);
    expect(button.props).toMatchObject({ accessibilityRole: "button", accessibilityLabel: `${weapon.weaponName}, ${weapon.skinName}`, accessibilityState: { disabled }, disabled });
    expect(button.props.onPress).toBe(onPress);
    expect(StyleSheet.flatten(button.props.style).opacity).toBe(disabled ? 0.72 : 1);
    if (!disabled) act(() => button.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(disabled ? 0 : 1);
  });

  it("retains fallback artwork and a noninteractive accessible summary without a picker", () => {
    const root = renderCard({ weapon: { ...weapon, image: undefined, chromaId: "", skinLevelId: "", upgradeLevel: undefined } }).root;
    expect(root.findAllByType(TouchableOpacity)).toHaveLength(0);
    const summary = root.findAllByType(View).find((node) => node.props.accessibilityLabel === `${weapon.weaponName}, ${weapon.skinName}`);
    expect(summary?.props.accessible).toBe(true);
    expect(root.findByType(CachedImage).props).toMatchObject({ source: FALLBACK_IMAGE, cacheId: "skin-image:skin:display" });
    expect(root.findAllByType(Text).map((node) => node.props.children)).not.toContain("2/4");
  });
});
