import React from "react";
import { Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import LoadingScreen from "~/components/LoadingScreen";
import AppIcon from "~/components/ui/AppIcon";

jest.mock("~/components/ui/AppIcon", () =>
  function MockAppIcon() {
    return null;
  },
);
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { time?: string }) => ({
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
    useAnimatedStyle: (factory: () => object) => factory(),
    useReducedMotion: () => false,
    useSharedValue: (value: unknown) => ({ value }),
    withRepeat: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});

describe("LoadingScreen recovery controls", () => {
  it("uses the shared decorative shop icon for the VShop brand", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(<LoadingScreen />);
    });

    expect(renderer!.root.findByType(AppIcon).props).toMatchObject({
      name: "shop",
      decorative: true,
    });
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
