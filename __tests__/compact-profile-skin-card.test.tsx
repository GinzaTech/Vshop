import React from "react";
import { RefractiveGlassCard } from "~/components/ui/refractive-glass";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { CachedImage } from "~/components/CachedImage";
import { FALLBACK_IMAGE, type EquippedWeapon } from "~/components/GalleryProfile";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import ContentCardTouchable from "~/components/ui/ContentCardTouchable";
import { COLORS, GLASS_MATERIAL, RADIUS } from "~/constants/DesignSystem";
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

describe("compact equipped skin crisp presentation", () => {
  it.each([72, 96, 136])("keeps supplied width %s, tier border and clear contained artwork", (width) => {
    const root = renderCard({ width }).root;
    expect(root.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    const card = root.findAllByType(View).find(node => node.props.accessible)!;
    expect(StyleSheet.flatten(card.props.style)).toMatchObject({
      backgroundColor: GLASS_MATERIAL.surface, width,
      borderColor: getContentTierVisual(undefined, "Premium").border,
      borderRadius: RADIUS.sm, minHeight: 48,
    });
    expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
    const image = root.findByType(CachedImage);
    expect(image.props).toMatchObject({ cacheId: "skin-image:chroma:display", source: { uri: weapon.image }, contentFit: "contain", recyclingKey: weapon.skinId });
    expect(StyleSheet.flatten(image.parent!.props.style).aspectRatio).toBe(2.25);
    expect(root.findAllByType(Text).map((node) => node.props.children)).toEqual(["PREMIUM", "2/4", weapon.weaponName, weapon.skinName]);
  });

  it.each([false, true])("preserves press handler and announces disabled=%s", (disabled) => {
    const onPress = jest.fn();
    const root = renderCard({ disabled, onPress }).root;
    const button = root.findByType(TouchableOpacity);
    expect(button.props).toMatchObject({ accessibilityRole: "button", accessibilityLabel: `${weapon.weaponName}, ${weapon.skinName}`, accessibilityState: { disabled }, disabled });
    expect(root.findByType(ContentCardTouchable).props.onPress).toBe(onPress);
    expect(button.props.activeOpacity).toBe(1);
    expect(StyleSheet.flatten(button.props.style).opacity ?? 1).toBe(1);
    expect(StyleSheet.flatten(root.findAllByType(Text).at(-1)!.props.style).color).toBe(disabled ? COLORS.TEXT_TERTIARY : COLORS.TEXT_PRIMARY);
    act(() => button.props.onPress());
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

  it("delivers visible collection artwork at high priority without changing URI, cache ID, sizing or labels", () => {
    const root = renderCard({ imagePriority: "high" }).root;
    expect(root.findByType(CachedImage).props).toMatchObject({
      priority: "high", cachePolicy: "memory-disk", cacheId: "skin-image:chroma:display",
      source: { uri: weapon.image }, contentFit: "contain",
    });
    expect(StyleSheet.flatten(root.findByType(CachedImage).parent!.props.style).aspectRatio).toBe(2.25);
    expect(root.findAllByType(Text).at(-1)!.props.children).toBe(weapon.skinName);
  });
});

// Profile integration owns wrappers; shader lifecycle is covered by the core owner.
jest.mock("~/components/ui/refractive-glass", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return {
    RefractiveGlassCard: ({ children, compact: _compact, ...props }: React.PropsWithChildren<Record<string, unknown>>) => ReactModule.createElement(Native.View, props, children),
    GlassScrollView: ReactModule.forwardRef((props: Record<string, unknown>, ref: React.Ref<import("react-native").ScrollView>) => ReactModule.createElement(Native.ScrollView, { ...props, ref })),
  };
});
