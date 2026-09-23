import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { useProfileMotion } from "~/features/profile/useProfileMotion";

const idleCallbacks: (() => void)[] = [];
let mockReduceMotionEnabled = false;

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));
jest.mock("~/hooks/useMotionPreference", () => ({
  useMotionPreference: () => mockReduceMotionEnabled,
}));
jest.mock("~/utils/idle-task", () => ({
  runWhenIdle: (callback: () => void) => {
    idleCallbacks.push(callback);
    return { cancel: jest.fn() };
  },
}));
jest.mock("react-native-reanimated", () => ({
  ...(() => {
    const ReactModule = require("react") as typeof React;
    return {
      useSharedValue: (value: unknown) =>
        ReactModule.useRef({ value }).current,
    };
  })(),
  Easing: {
    cubic: "cubic",
    inOut: (value: unknown) => value,
    out: (value: unknown) => value,
  },
  ReduceMotion: { System: "system" },
  interpolate: (_value: number, _input: number[], output: number[]) => output[0],
  interpolateColor: (_value: number, _input: number[], output: string[]) => output[0],
  useAnimatedScrollHandler: (handlers: unknown) => handlers,
  useAnimatedStyle: (factory: () => unknown) => factory(),
  withTiming: (value: unknown) => value,
}));

const user = {
  accessToken: "access",
  entitlementsToken: "entitlements",
  id: "user",
  region: "ap",
} as Parameters<typeof useProfileMotion>[0]["user"];

describe("Profile cold mode transition", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let motion: ReturnType<typeof useProfileMotion>;
  let animationFrames: FrameRequestCallback[];
  let Harness: () => null;
  const fetchMatches = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    idleCallbacks.length = 0;
    animationFrames = [];
    mockReduceMotionEnabled = false;
    jest
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      });
    jest
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    Harness = function Harness() {
      motion = useProfileMotion({
        fetchMatches,
        hasAuth: true,
        user,
        viewportWidth: 1080,
      });
      return null;
    };

    act(() => {
      renderer = TestRenderer.create(<Harness />);
    });
  });

  afterEach(() => {
    act(() => renderer.unmount());
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("mounts the cold dashboard before starting the visible morph", () => {
    expect(motion.statsDashboardMounted).toBe(false);
    expect(idleCallbacks).toHaveLength(1);

    act(() => {
      motion.toggleHeroMode();
    });

    expect(motion.statsDashboardMounted).toBe(true);
    expect(motion.isPlayerInfoMode).toBe(false);
    expect(motion.heroModeProgress.value).toBe(0);
    expect(motion.pageModeProgress.value).toBe(0);
    expect(animationFrames).toHaveLength(1);

    act(() => {
      animationFrames.shift()?.(16);
    });

    expect(motion.isPlayerInfoMode).toBe(true);
    expect(motion.heroModeProgress.value).toBe(0);
    expect(motion.pageModeProgress.value).toBe(1);
  });

  it("starts a warm dashboard morph without adding an extra frame", () => {
    act(() => {
      idleCallbacks.shift()?.();
    });
    expect(motion.statsDashboardMounted).toBe(true);

    act(() => {
      motion.toggleHeroMode();
    });

    expect(animationFrames).toHaveLength(0);
    expect(motion.isPlayerInfoMode).toBe(true);
    expect(motion.heroModeProgress.value).toBe(0);
    expect(motion.pageModeProgress.value).toBe(1);
  });

  it("does not defer a cold transition when Reduce Motion is enabled", () => {
    mockReduceMotionEnabled = true;
    act(() => {
      renderer.update(<Harness />);
    });

    act(() => {
      motion.toggleHeroMode();
    });

    expect(animationFrames).toHaveLength(0);
    expect(motion.statsDashboardMounted).toBe(true);
    expect(motion.isPlayerInfoMode).toBe(true);
    expect(motion.heroModeProgress.value).toBe(0);
  });
});
