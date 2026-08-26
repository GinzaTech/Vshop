import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import LoadingScreen from "~/components/LoadingScreen";

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => () => null);
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
});
