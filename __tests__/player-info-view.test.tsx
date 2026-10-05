import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import PlayerInfoView from "~/components/profile/PlayerInfoView";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { COLORS } from "~/constants/DesignSystem";
import { PROFILE_INFO_COLORS } from "~/features/profile/profile-visual-policy";
import { useProfileDashboardTabStore } from "~/features/profile/useProfileDashboardTabStore";

function MockAppIcon(props: Record<string, unknown>) {
  return React.createElement("AppIcon", props);
}

function findNativeCard(node: TestRenderer.ReactTestInstance) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === View && StyleSheet.flatten(parent.props.style)?.borderRadius === 14) {
      return parent;
    }
  }
  throw new Error("Expected a native profile card ancestor");
}

jest.mock("~/components/ui/AppIcon", () => ({
  __esModule: true,
  default: MockAppIcon,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; label?: string; season?: string }) =>
      options?.season ?? options?.label ?? options?.count?.toString() ?? key,
  }),
}));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/AppRefreshControl", () => jest.fn(() => null));
jest.mock("~/constants/Motion", () => ({ MOTION_DURATION: { standard: 250 } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock("react-native-reanimated", () => {
  const ReactModule = require("react") as typeof React;
  const AnimatedView = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement("AnimatedView", props, children);
  return {
    __esModule: true,
    default: { View: AnimatedView },
    Easing: { cubic: "cubic", out: (value: unknown) => value },
    ReduceMotion: { System: "system" },
    interpolate: (value: number, input: number[], output: number[]) =>
      value <= input[0] ? output[0] : output.at(-1),
    useAnimatedStyle: (factory: () => Record<string, unknown>) => {
      const style = {};
      Object.keys(factory()).forEach((key) => Object.defineProperty(style, key, {
        enumerable: true, get: () => factory()[key],
      }));
      return style;
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useDerivedValue: (factory: () => number) => ({ get value() { return factory(); } }),
    // Hold the first sequence frame so whole-table shrink/fade is observable.
    withSequence: (...values: unknown[]) => values[0],
    withTiming: (value: unknown) => value,
  };
});

const seasonOptions = [
  {
    id: "act-current",
    isActive: true,
    name: "V26 · ACT V",
    startTime: "2026-08-01T00:00:00Z",
  },
  {
    id: "act-old",
    isActive: false,
    name: "V25 · ACT III",
    startTime: "2026-04-01T00:00:00Z",
  },
];

const tabProgress = { value: 0 } as React.ComponentProps<
  typeof PlayerInfoView
>["tabProgress"];
const baseProps: React.ComponentProps<typeof PlayerInfoView> = {
  competitiveRank: null,
  loading: false,
  matches: [],
  onRefresh: jest.fn(),
  onSeasonChange: jest.fn(),
  refreshing: false,
  seasonMatchesById: {},
  seasonOptions,
  seasonStats: null,
  seasonStatsById: {},
  tabProgress,
};

describe("PlayerInfoView interaction layout", () => {
  beforeEach(() => {
    (AppRefreshControl as jest.Mock).mockClear();
    tabProgress.value = 0;
    useProfileDashboardTabStore.setState({ activeTab: "overview" });
  });

  it("keeps measured native panels mounted and accessible only when active", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />); });
    const overview = renderer.root.findByProps({ testID: "profile-overview-panel" });
    const details = renderer.root.findByProps({ testID: "profile-details-panel" });
    act(() => {
      overview.props.onLayout({ nativeEvent: { layout: { height: 420 } } });
      details.props.onLayout({ nativeEvent: { layout: { height: 460 } } });
    });
    const stack = renderer.root.findByProps({ testID: "profile-tab-panel-stack" });
    expect(StyleSheet.flatten(stack.props.style).height).toBe(460);
    expect(overview.props.accessibilityElementsHidden).toBe(false);
    expect(details.props.importantForAccessibility).toBe("no-hide-descendants");
    act(() => {
      tabProgress.value = 1;
      useProfileDashboardTabStore.getState().setActiveTab("details");
    });
    expect(StyleSheet.flatten(overview.props.style).opacity).toBe(0);
    expect(StyleSheet.flatten(details.props.style).opacity).toBe(1);
    expect(overview.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(details.props.accessibilityElementsHidden).toBe(false);
    expect(StyleSheet.flatten(stack.props.style).height).toBe(460);
    expect(renderer.root.findByProps({ testID: "profile-overview-panel" })).toBe(overview);
    expect(renderer.root.findByProps({ testID: "profile-details-panel" })).toBe(details);
    expect(StyleSheet.flatten(overview.props.style).display).toBeUndefined();
    act(() => renderer.unmount());
  });

  it("uses native scrolling and opaque profile materials while retaining compact cards", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />); });
    const scrolls = renderer.root.findAllByType(ScrollView);
    expect(scrolls).toHaveLength(2);
    const main = scrolls.find((scroll) => !scroll.props.horizontal)!;
    expect(main.parent!.type).toBe(PlayerInfoView);
    expect(StyleSheet.flatten(main.props.style).backgroundColor).toBe(PROFILE_INFO_COLORS.background);
    expect(StyleSheet.flatten(main.props.contentContainerStyle)).toMatchObject({
      paddingHorizontal: 12, paddingTop: 10, gap: 12,
    });
    expect(scrolls.find((scroll) => scroll.props.horizontal)!.props).toMatchObject({
      accessibilityRole: "tablist", directionalLockEnabled: true, nestedScrollEnabled: true,
    });
    const cards = renderer.root.findAll((node) =>
      node.type === View && StyleSheet.flatten(node.props.style)?.borderRadius === 14
    );
    expect(cards).toHaveLength(7);
    cards.forEach((card) => {
      expect(StyleSheet.flatten(card.props.style)).toMatchObject({
        backgroundColor: PROFILE_INFO_COLORS.card, borderColor: PROFILE_INFO_COLORS.border,
      });
    });
    const performance = renderer.root.findByProps({ testID: "profile-match-count" });
    const performanceCard = findNativeCard(performance);
    expect(StyleSheet.flatten(performanceCard.props.style)).toMatchObject({ padding: 8, gap: 6 });
    expect(StyleSheet.flatten(performance.props.style).color).toBe(PROFILE_INFO_COLORS.textSecondary);
    const title = performanceCard.findAllByType(Text)
      .find((text) => text.props.children === "profile_page.stats.performance")!;
    expect(StyleSheet.flatten(title.props.style).color).toBe(PROFILE_INFO_COLORS.textPrimary);
    const divider = renderer.root.findAllByType(View)
      .find((node) => StyleSheet.flatten(node.props.style)?.height === 1
        && StyleSheet.flatten(node.props.style)?.flex === 1)!;
    expect(StyleSheet.flatten(divider.props.style).backgroundColor).toBe(COLORS.BORDER);
    act(() => renderer.unmount());
  });

  it("keeps pull-to-refresh native and targets the selected Act", () => {
    const onRefresh = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PlayerInfoView {...baseProps} onRefresh={onRefresh} refreshing />); });
    act(() => renderer.root.findByProps({ testID: "profile-season-act-old" }).props.onPress());
    const main = renderer.root.findAllByType(ScrollView).find((scroll) => !scroll.props.horizontal)!;
    expect(main.parent!.type).toBe(PlayerInfoView);
    expect(main.props.refreshControl.props.refreshing).toBe(true);
    act(() => main.props.refreshControl.props.onRefresh());
    expect(onRefresh).toHaveBeenCalledWith("act-old");
    act(() => renderer.unmount());
  });

  it("retains two-line rank fitting at .85 and compact text on native rank cards", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlayerInfoView {...baseProps} competitiveRank={{
        currentName: "Immortal 3", currentTier: 26, currentIcon: null,
        peakName: "Radiant", peakTier: 27, peakIcon: null,
        actSeasonId: "act-current", actWins: null, actLosses: null, actGames: null,
      }} />);
    });
    ["Immortal 3", "Radiant"].forEach((name) => {
      const rank = renderer.root.findAllByType(Text).find((text) => text.props.children === name)!;
      expect(rank.props).toMatchObject({ numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.85 });
      expect(StyleSheet.flatten(rank.props.style)).toMatchObject({ fontSize: 13, color: PROFILE_INFO_COLORS.textPrimary });
      const label = rank.parent!.findAllByType(Text).find((text) => text !== rank)!;
      expect(StyleSheet.flatten(label.props.style).fontSize).toBe(11);
      const card = findNativeCard(rank);
      expect(card.type).toBe(View);
      expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(PROFILE_INFO_COLORS.card);
    });
    act(() => renderer.unmount());
  });

  it("keeps both dashboard panels and their semantic icons mounted while changing visibility", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />);
    });

    const initialOverview = renderer!.root.findByProps({
      testID: "profile-overview-panel",
    });
    const initialDetails = renderer!.root.findByProps({
      testID: "profile-details-panel",
    });
    expect(StyleSheet.flatten(initialOverview.props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(initialDetails.props.style).opacity).toBe(0);
    const initialIcons = renderer!.root.findAllByType(MockAppIcon);
    expect(initialIcons.map((icon) => icon.props.name)).toEqual(
      expect.arrayContaining([
        "season",
        "target",
        "chartBar",
        "shield",
        "accountGroup",
        "grid",
        "emptyData",
      ]),
    );
    const refreshControlRenderCount = (AppRefreshControl as jest.Mock).mock.calls
      .length;

    act(() => {
      useProfileDashboardTabStore.getState().setActiveTab("details");
    });

    expect((AppRefreshControl as jest.Mock).mock.calls).toHaveLength(
      refreshControlRenderCount
    );

    const hiddenOverview = renderer!.root.findByProps({
      testID: "profile-overview-panel",
    });
    const visibleDetails = renderer!.root.findByProps({
      testID: "profile-details-panel",
    });
    expect(hiddenOverview).toBe(initialOverview);
    expect(visibleDetails).toBe(initialDetails);
    expect(renderer!.root.findAllByType(MockAppIcon)).toHaveLength(
      initialIcons.length,
    );
    expect(hiddenOverview).toBeTruthy();
    expect(visibleDetails).toBeTruthy();
    expect(renderer!.root.findByProps({ testID: "profile-tab-panel-stack" })).toBeTruthy();

    const hiddenOverviewStyle = StyleSheet.flatten(hiddenOverview.props.style);
    const visibleDetailsStyle = StyleSheet.flatten(visibleDetails.props.style);
    expect(hiddenOverviewStyle.display).toBeUndefined();
    expect(hiddenOverviewStyle.position).toBe("absolute");
    expect(hiddenOverview.props.pointerEvents).toBe("none");
    expect(hiddenOverview.props.renderToHardwareTextureAndroid).toBeUndefined();
    expect(visibleDetailsStyle.display).toBeUndefined();
    expect(visibleDetailsStyle.position).toBe("absolute");
    expect(visibleDetails.props.pointerEvents).toBe("auto");
    expect(visibleDetails.props.renderToHardwareTextureAndroid).toBeUndefined();
    act(() => renderer!.unmount());
  });

  it("renders a semantic season icon without inventing a collapsed control", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />);
    });

    const summary = renderer!.root.findByProps({
      testID: "profile-season-current-summary",
    });
    expect(summary.props.accessibilityRole).toBeUndefined();
    expect(summary.props.accessibilityState).toBeUndefined();
    expect(summary.findByType(MockAppIcon).props).toMatchObject({
      decorative: true,
      name: "season",
    });

    const chip = renderer!.root.findByProps({ testID: "profile-season-act-old" });
    const chipStyle = StyleSheet.flatten(chip.props.style({ pressed: false }));
    expect(chipStyle.minHeight).toBeGreaterThanOrEqual(48);
    expect(chip.props.hitSlop).toEqual({
      bottom: 7,
      left: 3,
      right: 3,
      top: 7,
    });
    act(() => renderer!.unmount());
  });

  it("shows only the current summary when recording has no completed Act yet", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <PlayerInfoView
          {...baseProps}
          seasonOptions={[seasonOptions[0]]}
        />
      );
    });

    expect(
      renderer!.root.findAllByProps({ testID: "profile-season-selector" })
    ).toHaveLength(0);
    expect(
      renderer!.root.findByProps({
        testID: "profile-season-current-summary",
      }).props.accessibilityLabel
    ).toContain("V26 · ACT V");
    expect(
      renderer!.root.findAllByProps({ testID: "profile-season-act-old" })
    ).toHaveLength(0);
    act(() => renderer!.unmount());
  });

  it("exposes the season selector as a tablist and selects a different Act", () => {
    const onSeasonChange = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <PlayerInfoView {...baseProps} onSeasonChange={onSeasonChange} />
      );
    });

    const selector = renderer!.root.findByProps({
      testID: "profile-season-selector",
    });
    expect(selector.props.accessibilityRole).toBe("tablist");

    const oldSeasonChip = renderer!.root.findByProps({
      testID: "profile-season-act-old",
    });
    expect(oldSeasonChip.props.accessibilityState.selected).toBe(false);

    act(() => {
      oldSeasonChip.props.onPress();
    });

    expect(onSeasonChange).toHaveBeenCalledTimes(1);
    expect(onSeasonChange).toHaveBeenCalledWith("act-old");
    expect(
      renderer!.root.findByProps({ testID: "profile-season-act-old" }).props
        .accessibilityState.selected
    ).toBe(true);
    act(() => renderer!.unmount());
  });

  it("groups the agent and map breakdown controls as an accessible tablist", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />);
    });

    expect(
      renderer!.root.findByProps({ testID: "profile-breakdown-tabs" }).props
        .accessibilityRole
    ).toBe("tablist");
    expect(
      renderer!.root.findByProps({ testID: "profile-breakdown-tab-agents" })
        .props.accessibilityState.selected
    ).toBe(true);
    expect(
      renderer!.root.findByProps({ testID: "profile-breakdown-tab-maps" })
        .props.accessibilityState.selected
    ).toBe(false);
    act(() => renderer!.unmount());
  });

  it("keeps breakdown content geometry and opacity fixed while the subtab indicator moves", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />); });
    const tabs = renderer.root.findByProps({ testID: "profile-breakdown-tabs" });
    const table = tabs.parent!.children[1] as TestRenderer.ReactTestInstance;
    const expectCrispTable = () => {
      const style = StyleSheet.flatten(table.props.style);
      expect(style?.opacity ?? 1).toBe(1);
      expect(style?.transform ?? []).not.toEqual(expect.arrayContaining([expect.objectContaining({ scale: expect.any(Number) })]));
    };
    act(() => {
      tabs.props.onLayout({ nativeEvent: { layout: { width: 240 } } });
      renderer.root.findByProps({ testID: "profile-breakdown-tab-maps" }).props.onPress();
    });
    expectCrispTable();
    expect(renderer.root.findByProps({ testID: "profile-breakdown-tab-maps" }).props.accessibilityState.selected).toBe(true);
    const indicator = tabs.find((node) => typeof node.type === "string" && String(node.type) === "AnimatedView");
    expect(StyleSheet.flatten(indicator.props.style).transform).toEqual([{ translateX: 120 }]);
    act(() => renderer.root.findByProps({ testID: "profile-breakdown-tab-agents" }).props.onPress());
    expectCrispTable();
    expect(StyleSheet.flatten(indicator.props.style).transform).toEqual([{ translateX: 0 }]);
    act(() => renderer.unmount());
  });

  it("does not fabricate a zero match count when season stats are unavailable", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />);
    });

    expect(
      renderer!.root.findByProps({ testID: "profile-match-count" }).props
        .accessibilityLabel
    ).toBe("--");
    act(() => renderer!.unmount());
  });
});

// Native profile rendering must work without loading the glass runtime.
jest.mock("~/components/ui/refractive-glass", () => {
  throw new Error("PlayerInfoView must use native View/ScrollView materials");
});
