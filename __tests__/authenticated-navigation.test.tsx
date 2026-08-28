import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import {
  FloatingTabBar,
  PRIMARY_TAB_REDUCED_MOTION_OPTIONS,
  PRIMARY_TAB_SCREEN_OPTIONS,
  PRIMARY_TAB_SCREEN_TRANSITION,
  PRIMARY_TAB_SLIDE_DISTANCE,
} from "~/app/(authenticated)/_layout";
import { COLORS } from "~/constants/DesignSystem";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () =>
  function MockMaterialCommunityIcon() {
    return null;
  },
);

jest.mock("expo-router", () => {
  const MockTabs = ({ children }: { children: React.ReactNode }) => children;
  MockTabs.Screen = function MockTabsScreen() {
    return null;
  };
  return { Tabs: MockTabs };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View },
    Easing: {
      cubic: jest.fn(),
      inOut: (value: unknown) => value,
      out: (value: unknown) => value,
    },
    ReduceMotion: { System: "system" },
    interpolate: (
      value: number,
      inputRange: number[],
      outputRange: number[],
    ) => (value === inputRange[0] ? outputRange[0] : outputRange.at(-1)),
    useAnimatedStyle: (factory: () => object) => factory(),
    useReducedMotion: () => false,
    useSharedValue: (value: unknown) => ({ value }),
    withTiming: (value: unknown) => value,
  };
});

jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (
    callback: (...args: unknown[]) => unknown,
    ...args: unknown[]
  ) => callback(...args),
}));

jest.mock("~/components/AppWarmup", () =>
  function MockAppWarmup() {
    return null;
  },
);
jest.mock("~/components/popups/MediaPopup", () =>
  function MockMediaPopup() {
    return null;
  },
);
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: (selector: (state: object) => unknown) =>
    selector({ user: { shops: { nightMarket: [] } } }),
}));
jest.mock("~/utils/flow-tracer", () => ({
  flowTracer: { startTrace: jest.fn(), track: jest.fn() },
}));

const routes = [
  { key: "bundles-key", name: "bundles", params: { source: "tab" } },
  { key: "shop-key", name: "shop" },
  { key: "profile-key", name: "profile" },
  { key: "night-key", name: "night_market" },
  { key: "settings-key", name: "settings" },
];

const descriptors = Object.fromEntries(
  routes.map((route) => [
    route.key,
    { options: { tabBarAccessibilityLabel: route.name } },
  ]),
);

const getButton = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
  renderer.root.find(
    (node) =>
      node.props.accessibilityRole === "button" &&
      node.props.accessibilityLabel === label,
  );

describe("FloatingTabBar", () => {
  it("keeps Android scenes ready for the horizontal transition", () => {
    expect(PRIMARY_TAB_SCREEN_OPTIONS.lazy).toBe(true);
    expect(PRIMARY_TAB_SCREEN_OPTIONS.freezeOnBlur).toBe(false);
    expect(PRIMARY_TAB_SCREEN_OPTIONS.animation).toBe("shift");
  });

  it("moves scenes left and right without changing opacity", () => {
    const interpolateProgress = jest.fn(() => 16);
    const transitionStyle = PRIMARY_TAB_SCREEN_TRANSITION.sceneStyleInterpolator(
      {
        current: {
          progress: { interpolate: interpolateProgress },
        },
      } as unknown as Parameters<
        typeof PRIMARY_TAB_SCREEN_TRANSITION.sceneStyleInterpolator
      >[0],
    );

    expect(PRIMARY_TAB_SCREEN_TRANSITION.transitionSpec.config.duration).toBe(
      360,
    );
    expect(transitionStyle).toEqual({
      sceneStyle: {
        opacity: 1,
        transform: [{ translateX: 16 }],
      },
    });
    expect(interpolateProgress).toHaveBeenCalledWith({
      inputRange: [-1, 0, 1],
      outputRange: [
        -PRIMARY_TAB_SLIDE_DISTANCE,
        0,
        PRIMARY_TAB_SLIDE_DISTANCE,
      ],
    });
    expect(PRIMARY_TAB_REDUCED_MOTION_OPTIONS.animation).toBe("none");
  });

  const renderTabBar = () => {
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
      preload: jest.fn(),
    };
    let renderer!: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <FloatingTabBar
          state={{ index: 2, routes }}
          descriptors={descriptors}
          navigation={navigation}
        />,
      );
    });

    return { navigation, renderer };
  };

  it.each([
    ["bundles", "bundles"],
    ["shop", "shop"],
    ["settings", "settings"],
  ])("navigates the %s tab", (label, route) => {
    const { navigation, renderer } = renderTabBar();

    act(() => getButton(renderer, label).props.onPress());

    expect(navigation.emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: `${route}-key`,
      canPreventDefault: true,
    });
    expect(navigation.navigate).toHaveBeenCalledWith(route);
  });

  it("ignores repeated tab presses while the scene transition is running", () => {
    const { navigation, renderer } = renderTabBar();
    const shopButton = getButton(renderer, "shop");

    act(() => {
      shopButton.props.onPress();
      shopButton.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("keeps only one interactive layer mounted while collapsing", () => {
    const { renderer } = renderTabBar();
    const moreButton = getButton(renderer, "settings");

    expect(
      renderer.root.findAll(
        (node) => node.props.accessibilityLabel === "Expand navigation",
      ),
    ).toHaveLength(0);

    act(() => moreButton.props.onLongPress());

    expect(getButton(renderer, "Expand navigation")).toBeDefined();
    expect(
      renderer.root.findAll(
        (node) => node.props.accessibilityLabel === "bundles",
      ),
    ).toHaveLength(0);

    act(() => getButton(renderer, "Expand navigation").props.onPress());

    expect(getButton(renderer, "bundles")).toBeDefined();
  });

  it("inverts the active circle and icon when the floating bar is light", () => {
    act(() => {
      useSystemChromeStore.getState().setPrimaryNavigationTone("light");
    });

    try {
      const { renderer } = renderTabBar();
      const profileIcon = renderer.root.findAll(
        (node) => node.props.name === "account-circle-outline",
      )[0];
      const indicator = renderer.root.findByProps({
        testID: "primary-tab-indicator",
      });

      expect(profileIcon.props.color).toBe(COLORS.PURE_WHITE);
      expect(StyleSheet.flatten(indicator.props.style)).toMatchObject({
        backgroundColor: COLORS.PURE_BLACK,
      });
    } finally {
      act(() => {
        useSystemChromeStore.getState().setPrimaryNavigationTone("dark");
      });
    }
  });
});
