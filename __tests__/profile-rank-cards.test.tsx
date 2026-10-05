import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import TestRenderer, { act } from "react-test-renderer";

import RankSplitGroup from "~/components/profile/RankSplitGroup";
import { ProfileHeroCard } from "~/features/profile/ProfileHeroCard";
import { GlassClip, RefractiveGlassCard } from "~/components/ui/refractive-glass";
import { COLORS, SPACING } from "~/constants/DesignSystem";
import { styles as heroStyles } from "~/features/profile/profile-screen.styles";

jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/ui/AppIcon", () => () => null);
jest.mock("~/components/CurrencyIcon", () => () => null);
jest.mock("~/components/profile/TypewriterSwapText", () => ({ text, style }: { text: string; style: unknown }) => require("react").createElement(require("react-native").Text, { style }, text));
jest.mock("~/components/ui/refractive-glass", () => ({
  GlassClip: ({ children, height: _height, ...props }: React.PropsWithChildren<Record<string, unknown>>) => require("react").createElement(require("react-native").View, props, children),
  RefractiveGlassCard: ({ children, compact: _compact, ...props }: React.PropsWithChildren<Record<string, unknown>>) => require("react").createElement(require("react-native").View, props, children),
}));
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  useAnimatedStyle: (factory: () => unknown) => factory(),
  useDerivedValue: (factory: () => number) => ({ get value() { return factory(); } }),
  interpolate: (value: number, input: number[], output: number[]) =>
    value <= input[0] ? output[0] : output.at(-1),
  interpolateColor: (value: number, input: number[], output: string[]) => value <= input[0] ? output[0] : output.at(-1),
}));

function expectCompactRankLayout(rank: TestRenderer.ReactTestInstance) {
  const texts = rank.findAllByType(Text);
  const label = texts.find((node) => node.props.children === rank.props.rankLabel)!;
  const value = texts.find((node) => node.props.children === rank.props.rankValue)!;
  expect(label.props.numberOfLines).toBeUndefined();
  expect(label.props.allowFontScaling).not.toBe(false);
  expect(StyleSheet.flatten(label.props.style)).toMatchObject({
    fontSize: 11, lineHeight: 14, textTransform: "none", letterSpacing: 0,
  });
  expect(StyleSheet.flatten(label.parent!.props.style)).toMatchObject({
    paddingHorizontal: 10, paddingVertical: 6,
  });
  expect(StyleSheet.flatten(value.parent!.props.style)).toMatchObject({
    gap: 4, marginTop: SPACING.xxs,
  });
  expect(StyleSheet.flatten(value.props.style)).toMatchObject({
    marginLeft: 0, fontSize: 13, lineHeight: 16,
    minWidth: 0, flexShrink: 1, color: COLORS.PURE_WHITE,
  });
  expect(value.props).toMatchObject({
    numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.85,
  });
}

describe("Profile rank cards", () => {
  it.each(["Kim Cương 3", "Bất Diệt 3", "Chưa có xếp hạng"])(
    "presents the complete %s name with smaller two-line fitting",
    (rankValue) => {
      let renderer: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <RankSplitGroup
            animateText={false}
            contentMode="rank"
            rankLabel="Hạng cao nhất"
            rankValue={rankValue}
            splitProgress={{ value: 0 } as SharedValue<number>}
            stats={[
              { key: "wins", label: "Wins", value: "8", icon: "peakRank" },
              { key: "losses", label: "Losses", value: "10", icon: "error" },
            ]}
          />,
        );
      });
      const value = renderer!.root.findAllByType(Text).find(
        (node) => node.props.children === rankValue,
      )!;
      expect(value).toBeDefined();
      expect(value.props.numberOfLines).toBe(2);
      expect(value.props.adjustsFontSizeToFit).toBe(true);
      expect(value.props.minimumFontScale).toBe(0.85);
      expect(StyleSheet.flatten(value.props.style)).toMatchObject({
        fontSize: 13, lineHeight: 16, minWidth: 0, flexShrink: 1,
      });
      expectCompactRankLayout(renderer!.root.findByProps({ rankLabel: "Hạng cao nhất" }));
      const rankSurface = renderer!.root.findAllByType(View).find((node) =>
        node.props.pointerEvents === "none" &&
        StyleSheet.flatten(node.props.style)?.borderRadius === 18,
      )!;
      const rankMaterial = StyleSheet.flatten(rankSurface.props.style);
      const balanceMaterial = StyleSheet.flatten(heroStyles.heroStatCard);
      for (const material of [rankMaterial]) {
        expect(material).toMatchObject({
          backgroundColor: COLORS.ON_DARK_BORDER,
          borderColor: COLORS.ON_DARK_BORDER,
          borderWidth: 1,
        });
      }
      expect(balanceMaterial).toMatchObject({ backgroundColor: COLORS.ON_DARK_BORDER, borderColor: COLORS.ON_DARK_BORDER, borderWidth: 1 });
      act(() => renderer!.unmount());
    },
  );

  it.each(["rank", "blank", "act"] as const)("uses the original native rank renderer for %s with values and 13dp rank fitting", (contentMode) => {
    const progress = { value: contentMode === "act" ? 1 : 0 } as SharedValue<number>;
    const stats = [{ key: "wins", label: "Wins", value: "12345", icon: "peakRank" }, { key: "losses", label: "Losses", value: "67890", icon: "error" }] as [import("~/components/profile/RankSplitGroup").RankSplitStat, import("~/components/profile/RankSplitGroup").RankSplitStat];
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ProfileHeroCard accountLevel={42} actRankSummaryStats={{ left: stats, right: stats }} competitiveRank={null} expandedHeroHeight={{ value: 292 } as SharedValue<number>} hasAuth heroModeProgress={progress} identityDetails={null} isPlayerInfoMode={false} name="Player" onRegionPress={jest.fn()} onToggleMode={jest.fn()} pageModeProgress={{ value: 0 } as SharedValue<number>} profileModeTransitioning={false} profileStats={[{ key: "vp", label: "VP", value: 123456789, icon: "vp" }]} rankSplitContentMode={contentMode} rankSplitProgress={progress} regionLabel="AP" statsVisibilityProgress={{ value: 1 } as SharedValue<number>} synced tagLine="VSHOP" />); });
    const cards = renderer.root.findAllByType(RefractiveGlassCard);
    expect(cards).toHaveLength(0);
    for (const rankLabel of ["profile_page.current_rank", "profile_page.peak_rank"]) {
      const rank = renderer.root.findByProps({ rankLabel });
      expect(rank.props).toMatchObject({ contentMode, splitProgress: progress, stats });
      if (contentMode === "rank") expectCompactRankLayout(rank);
    }
    const values = renderer.root.findAllByType(Text);
    expect(values.map(value => value.props.children)).toContain("123456789");
    if (contentMode === "rank") {
      const ranks = values.filter(value => value.props.numberOfLines === 2 && value.props.adjustsFontSizeToFit);
      expect(ranks).toHaveLength(2);
      ranks.forEach(rank => expect(StyleSheet.flatten(rank.props.style)).toMatchObject({ fontSize: 13, lineHeight: 16, minWidth: 0, flexShrink: 1 }));
    } else if (contentMode === "act") {
      expect(values.map(value => value.props.children)).toEqual(expect.arrayContaining(["12345", "67890"]));
    }
    const nativeControls = renderer.root.findAllByType(Pressable);
    const props = renderer.root.findByType(ProfileHeroCard).props as React.ComponentProps<typeof ProfileHeroCard>;
    act(() => renderer.update(<ProfileHeroCard {...props} isPlayerInfoMode pageModeProgress={{ value: 1 } as SharedValue<number>} />));
    const clips = renderer.root.findAllByType(GlassClip);
    expect(clips).toHaveLength(0);
    expect(renderer.root.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    renderer.root.findAllByType(Pressable).forEach((control, index) => expect(control).toBe(nativeControls[index]));
    act(() => renderer.unmount());
  });
});
