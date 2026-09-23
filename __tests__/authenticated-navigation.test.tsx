import React from "react";
import { StyleSheet } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import AuthenticatedLayout, { FloatingTabBar } from "~/app/(authenticated)/_layout";
import { createPrimaryTabScreenOptions, PRIMARY_TAB_REDUCED_MOTION_OPTIONS } from "~/utils/primary-tab-motion";
import { COLORS } from "~/constants/DesignSystem";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";
import { withTiming } from "react-native-reanimated";
import PrimaryTabScene from "~/components/ui/PrimaryTabScene";

let mockReduceMotion = false;
let mockNightMarket: object[] = [];
let mockSceneFocused = true;
let mockMediaPopupOpen = false;

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
  return { Tabs: MockTabs, useIsFocused: () => mockSceneFocused };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => mockReduceMotion }));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const { useRef } = require("react");
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
    useSharedValue: (value: unknown) => useRef({ value }).current,
    withTiming: jest.fn((value: unknown) => value),
    cancelAnimation: jest.fn(),
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
jest.mock("~/components/popups/MediaPopup", () => ({
  __esModule: true,
  default: function MockMediaPopup() {
    return null;
  },
  useMediaPopupStore: (
    selector: (state: { entries: object[] }) => unknown,
  ) => selector({ entries: mockMediaPopupOpen ? [{}] : [] }),
}));
jest.mock("~/hooks/useUserStore", () => ({
  useUserStore: (selector: (state: object) => unknown) =>
    selector({ user: { shops: { nightMarket: mockNightMarket } } }),
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

const getControl = (
  renderer: TestRenderer.ReactTestRenderer,
  label: string,
  role: "button" | "tab",
) =>
  renderer.root.find(
    (node) =>
      node.props.accessibilityRole === role &&
      node.props.accessibilityLabel === label,
  );

const getButton = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
  getControl(renderer, label, "button");

const getTab = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
  getControl(renderer, label, "tab");

describe("FloatingTabBar", () => {
  const renderers: TestRenderer.ReactTestRenderer[] = [];
  afterEach(() => {
    act(() => renderers.splice(0).forEach((renderer) => renderer.unmount()));
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mockReduceMotion = false;
    mockNightMarket = [];
    mockSceneFocused = true;
    mockMediaPopupOpen = false;
  });
  it("keeps Android scenes ready for the horizontal transition", () => {
    const options = createPrimaryTabScreenOptions(400);
    expect(options.lazy).toBe(true);
    expect(options.freezeOnBlur).toBe(false);
    expect(options.animation).toBe("shift");
  });

  it("fades in the destination with a short horizontal shift and respects Reduce Motion", () => {
    const options = createPrimaryTabScreenOptions(400);
    const interpolateProgress = jest.fn(() => 16);
    const transitionStyle = options.sceneStyleInterpolator(
      {
        current: {
          progress: { interpolate: interpolateProgress },
        },
      } as unknown as Parameters<
        typeof options.sceneStyleInterpolator
      >[0],
    );

    expect(options.transitionSpec.config.duration).toBe(
      220,
    );
    expect(transitionStyle).toEqual({
      sceneStyle: {
        opacity: 16,
        transform: [{ translateX: 16 }],
      },
    });
    expect(interpolateProgress).toHaveBeenCalledWith({
      inputRange: [-1, 0, 1],
      outputRange: [
        -32,
        0,
        32,
      ],
      extrapolate: "clamp",
    });
    expect(interpolateProgress).toHaveBeenCalledWith({
      inputRange: [-1, 0, 1],
      outputRange: [0.92, 1, 0.92],
      extrapolate: "clamp",
    });
    expect(PRIMARY_TAB_REDUCED_MOTION_OPTIONS.animation).toBe("none");
    expect(PRIMARY_TAB_REDUCED_MOTION_OPTIONS.sceneStyle).toEqual({ backgroundColor: "transparent" });
    expect(createPrimaryTabScreenOptions(400).sceneStyle).toEqual({ backgroundColor: "transparent" });
  });

  it("hides outgoing content so shifted pages cannot ghost through each other", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    const child = <React.Fragment />;
    act(() => { renderer = TestRenderer.create(<PrimaryTabScene>{child}</PrimaryTabScene>); });
    renderers.push(renderer);
    mockSceneFocused = false;
    act(() => renderer.update(<PrimaryTabScene>{child}</PrimaryTabScene>));
    const scene = renderer.root.findByProps({ collapsable: false });
    expect(StyleSheet.flatten(scene.props.style).backgroundColor).toBe(COLORS.BACKGROUND);
    expect(StyleSheet.flatten(scene.props.style).opacity).toBe(0);
    expect(scene.props.pointerEvents).toBe("none");
    expect(scene.props.importantForAccessibility).toBe("no-hide-descendants");
    mockSceneFocused = true;
    act(() => renderer.update(<PrimaryTabScene>{child}</PrimaryTabScene>));
    expect(StyleSheet.flatten(scene.props.style).opacity).not.toBe(0);
    expect(scene.props.pointerEvents).toBe("auto");
  });

  it.each([[200, 16], [720, 32]])("bounds scene movement for a %s px viewport", (width, distance) => {
    const interpolateProgress = jest.fn(() => 20);
    const resizedOptions = createPrimaryTabScreenOptions(width);

    resizedOptions.sceneStyleInterpolator({
      current: {
        progress: { interpolate: interpolateProgress },
      },
    } as unknown as Parameters<
      typeof resizedOptions.sceneStyleInterpolator
    >[0]);

    expect(interpolateProgress).toHaveBeenCalledWith({
      inputRange: [-1, 0, 1],
      outputRange: [-distance, 0, distance],
      extrapolate: "clamp",
    });
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

    renderers.push(renderer);
    return { navigation, renderer };
  };

  it("exposes expanded primary navigation as a tablist with stable tab selectors", () => {
    const { renderer } = renderTabBar();
    const tabList = renderer.root.findByProps({ testID: "primary-tab-list" });
    const profileTab = renderer.root.findByProps({ testID: "primary-tab-profile" });
    const shopTab = renderer.root.findByProps({ testID: "primary-tab-shop" });

    expect(tabList.props.accessibilityRole).toBe("tablist");
    expect(profileTab.props.accessibilityRole).toBe("tab");
    expect(profileTab.props.accessibilityState).toEqual({ selected: true });
    expect(shopTab.props.accessibilityState).toEqual({ selected: false });
  });

  it("isolates the authenticated background while the media popup is open", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AuthenticatedLayout />);
    });
    renderers.push(renderer);

    const background = () =>
      renderer.root.findByProps({ testID: "authenticated-navigation-content" });

    expect(background().props.accessibilityElementsHidden).toBe(false);
    expect(background().props.importantForAccessibility).toBe("auto");
    expect(background().props.pointerEvents).toBe("auto");

    mockMediaPopupOpen = true;
    act(() => renderer.update(<AuthenticatedLayout />));

    expect(background().props.accessibilityElementsHidden).toBe(true);
    expect(background().props.importantForAccessibility).toBe(
      "no-hide-descendants",
    );
    expect(background().props.pointerEvents).toBe("none");
  });

  it.each([
    ["bundles", "bundles"],
    ["shop", "shop"],
    ["settings", "settings"],
  ])("navigates the %s tab", (label, route) => {
    const { navigation, renderer } = renderTabBar();

    act(() => getTab(renderer, label).props.onPress());

    expect(navigation.emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: `${route}-key`,
      canPreventDefault: true,
    });
    expect(navigation.navigate).toHaveBeenCalledWith(route);
  });

  it("coalesces duplicate presses but accepts another destination immediately", () => {
    const { navigation, renderer } = renderTabBar();
    const shopButton = getTab(renderer, "shop");

    act(() => {
      shopButton.props.onPress();
      shopButton.props.onPress();
      getTab(renderer, "settings").props.onPress();
    });

    expect(navigation.navigate.mock.calls).toEqual([["shop"], ["settings"]]);
  });

  it("does not restart the indicator when navigation confirms its target", () => {
    const { navigation, renderer } = renderTabBar();
    jest.mocked(withTiming).mockClear();
    act(() => getTab(renderer, "shop").props.onPress());
    expect(withTiming).toHaveBeenCalledTimes(1);
    act(() => renderer.update(<FloatingTabBar state={{ index: 1, routes }}
      descriptors={descriptors} navigation={navigation} />));
    expect(withTiming).toHaveBeenCalledTimes(1);
    act(() => getTab(renderer, "settings").props.onPress());
    act(() => renderer.update(<FloatingTabBar state={{ index: 4, routes }}
      descriptors={descriptors} navigation={navigation} />));
    expect(withTiming).toHaveBeenCalledTimes(2);
    expect(navigation.navigate.mock.calls).toEqual([["shop"], ["settings"]]);
  });

  it("allows returning to the current route before a pending navigation commits", () => {
    const { navigation, renderer } = renderTabBar();
    act(() => {
      getTab(renderer, "shop").props.onPress();
      getTab(renderer, "profile").props.onPress();
    });
    expect(navigation.navigate.mock.calls).toEqual([["shop"], ["profile"]]);
  });

  it("does not move or lock the target when tabPress is prevented", () => {
    const { navigation, renderer } = renderTabBar();
    jest.mocked(withTiming).mockClear();
    navigation.emit.mockReturnValueOnce({ defaultPrevented: true });
    act(() => getTab(renderer, "shop").props.onPress());
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(withTiming).not.toHaveBeenCalled();
    act(() => getTab(renderer, "shop").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("shop");
    expect(withTiming).toHaveBeenCalledTimes(1);
  });

  it("jumps on Back from a secondary screen and honors Reduce Motion", () => {
    const { navigation, renderer } = renderTabBar();
    const allRoutes = [...routes, { key: "history-key", name: "history" }];
    act(() => renderer.update(<FloatingTabBar state={{ index: 5, routes: allRoutes }}
      descriptors={descriptors} navigation={navigation} />));
    jest.mocked(withTiming).mockClear();
    act(() => renderer.update(<FloatingTabBar state={{ index: 2, routes: allRoutes }}
      descriptors={descriptors} navigation={navigation} />));
    expect(jest.mocked(withTiming).mock.calls.filter(([, config]) => config?.duration === 220)).toHaveLength(0);
    jest.mocked(withTiming).mockClear();
    mockReduceMotion = true;
    act(() => renderer.update(<FloatingTabBar state={{ index: 2, routes }}
      descriptors={descriptors} navigation={navigation} />));
    act(() => getTab(renderer, "shop").props.onPress());
    expect(withTiming).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith("shop");
  });

  it("includes Night Market only when items exist", () => {
    mockNightMarket = [{}];
    const { navigation, renderer } = renderTabBar();
    act(() => getTab(renderer, "night_market").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("night_market");
  });

  it("keeps only one interactive layer mounted while collapsing", () => {
    const { renderer } = renderTabBar();
    const moreButton = getTab(renderer, "settings");

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

    expect(getTab(renderer, "bundles")).toBeDefined();
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
