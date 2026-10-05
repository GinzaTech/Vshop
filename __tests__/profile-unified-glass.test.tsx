import React from "react";
import { StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RefractiveGlassCard } from "~/components/ui/refractive-glass";
import { CompactProfileSkinCard } from "~/features/profile/CompactProfileSkinCard";
import { styles } from "~/features/profile/profile-screen.styles";
import { getProfileCompactLayout } from "~/features/profile/profile-compact-layout";
import { COLORS, GLASS_MATERIAL } from "~/constants/DesignSystem";

jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
// Isolate page integration from the shared renderer owned by another slice.
jest.mock("~/components/ui/refractive-glass", () => {
  const ReactModule = require("react") as typeof React;
  return { RefractiveGlassCard: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => ReactModule.createElement("GlassCard", props, children) };
});

describe("Profile original material with retained compact geometry", () => {
  it("places crisp native skin content on its prior material without scaling its text", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<CompactProfileSkinCard width={104} weapon={{ weaponId: "vandal", weaponName: "Vandal", category: "Rifle", skinId: "skin", skinLevelId: "level", chromaId: "chroma", skinName: "Tên skin thực tế rất dài vẫn giữ nguyên" }} />); });
    expect(renderer.root.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    const material = renderer.root.findAllByType(View).find(node => node.props.accessible);
    expect(StyleSheet.flatten(material!.props.style)).toMatchObject({ width: 104, backgroundColor: GLASS_MATERIAL.surface, minHeight: 48 });
    renderer.root.findAllByType(Text).forEach(text => {
      expect(StyleSheet.flatten(text.props.style).fontSize).toBeGreaterThanOrEqual(11);
      expect(text.props.allowFontScaling).not.toBe(false);
    });
    expect(styles.profileSkinCard.backgroundColor).toBe(COLORS.SURFACE);
    act(() => renderer.unmount());
  });

  it("reduces representative row card area to 45–60 percent while retaining 13dp names", () => {
    const beforeWidth = Math.floor(390 * 0.36);
    const beforeHeight = beforeWidth / 1.45 + 7 + 8 + 12 + 2 + 28;
    const afterWidth = getProfileCompactLayout(390, 1).profileSkinRowCardWidth;
    const afterHeight = afterWidth / styles.profileSkinVisual.aspectRatio + styles.profileSkinContent.paddingTop + styles.profileSkinContent.paddingBottom + 14 + 2 + styles.profileSkinName.minHeight;
    expect(afterWidth * afterHeight / (beforeWidth * beforeHeight)).toBeGreaterThanOrEqual(0.45);
    expect(afterWidth * afterHeight / (beforeWidth * beforeHeight)).toBeLessThanOrEqual(0.60);
    expect(styles.profileSkinName.fontSize).toBe(13);
  });

  it.each([320, 349, 350, 390, 430, 700])("keeps width %s within the page and increases space at large font sizes", (width) => {
    for (const fontScale of [1, 1.3, 2]) {
      const geometry = getProfileCompactLayout(width, fontScale);
      expect(geometry.profileGridCardWidth).toBeGreaterThanOrEqual(48);
      expect(geometry.profileGridCardWidth * geometry.profileGridColumns + 8 * (geometry.profileGridColumns - 1)).toBeLessThanOrEqual(width - 32);
      if (fontScale >= 1.3 || width < 350) expect(geometry.profileGridColumns).toBe(2);
    }
  });

  it("reduces the normal phone collection grid area without scaling text", () => {
    const beforeWidth = Math.floor((390 - 32 - 16) / 3);
    const beforeArea = beforeWidth * (beforeWidth / 1.45 + 57);
    const afterWidth = getProfileCompactLayout(390, 1).profileGridCardWidth;
    const afterArea = afterWidth * (afterWidth / styles.profileSkinVisual.aspectRatio + 4 + 5 + 14 + 2 + 32);
    expect(afterArea / beforeArea).toBeGreaterThanOrEqual(0.45);
    expect(afterArea / beforeArea).toBeLessThanOrEqual(0.60);
  });

  it("uses native scrolling without refractive scene or clipping while keeping callbacks", () => {
    const source = readFileSync(resolve(__dirname, "../features/profile/ProfileScreen.tsx"), "utf8");
    expect(source).not.toMatch(/RefractiveGlass|GlassClip|GlassFlatList|GlassScrollView/);
    expect(source).toContain("<FlatList");
    expect(source).toContain("<Animated.ScrollView");
    expect(source).toContain("getProfileCompactLayout(viewportWidth, fontScale)");
    expect(source).toContain("onScroll={handleProfileContentScroll}");
    expect(source).toContain("ref={profilePagerRef}");
    expect(source).toContain("onMomentumScrollEnd={handlePagerMomentumEnd}");
    expect(source).toContain("pickerState={focused ? pickerState : null}");
  });

  it("puts dashboard cards and rank values on their original readable native material", () => {
    const source = readFileSync(resolve(__dirname, "../components/profile/PlayerInfoView.tsx"), "utf8");
    expect(source).not.toMatch(/RefractiveGlass|GlassClip|GlassScrollView/);
    expect(source).toContain('backgroundColor: PROFILE_INFO_COLORS.background');
    expect(source).toContain('style={styles.rankRowValue} numberOfLines={2}');
    expect(source).toContain('textPrimary: PROFILE_INFO_COLORS.textPrimary');
  });

  it("restores the dark hero and native identity material while keeping compact artwork and readable text", () => {
    expect(styles.heroSurface.backgroundColor).toBe(COLORS.ACCENT_DEEP);
    expect(styles.heroTitle.color).toBe(COLORS.PURE_WHITE);
    expect(styles.heroStatLabel.fontSize).toBe(11);
    expect(styles.identityImageFrame).toMatchObject({ width: "33.333333%", height: 120 });
    expect(styles.identityTitle.fontSize).toBe(13);
    expect(styles.identityTitleAction.backgroundColor).toBe(COLORS.SURFACE_MUTED);
    const hero = readFileSync(resolve(__dirname, "../features/profile/ProfileHeroCard.tsx"), "utf8");
    expect(hero).toContain("<RankSplitGroup");
    expect(hero).not.toMatch(/RefractiveGlass|GlassClip|ProfileGlassRank/);
  });
});
