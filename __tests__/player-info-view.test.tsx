import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import PlayerInfoView from "~/components/profile/PlayerInfoView";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useProfileDashboardTabStore } from "~/features/profile/useProfileDashboardTabStore";

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => jest.fn(() => null));
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
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useSharedValue: (value: unknown) => ({ value }),
    withSequence: (...values: unknown[]) => values.at(-1),
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

  it("keeps both dashboard panels mounted while changing their visibility", () => {
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

  it("renders compact season chips without shrinking their effective touch target", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<PlayerInfoView {...baseProps} />);
    });

    const chip = renderer!.root.findByProps({ testID: "profile-season-act-old" });
    const chipStyle = StyleSheet.flatten(chip.props.style({ pressed: false }));
    expect(chipStyle.minHeight).toBeLessThanOrEqual(32);
    expect(chip.props.hitSlop).toEqual({
      bottom: 7,
      left: 3,
      right: 3,
      top: 7,
    });
    expect(Icon).toHaveBeenCalled();
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
