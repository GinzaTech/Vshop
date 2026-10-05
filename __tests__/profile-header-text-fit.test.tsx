import React from "react";
import { StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import type { SharedValue } from "react-native-reanimated";
import { ProfileHeroCard } from "~/features/profile/ProfileHeroCard";
import TypewriterSwapText from "~/components/profile/TypewriterSwapText";
import { COLORS } from "~/constants/DesignSystem";

let mockDimensions = { width: 411, height: 900, fontScale: 1, scale: 3 };
let mockEquipment = "Hồ sơ trang bị";
let mockInfo = "Thông tin người chơi";
let mockReducedMotion = true;
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => mockDimensions }));
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key === "profile_page.hero_badge" ? mockEquipment : key === "profile_page.player_info" ? mockInfo : key }) }));
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => mockReducedMotion }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/CurrencyIcon", () => () => null);
jest.mock("~/components/profile/CompactPlayerProfileCard", () => ({ CompactPlayerProfileCard: () => null }));
jest.mock("~/components/profile/RankSplitGroup", () => () => null);
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("react-native-worklets", () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock("react-native-reanimated", () => {
  const Native = require("react-native") as typeof import("react-native");
  return {
    __esModule: true, default: { View: Native.View, Text: Native.Text },
    useAnimatedStyle: (fn: () => unknown) => fn(), useSharedValue: (value: number) => ({ value }),
    cancelAnimation: jest.fn(), withTiming: (value: number) => value, withRepeat: (value: number) => value,
    interpolate: (value: number, input: number[], output: number[]) => value <= input[0] ? output[0] : output.at(-1),
    interpolateColor: (value: number, input: number[], output: string[]) => value <= input[0] ? output[0] : output.at(-1),
  };
});
const sv = (value: number) => ({ value }) as SharedValue<number>;
function props(overrides: Partial<React.ComponentProps<typeof ProfileHeroCard>> = {}): React.ComponentProps<typeof ProfileHeroCard> {
  const pair = [{ key: "wins", label: "Wins", value: "1", icon: "peakRank" }, { key: "losses", label: "Losses", value: "2", icon: "error" }] as React.ComponentProps<typeof ProfileHeroCard>["actRankSummaryStats"]["left"];
  return { accountLevel: 450, actRankSummaryStats: { left: pair, right: pair }, competitiveRank: null,
    expandedHeroHeight: sv(292), hasAuth: true, heroModeProgress: sv(0), identityDetails: null,
    isPlayerInfoMode: false, name: "Mythos", onRegionPress: jest.fn(), onToggleMode: jest.fn(), pageModeProgress: sv(0),
    profileModeTransitioning: false, profileStats: [], rankSplitContentMode: "rank", rankSplitProgress: sv(0),
    regionLabel: "AP", statsVisibilityProgress: sv(1), synced: true, tagLine: "004", ...overrides };
}
const renderers: TestRenderer.ReactTestRenderer[] = [];
function render(overrides: Partial<React.ComponentProps<typeof ProfileHeroCard>> = {}) {
  const input = props(overrides);
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<ProfileHeroCard {...input} />); });
  renderers.push(renderer);
  return { renderer, input, root: renderer.root };
}
const textOf = (node: TestRenderer.ReactTestInstance) => [node.props.children].flat().filter(value => typeof value === "string").join("");
beforeEach(() => { mockDimensions = { width: 411, height: 900, fontScale: 1, scale: 3 }; mockEquipment = "Hồ sơ trang bị"; mockInfo = "Thông tin người chơi"; mockReducedMotion = true; });
afterEach(() => { act(() => renderers.splice(0).forEach(renderer => renderer.unmount())); });

describe("Profile header region and mode text allocation", () => {
  it.each([320, 411])("renders a compact Vietnamese pill inside the retained native tap target at %i dp", width => {
    mockDimensions = { ...mockDimensions, width };
    const { root, input } = render();
    const button = root.findAll(node => node.props.onPress === input.onToggleMode && typeof node.props.style === "function")[0];
    const target = StyleSheet.flatten(button.parent!.props.style);
    expect(target).toMatchObject({ width: 144, height: 48 });
    expect(target.backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({ flex: 1 });
    const surface = button.findByProps({ testID: "profile-mode-pill-surface" });
    expect(surface.props.pointerEvents).toBe("none");
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({
      position: "absolute", left: 0, right: 0, height: 36, top: 6,
      backgroundColor: "rgba(48, 164, 108, 0.18)",
    });
    const thumb = button.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.width === 24)!;
    expect(StyleSheet.flatten(thumb.props.style)).toMatchObject({ width: 24, height: 24, top: 12 });
    const label = root.findAllByType(Text).find(node => textOf(node) === mockEquipment)!;
    expect(label.props).toMatchObject({ numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.7 });
    expect(StyleSheet.flatten(label.parent!.parent!.props.style)).toMatchObject({ paddingLeft: 36, paddingRight: 36 });
    act(() => button.props.onPress());
    expect(input.onToggleMode).toHaveBeenCalledTimes(1);
  });

  it.each(["AP", "NA", "EU", "LATAM"])("reserves trailing width for the full %s region and keeps the native press owner", regionLabel => {
    const { root, input } = render({ regionLabel });
    const region = root.findAllByType(Text).find(node => textOf(node) === regionLabel)!;
    const style = StyleSheet.flatten(region.props.style);
    expect(style).toMatchObject({ flexShrink: 0, paddingEnd: 3 });
    expect(style.minWidth).toBeGreaterThanOrEqual(regionLabel.length * 11 * 0.8);
    expect(region.props.numberOfLines).toBe(1);
    const button = root.findAll(node => node.props.onPress === input.onRegionPress && typeof node.props.style === "function")[0];
    const pill = StyleSheet.flatten(button.props.style({ pressed: false }));
    expect(pill.flexShrink).toBe(0);
    expect(pill.minWidth).toBeGreaterThanOrEqual(64);
    act(() => button.props.onPress());
    expect(input.onRegionPress).toHaveBeenCalledTimes(1);
  });

  it.each([[411, 1], [320, 1], [320, 1.3], [320, 2], [700, 2]])("allocates two-line localized mode labels and thumb-free slots at %i dp / font scale %s", (width, fontScale) => {
    mockDimensions = { ...mockDimensions, width, fontScale };
    mockEquipment = "Ausrüstungsprofil und Spielerausrüstung";
    mockInfo = "Informations complètes sur le joueur";
    const { renderer, root, input } = render({ regionLabel: "LATAM" });
    const label = root.findAllByType(Text).find(node => textOf(node) === mockEquipment)!;
    expect(label.props).toMatchObject({ numberOfLines: 2, adjustsFontSizeToFit: true });
    expect(label.props.minimumFontScale).toBe(0.7);
    const slot = StyleSheet.flatten(label.parent!.parent!.props.style);
    expect(slot.paddingLeft).toBeGreaterThanOrEqual(36);
    expect(slot.paddingRight).toBeGreaterThanOrEqual(36);
    expect(StyleSheet.flatten(label.props.style).transform).not.toEqual(expect.arrayContaining([expect.objectContaining({ translateX: expect.any(Number) })]));
    const button = root.findAll(node => node.props.onPress === input.onToggleMode && typeof node.props.style === "function")[0];
    const pill = StyleSheet.flatten(button.parent!.props.style);
    expect(pill.width).toBeGreaterThanOrEqual(144);
    expect(pill.width).toBeLessThanOrEqual(width - 64);
    const longestLabel = Math.max(mockEquipment.length, mockInfo.length);
    expect(pill.width).toBeGreaterThanOrEqual(Math.min(width - 64, Math.ceil(longestLabel * 11 * fontScale * 0.55 / 2 + 72)));
    expect(pill.height).toBeGreaterThanOrEqual(48);
    expect(pill.height).toBeGreaterThanOrEqual(28 * fontScale + 8);
    const surface = button.findByProps({ testID: "profile-mode-pill-surface" });
    const visual = StyleSheet.flatten(surface.props.style);
    expect(visual.height).toBeGreaterThanOrEqual(36);
    expect(visual.height).toBeGreaterThanOrEqual(28 * fontScale + 8);
    expect(visual.top).toBe((pill.height - visual.height) / 2);
    let row = button.parent;
    while (row && StyleSheet.flatten(row.props.style)?.flexDirection !== "row") row = row.parent;
    expect(StyleSheet.flatten(row!.props.style).flexWrap).toBe("wrap");
    act(() => renderer.update(<ProfileHeroCard {...input} isPlayerInfoMode heroModeProgress={sv(1)} />));
    const nextLabel = renderer.root.findAllByType(Text).find(node => textOf(node) === mockInfo)!;
    const nextSlot = StyleSheet.flatten(nextLabel.parent!.parent!.props.style);
    expect(nextSlot.paddingLeft).toBeGreaterThanOrEqual(36);
    expect(nextSlot.paddingRight).toBeGreaterThanOrEqual(36);
    const thumb = renderer.root.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.width === 24 && StyleSheet.flatten(node.props.style)?.position === "absolute")!;
    expect(StyleSheet.flatten(thumb.props.style).transform).toEqual([{ translateX: pill.width - 34 }]);
    const updatedButton = renderer.root.findAll(node => node.props.onPress === input.onToggleMode && typeof node.props.style === "function")[0];
    expect(updatedButton).toBe(button);
    expect(StyleSheet.flatten(updatedButton.findByProps({ testID: "profile-mode-pill-surface" }).props.style).backgroundColor).toBe("rgba(255, 70, 85, 0.22)");
    expect(StyleSheet.flatten(nextLabel.props.style).color).toBe(COLORS.VALORANT_RED);
    act(() => button.props.onPress());
    expect(input.onToggleMode).toHaveBeenCalledTimes(1);
  });

  it("keeps transition locking and reduced-motion labels while legacy text stays one line by default", () => {
    const { root, input } = render({ profileModeTransitioning: true });
    const button = root.findAll(node => node.props.onPress === input.onToggleMode && typeof node.props.style === "function")[0];
    expect(button.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, busy: true } });
    const mode = root.findAllByType(Text).find(node => textOf(node) === mockEquipment)!;
    expect(mode.props.numberOfLines).toBe(2);
    let legacy!: TestRenderer.ReactTestRenderer;
    act(() => { legacy = TestRenderer.create(<TypewriterSwapText text="Other consumer" />); });
    renderers.push(legacy);
    expect(legacy.root.findByType(Text).props.numberOfLines).toBe(1);
    expect(legacy.root.findByType(Text).props.adjustsFontSizeToFit).toBeUndefined();
  });

  it("keeps the info label clear of the left thumb while the actual controller's hero progress is still zero", () => {
    const { root } = render({ isPlayerInfoMode: true, heroModeProgress: sv(0), pageModeProgress: sv(0), profileModeTransitioning: true });
    const label = root.findAllByType(Text).find(node => textOf(node) === mockInfo)!;
    const slot = StyleSheet.flatten(label.parent!.parent!.props.style);
    const thumb = root.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.width === 24 && StyleSheet.flatten(node.props.style)?.position === "absolute")!;
    const thumbStyle = StyleSheet.flatten(thumb.props.style);
    expect(slot.paddingLeft).toBeGreaterThanOrEqual(thumbStyle.left + thumbStyle.width);
    expect(slot.paddingRight).toBeGreaterThanOrEqual(36);
    expect(label.props.numberOfLines).toBe(2);
    expect(StyleSheet.flatten(label.props.style).color).toBe(COLORS.SUCCESS);
  });
});
