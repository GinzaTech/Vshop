import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import LoadingScreen from "~/components/LoadingScreen";
import appConfig from "../app.json";

jest.mock("~/components/ui/AppIcon", () =>
  function MockAppIcon() {
    return null;
  },
);
jest.mock("~/utils/recovery-update", () => ({
  startRecoveryUpdate: jest.fn(async () => ({ kind: "up-to-date" })),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { time?: string; completed?: number; total?: number }) => ({
      "startup_launch.stages": `${values?.completed} / ${values?.total} steps complete`,
      "startup_recovery.unavailable":
        "Riot services are unavailable. VShop will keep retrying automatically.",
      "startup_recovery.maintenance":
        "VALORANT is under maintenance or temporarily unavailable.",
      "startup_recovery.retry": "Retry now",
      "startup_recovery.use_cache": "View saved data",
      "startup_recovery.cache_hint": "Saved data may be out of date",
      "startup_recovery.last_updated": `Last successful update: ${values?.time ?? ""}`,
    } as Record<string, string>)[key] ?? key,
  }),
}));
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    cancelAnimation: jest.fn(),
    ReduceMotion: { System: "system" },
    Easing: { out: () => undefined, inOut: () => undefined, cubic: () => undefined, bezier: () => undefined },
    useAnimatedStyle: (factory: () => object) => factory(),
    useReducedMotion: () => false,
    useSharedValue: (value: unknown) => ({ value }),
    withRepeat: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});

describe("LoadingScreen recovery controls", () => {
  it.each([["prepare", 0], ["session", 1], ["data", 2], ["ready", 3]] as const)("reports real phase %s as %s completed stages", (phase, completed) => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<LoadingScreen phase={phase} />); });
    expect(renderer.root.findByProps({ testID: "startup-progress" }).props.accessibilityValue).toMatchObject({ min: 0, max: 3, now: completed });
    expect(renderer.root.findByProps({ testID: "startup-phase-label" }).props.children).toBe(`startup_launch.${phase}`);
    act(() => renderer.unmount());
  });
  it("acknowledges the icon surface once only after decode and a nonzero layout, and ignores retired events", () => {
    const onReady = jest.fn(); let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<LoadingScreen onReady={onReady} />); });
    const image = renderer.root.findByType(Image);
    act(() => image.props.onLoad());
    expect(onReady).not.toHaveBeenCalled();
    const layout = renderer.root.findByProps({ testID: "startup-brand-frame" }).props.onLayout;
    act(() => layout({ nativeEvent: { layout: { width: 0, height: 0 } } }));
    expect(onReady).not.toHaveBeenCalled();
    act(() => layout({ nativeEvent: { layout: { width: 96, height: 96 } } }));
    act(() => image.props.onLoad());
    expect(onReady).toHaveBeenCalledTimes(1);
    const retainedLoad = image.props.onLoad;
    act(() => renderer.unmount());
    act(() => retainedLoad());
    expect(onReady).toHaveBeenCalledTimes(1);
  });
  it("shows the new launch mark, app name, minimal status and honest phase progress without a spinner", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<LoadingScreen />);
    });

    const icon = renderer!.root.findByType(Image);
    expect(icon.props.source).toBe(require("../assets/generated/production/startup/vshop-launch-mark-v1.png"));
    expect(StyleSheet.flatten(icon.props.style)).toMatchObject({ width: 112, height: 112 });
    expect(renderer!.root.findAllByType(Text).some((node) => node.props.children === "VShop")).toBe(true);
    expect(renderer!.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: "startup-progress" }).props).toMatchObject({
      accessibilityRole: "progressbar", accessibilityState: { busy: true }, accessibilityValue: { min: 0, max: 3, now: 0 },
    });
    act(() => renderer!.unmount());
  });

  it("keeps native splash image, width and background consistent with the React icon surface", () => {
    const splash = appConfig.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen");
    expect(splash).toEqual(["expo-splash-screen", {
      image: "./assets/generated/production/startup/vshop-launch-mark-v1.png", imageWidth: 112, resizeMode: "contain", backgroundColor: "#eceef0",
    }]);
  });

  it("offers retry and cached startup when a complete cache exists", () => {
    const onRetry = jest.fn();
    const onUseCachedData = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <LoadingScreen
          showRecoveryActions
          canUseCachedData
          onRetry={onRetry}
          onUseCachedData={onUseCachedData}
        />
      );
    });

    act(() => renderer!.root.findByProps({ testID: "startup-retry-button" }).props.onPress());
    act(() => renderer!.root.findByProps({ testID: "startup-use-cache-button" }).props.onPress());

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onUseCachedData).toHaveBeenCalledTimes(1);
  });

  it("does not offer an incomplete cache", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<LoadingScreen showRecoveryActions />);
    });

    expect(
      renderer!.root.findAllByProps({ testID: "startup-retry-button" }).length
    ).toBeGreaterThan(0);
    expect(
      renderer!.root.findAllByProps({ testID: "startup-use-cache-button" })
    ).toHaveLength(0);
  });

  it("offers update recovery even when no startup cache exists", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LoadingScreen showUpdateRecovery />,
      );
    });

    expect(
      renderer.root.findByProps({ testID: "recovery-check-update-button" }),
    ).toBeDefined();
    expect(renderer.root.findByProps({ testID: "startup-phase-label" })).toBeDefined();
    expect(renderer.root.findByProps({ testID: "startup-progress" })).toBeDefined();
    expect(
      renderer.root.findAllByProps({ testID: "startup-use-cache-button" }),
    ).toHaveLength(0);
  });

  it("labels maintenance and shows when the saved snapshot was last updated", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <LoadingScreen
          showRecoveryActions
          canUseCachedData
          recoveryKind="maintenance"
          cachedDataUpdatedAt={Date.UTC(2026, 8, 23, 1, 2, 3)}
        />
      );
    });

    const text = renderer!.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .join(" ");
    expect(text).toContain("VALORANT is under maintenance");
    expect(text).toContain("Last successful update:");
    expect(text).toContain("View saved data");
  });
});
