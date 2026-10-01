import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import AuthenticatedLayout, { FloatingTabBar } from "~/app/(authenticated)/_layout";
import {
  createPrimaryTabScreenOptions,
  getPrimaryTabNavigatorPolicy,
  PRIMARY_TAB_REDUCED_MOTION_OPTIONS,
} from "~/utils/primary-tab-motion";
import { COLORS, GLASS_MATERIAL, GLASS_TAB_BAR } from "~/constants/DesignSystem";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";
import { withSpring, withTiming } from "react-native-reanimated";
import PrimaryTabScene from "~/components/ui/PrimaryTabScene";
import SecondaryTabScene from "~/components/ui/SecondaryTabScene";
import AppIcon from "~/components/ui/AppIcon";
import { BlurView } from "expo-blur";
import { NavigationBarBackdrop } from "~/features/navigation/NavigationBarBackdrop";
import PressFeedback from "~/components/ui/PressFeedback";

let mockReduceMotion = false;
let mockNightMarket: object[] = [];
let mockSceneFocused = true;
let mockMediaPopupOpen = false;
let mockViewportWidth = 360;
let mockFontScale = 1;
let latestTabsProps: Record<string, unknown> | null = null;
const mockMorphSet = jest.fn();
const mockMorphUnmount = jest.fn();
const mockHaptic = jest.fn(() => Promise.resolve());
jest.mock("expo-haptics", () => ({ selectionAsync: () => mockHaptic() }));
jest.mock("expo-blur", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return { BlurView: "BlurView", BlurTargetView: ReactModule.forwardRef<View, React.ComponentProps<typeof View>>((props, ref) => ReactModule.createElement(Native.View, { ...props, ref })) };
});

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () =>
  function MockMaterialCommunityIcon() {
    return null;
  },
);

jest.mock("morphicons/react-native", () => {
  const ReactModule = require("react") as typeof import("react");
  return {
    MorphIcon: ReactModule.forwardRef(
      (_props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
        ReactModule.useEffect(() => () => mockMorphUnmount(), []);
        ReactModule.useImperativeHandle(ref, () => ({
          morphTo: jest.fn(),
          set: mockMorphSet,
        }));
        return null;
      },
    ),
  };
});

jest.mock("expo-router", () => {
  const MockTabs = (props: { children: React.ReactNode } & Record<string, unknown>) => {
    latestTabsProps = props;
    return props.children;
  };
  MockTabs.Screen = function MockTabsScreen() {
    return null;
  };
  return { Tabs: MockTabs, useIsFocused: () => mockSceneFocused };
});

jest.mock("expo-router/react-navigation", () => ({ Header: () => null, Screen: ({ children }: React.PropsWithChildren) => children, getHeaderTitle: (options: { title?: string }, name: string) => options.title ?? name }));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => mockReduceMotion }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => ({ width: mockViewportWidth, height: 800, fontScale: mockFontScale }) }));

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
      bezier: () => (value: number) => value,
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
    withSpring: jest.fn((value: unknown) => value),
    withDelay: jest.fn((_delay: number, value: unknown) => value),
    cancelAnimation: jest.fn(),
  };
});

jest.mock("react-native-worklets", () => ({
  scheduleOnUI: (callback: () => void) => callback(),
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


const getTab = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
  getControl(renderer, label, "tab");

describe("FloatingTabBar", () => {
  const renderers: TestRenderer.ReactTestRenderer[] = [];
  afterEach(() => {
    act(() => renderers.splice(0).forEach((renderer) => renderer.unmount()));
    jest.restoreAllMocks();
    jest.clearAllMocks();
    useSystemChromeStore.getState().setPrimaryNavigationAccessibilityHidden(false);
    mockReduceMotion = false;
    mockNightMarket = [];
    mockSceneFocused = true;
    mockMediaPopupOpen = false;
    mockViewportWidth = 360;
    mockFontScale = 1;
    latestTabsProps = null;
  });
  it("keeps Android primary scenes attached after preload", () => {
    expect(getPrimaryTabNavigatorPolicy("android")).toEqual({
      detachInactiveScreens: false,
      secondaryFreezeOnBlur: true,
    });
  });

  it("retains non-Android hosts for crossfade", () => {
    expect(getPrimaryTabNavigatorPolicy("ios")).toEqual({
      detachInactiveScreens: false,
      secondaryFreezeOnBlur: false,
    });
  });

  it("passes the platform retention policy to Tabs", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AuthenticatedLayout />);
    });
    renderers.push(renderer);

    expect(latestTabsProps).toMatchObject({
      detachInactiveScreens:
        getPrimaryTabNavigatorPolicy(Platform.OS).detachInactiveScreens,
    });
  });
  it("delegates primary opacity to the retained UI-thread host with no native page shift", () => {
    expect(createPrimaryTabScreenOptions(400)).toEqual(PRIMARY_TAB_REDUCED_MOTION_OPTIONS);
    expect(createPrimaryTabScreenOptions(400)).toMatchObject({ lazy: true, freezeOnBlur: false, animation: "none", sceneStyle: { backgroundColor: "transparent" } });
    expect(latestTabsProps?.layout).toBeUndefined();
  });

  it("hides an unfocused standalone scene when no transition host is present", () => {
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

  it("unmounts secondary route content when it loses focus", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <SecondaryTabScene>
          <View testID="secondary-heavy-content" />
        </SecondaryTabScene>,
      );
    });
    renderers.push(renderer);
    expect(
      renderer.root.findAllByProps({ testID: "secondary-heavy-content" }),
    ).not.toHaveLength(0);

    mockSceneFocused = false;
    act(() => {
      renderer.update(
        <SecondaryTabScene>
          <View testID="secondary-heavy-content" />
        </SecondaryTabScene>,
      );
    });
    expect(
      renderer.root.findAllByProps({ testID: "secondary-heavy-content" }),
    ).toHaveLength(0);
  });

  it("wraps secondary routes in the lifecycle-bounded scene", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AuthenticatedLayout />);
    });
    renderers.push(renderer);
    const screenLayout = latestTabsProps?.screenLayout as (input: {
      children: React.ReactNode;
      route: { name: string };
    }) => React.ReactElement;

    const secondary = screenLayout({
      children: <View />,
      route: { name: "about" },
    });
    const primary = screenLayout({
      children: <View />,
      route: { name: "profile" },
    });

    expect(secondary.type).toBe(SecondaryTabScene);
    expect(primary.type).toBe(PrimaryTabScene);
  });

  const renderTabBar = (options: { prevented?: boolean; blurTarget?: React.RefObject<View | null> } = {}) => {
    const navigation = {
      emit: jest.fn(() => ({
        defaultPrevented: options.prevented ?? false,
      })),
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
          blurTarget={options.blurTarget}
        />,
      );
    });

    renderers.push(renderer);
    return { navigation, renderer };
  };

  it.each([1, 1.5, 2])("reserves the scaled navigation text line at font scale %s without growing the capsule", (fontScale) => {
    mockFontScale = fontScale;
    const { renderer } = renderTabBar();
    const requiredHeight = Math.ceil(GLASS_TAB_BAR.labelLineHeight * Math.min(fontScale, 1.3));
    for (const rowId of ["primary-tab-base-row", "primary-tab-magnified-row"]) {
      const labels = renderer.root.findByProps({ testID: rowId }).findAllByType(Text);
      expect(labels).toHaveLength(5);
      for (const label of labels) {
        expect(label.props.numberOfLines).toBe(1);
        expect(label.props.maxFontSizeMultiplier).toBe(1.3);
        expect(StyleSheet.flatten(label.parent?.props.style).height).toBe(requiredHeight);
      }
    }
    const glyph = renderer.root.findAllByType(AppIcon).find((icon) => icon.props.testID === "primary-tab-active-icon");
    let frame = glyph?.parent;
    while (frame && StyleSheet.flatten(frame.props.style)?.position !== "absolute") frame = frame.parent;
    expect(StyleSheet.flatten(frame?.props.style).top).toBe(6 - (requiredHeight - 13) / 2);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-navigation-frame" }).props.style).height).toBe(54);
  });

  it("keeps every base-row glyph neutral so red cannot remain outside the traveling lens", () => {
    const { renderer } = renderTabBar();
    for (const route of ["shop", "night_market", "settings", "bundles"]) {
      act(() => getTab(renderer, route).props.onPress());
      const base = renderer.root.findByProps({ testID: "primary-tab-base-row" });
      const icons = base.findAllByType(AppIcon);
      expect(icons).toHaveLength(5);
      expect(icons.every((icon) => icon.props.color === GLASS_MATERIAL.inactive)).toBe(true);
      const clone = renderer.root.findByProps({ testID: "primary-tab-magnified-row" });
      expect(clone.findAllByType(AppIcon).every((icon) => icon.props.color === GLASS_MATERIAL.active)).toBe(true);
    }
  });
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

  it("keeps the active glyph mounted through morph then settles its native shape", () => {
    jest.useFakeTimers();
    const { navigation, renderer } = renderTabBar();
    const getActiveIcon = () =>
      renderer.root
        .findAllByType(AppIcon)
        .find((node) => node.props.testID === "primary-tab-active-icon");
    const activeIcon = getActiveIcon();

    expect(activeIcon?.props.name).toBe("navProfile");

    act(() =>
      renderer.update(
        <FloatingTabBar
          state={{ index: 1, routes }}
          descriptors={descriptors}
          navigation={navigation}
        />,
      ),
    );

    const nextActiveIcon = getActiveIcon();
    expect(nextActiveIcon).toBe(activeIcon);
    expect(nextActiveIcon?.props.name).toBe("navShop");
    expect(nextActiveIcon?.props.spring).toBe("bouncy");

    act(() => jest.advanceTimersByTime(499));
    expect(getActiveIcon()).toBe(activeIcon);
    expect(mockMorphSet).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(getActiveIcon()).toBe(activeIcon);
    expect(getActiveIcon()?.props.name).toBe("navShop");
    expect(mockMorphSet).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("shows the accepted destination icon immediately on press", () => {
    const { renderer } = renderTabBar();

    act(() => getTab(renderer, "bundles").props.onPress());

    expect(
      renderer.root.findByProps({ testID: "primary-tab-active-icon" }).props
        .name,
    ).toBe("navStore");
  });

  it("keeps the confirmed icon when navigation is prevented", () => {
    const { navigation, renderer } = renderTabBar({ prevented: true });

    act(() => getTab(renderer, "bundles").props.onPress());

    expect(
      renderer.root.findByProps({ testID: "primary-tab-active-icon" }).props
        .name,
    ).toBe("navProfile");
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("replaces an in-flight destination with the latest accepted press", () => {
    const { renderer } = renderTabBar();

    act(() => {
      getTab(renderer, "shop").props.onPress();
      getTab(renderer, "settings").props.onPress();
    });

    expect(
      renderer.root.findByProps({ testID: "primary-tab-active-icon" }).props
        .name,
    ).toBe("navMore");
  });

  it("keeps the latest morph intent through stale confirmations and cancels obsolete shape repair timers", () => {
    jest.useFakeTimers();
    const { navigation, renderer } = renderTabBar();
    act(() => getTab(renderer, "shop").props.onPress());
    act(() => jest.advanceTimersByTime(300));
    act(() => getTab(renderer, "settings").props.onPress());
    act(() => renderer.update(<FloatingTabBar state={{ index: 1, routes }} descriptors={descriptors} navigation={navigation} />));
    expect(renderer.root.findByProps({ testID: "primary-tab-active-icon" }).props.name).toBe("navMore");
    act(() => jest.advanceTimersByTime(200));
    expect(mockMorphSet).not.toHaveBeenCalled();
    act(() => renderer.update(<FloatingTabBar state={{ index: 4, routes }} descriptors={descriptors} navigation={navigation} />));
    act(() => jest.advanceTimersByTime(300));
    expect(mockMorphSet).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
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
    jest.mocked(withSpring).mockClear();
    act(() => getTab(renderer, "shop").props.onPress());
    expect(withSpring).toHaveBeenCalledTimes(1);
    act(() => renderer.update(<FloatingTabBar state={{ index: 1, routes }}
      descriptors={descriptors} navigation={navigation} />));
    expect(withSpring).toHaveBeenCalledTimes(1);
    act(() => getTab(renderer, "settings").props.onPress());
    act(() => renderer.update(<FloatingTabBar state={{ index: 4, routes }}
      descriptors={descriptors} navigation={navigation} />));
    expect(withSpring).toHaveBeenCalledTimes(2);
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
    jest.mocked(withSpring).mockClear();
    navigation.emit.mockReturnValueOnce({ defaultPrevented: true });
    act(() => getTab(renderer, "shop").props.onPress());
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(withSpring).not.toHaveBeenCalled();
    act(() => getTab(renderer, "shop").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("shop");
    expect(withSpring).toHaveBeenCalledTimes(1);
  });

  it("jumps on Back from a secondary screen and honors Reduce Motion", () => {
    const { navigation, renderer } = renderTabBar();
    const allRoutes = [...routes, { key: "history-key", name: "history" }];
    act(() => renderer.update(<FloatingTabBar state={{ index: 5, routes: allRoutes }}
      descriptors={descriptors} navigation={navigation} />));
    jest.mocked(withSpring).mockClear();
    act(() => renderer.update(<FloatingTabBar state={{ index: 2, routes: allRoutes }}
      descriptors={descriptors} navigation={navigation} />));
    expect(withSpring).not.toHaveBeenCalled();
    jest.mocked(withSpring).mockClear();
    mockReduceMotion = true;
    act(() => renderer.update(<FloatingTabBar state={{ index: 2, routes }}
      descriptors={descriptors} navigation={navigation} />));
    act(() => getTab(renderer, "shop").props.onPress());
    expect(withSpring).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenCalledWith("shop");
  });

  it("keeps five stable tabs even when Night Market is empty", () => {
    const { navigation, renderer } = renderTabBar();
    expect(new Set(renderer.root.findAll((node) => node.props.accessibilityRole === "tab").map((node) => node.props.testID)).size).toBe(5);
    act(() => getTab(renderer, "night_market").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("night_market");
    expect(getTab(renderer, "settings").props.delayLongPress).toBe(500);
  });

  it("collapses on a 500ms Settings hold, preserves the glyph, and never navigates on release", () => {
    const { navigation, renderer } = renderTabBar();
    const settings = getTab(renderer, "settings");
    const release = settings.props.onPress;
    const glyph = renderer.root.findAllByType(AppIcon).find((node) => node.props.testID === "primary-tab-active-icon");
    expect(settings.props.delayLongPress).toBe(500);
    expect(getTab(renderer, "shop").props.onLongPress).toBeUndefined();
    act(() => settings.props.onLongPress());
    act(() => release());
    const expand = renderer.root.findByProps({ testID: "primary-navigation-expand" });
    expect(expand.props.disabled).toBe(false);
    expect(expand.props.accessibilityRole).toBe("button");
    expect(expand.props.accessibilityState).toMatchObject({ expanded: false });
    const content = renderer.root.findByProps({ testID: "primary-navigation-expanded" });
    expect(content.props).toMatchObject({ pointerEvents: "none", accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" });
    expect(getTab(renderer, "shop").props.disabled).toBe(true);
    expect(renderer.root.findByProps({ testID: "primary-tab-surface" }).props.pointerEvents).toBe("box-none");
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-navigation-frame" }).props.style).width).toBe(54);
    expect(renderer.root.findAllByType(AppIcon).find((node) => node.props.testID === "primary-tab-active-icon")).toBe(glyph);
    expect(mockMorphUnmount).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.emit).not.toHaveBeenCalled();
    act(() => expand.props.onPress());
    act(() => release()); // Stale release remains retired after re-expansion.
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(getTab(renderer, "profile").props.accessibilityState.selected).toBe(true);
    expect(getTab(renderer, "shop").props.disabled).toBe(false);
    expect(renderer.root.findByProps({ testID: "primary-navigation-expanded" }).props.pointerEvents).toBe("auto");
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-navigation-frame" }).props.style).width).toBe(332);
    act(() => getTab(renderer, "settings").props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("settings");
  });

  it("keeps collapse state across secondary screens and blocks hidden or retired callbacks", () => {
    const { navigation, renderer } = renderTabBar();
    const hold = getTab(renderer, "settings").props.onLongPress;
    const oldPress = getTab(renderer, "shop").props.onPress;
    act(() => useSystemChromeStore.getState().setPrimaryNavigationAccessibilityHidden(true));
    act(() => hold());
    expect(renderer.root.findByProps({ testID: "primary-navigation-expand" }).props.disabled).toBe(true);
    act(() => useSystemChromeStore.getState().setPrimaryNavigationAccessibilityHidden(false));
    act(() => { hold(); oldPress(); });
    expect(renderer.root.findByProps({ testID: "primary-navigation-expand" }).props.disabled).toBe(true);
    expect(navigation.emit).not.toHaveBeenCalled();
    act(() => getTab(renderer, "settings").props.onLongPress());
    const expand = renderer.root.findByProps({ testID: "primary-navigation-expand" }).props.onPress;
    const allRoutes = [...routes, { key: "history-key", name: "history" }];
    act(() => renderer.update(<FloatingTabBar state={{ index: 5, routes: allRoutes }} descriptors={descriptors} navigation={navigation} />));
    act(() => expand());
    act(() => renderer.update(<FloatingTabBar state={{ index: 2, routes: allRoutes }} descriptors={descriptors} navigation={navigation} />));
    act(() => expand()); // Pre-hide expand cannot revive after returning.
    expect(renderer.root.findByProps({ testID: "primary-navigation-expand" }).props.disabled).toBe(false);
    expect(getTab(renderer, "profile").props.disabled).toBe(true);
    expect(navigation.navigate).not.toHaveBeenCalled();
    const staleHold = getTab(renderer, "settings").props.onLongPress;
    act(() => renderer.unmount());
    act(() => { staleHold(); expand(); });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("snaps collapse/expand under Reduce Motion without a width animation", () => {
    mockReduceMotion = true;
    const { renderer } = renderTabBar();
    jest.mocked(withTiming).mockClear();
    act(() => getTab(renderer, "settings").props.onLongPress());
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-navigation-frame" }).props.style).width).toBe(54);
    act(() => renderer.root.findByProps({ testID: "primary-navigation-expand" }).props.onPress());
    expect(jest.mocked(withTiming)).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-navigation-frame" }).props.style).width).toBe(332);
  });

  it("uses a red morph glyph and frosted lens independently of screen chrome tone", () => {
    const { renderer } = renderTabBar();
    expect(renderer.root.findByProps({ testID: "primary-tab-active-icon" }).props.color).toBe(GLASS_MATERIAL.active);
    expect(renderer.root.findByProps({ testID: "primary-tab-indicator" }).props.pointerEvents).toBe("none");
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-indicator" }).props.style).height).toBe(50);
    act(() => useSystemChromeStore.getState().setPrimaryNavigationTone("light"));
    expect(renderer.root.findByProps({ testID: "primary-tab-active-icon" }).props.color).toBe(GLASS_MATERIAL.active);
  });

  it("corrects layout without springing from a stale viewport and preserves the active glyph", () => {
    const { navigation, renderer } = renderTabBar();
    const glyph = renderer.root.findAllByType(AppIcon).find((icon) => icon.props.testID === "primary-tab-active-icon");
    const surface = () => renderer.root.findByProps({ testID: "primary-tab-surface" });
    act(() => surface().props.onLayout({ nativeEvent: { layout: { width: 320 } } }));
    expect(StyleSheet.flatten(surface().props.style).width).toBe(320);
    mockViewportWidth = 800;
    jest.mocked(withSpring).mockClear();
    act(() => renderer.update(<FloatingTabBar state={{ index: 2, routes }} descriptors={descriptors} navigation={navigation} />));
    expect(StyleSheet.flatten(surface().props.style).width).toBe(420);
    expect(withSpring).not.toHaveBeenCalled();
    expect(renderer.root.findAllByType(AppIcon).find((icon) => icon.props.testID === "primary-tab-active-icon")).toBe(glyph);
  });

  it("selects haptic feedback only for accepted new destinations", () => {
    const { navigation, renderer } = renderTabBar();
    act(() => getTab(renderer, "profile").props.onPress());
    navigation.emit.mockReturnValueOnce({ defaultPrevented: true });
    act(() => getTab(renderer, "shop").props.onPress());
    expect(mockHaptic).not.toHaveBeenCalled();
    act(() => getTab(renderer, "shop").props.onPress());
    expect(mockHaptic).toHaveBeenCalledTimes(Platform.OS === "web" ? 0 : 1);
  });

  it("keeps the actual bar blur static beneath its visuals and hit layer through rapid retarget", () => {
    const { navigation, renderer } = renderTabBar({ blurTarget: { current: {} as View } });
    const capsule = renderer.root.findAllByProps({ testID: "primary-tab-capsule" }).at(-1)!;
    expect(capsule.children.indexOf(capsule.findByType(NavigationBarBackdrop))).toBe(0);
    expect(StyleSheet.flatten(capsule.props.style)).toMatchObject({ overflow: "hidden", backgroundColor: "transparent" });
    const blur = renderer.root.findByType(BlurView);
    const glyph = renderer.root.findAllByType(AppIcon).find((icon) => icon.props.testID === "primary-tab-active-icon");
    act(() => {
      getTab(renderer, "shop").props.onPress();
      getTab(renderer, "settings").props.onPress();
    });
    expect(renderer.root.findByType(BlurView) === blur).toBe(true);
    expect(blur.props).toMatchObject({ intensity: 55, blurMethod: "dimezisBlurViewSdk31Plus", pointerEvents: "none", importantForAccessibility: "no-hide-descendants" });
    expect(renderer.root.findAllByType(AppIcon).find((icon) => icon.props.testID === "primary-tab-active-icon") === glyph).toBe(true);
    expect(glyph?.props.name).toBe("navMore");
    expect(navigation.navigate.mock.calls).toEqual([["shop"], ["settings"]]);
    expect(new Set(renderer.root.findAll((node) => node.props.accessibilityRole === "tab").map((node) => node.props.testID)).size).toBe(5);
  });

  it("retains the same bar and last primary morph glyph hidden across secondary/back without remount or replay", () => {
    jest.useFakeTimers();
    const { navigation, renderer } = renderTabBar();
    const allRoutes = [...routes, { key: "history-key", name: "history" }];
    act(() => renderer.update(<FloatingTabBar state={{ index: 1, routes: allRoutes }} descriptors={descriptors} navigation={navigation} />));
    act(() => jest.advanceTimersByTime(500));
    const getGlyph = () => renderer.root.findAllByType(AppIcon).find((icon) => icon.props.testID === "primary-tab-active-icon");
    const glyph = getGlyph();
    const surface = renderer.root.findByProps({ testID: "primary-tab-surface" });
    expect(glyph?.props.name).toBe("navShop");
    act(() => getTab(renderer, "shop").props.onPressIn());
    expect(renderer.root.findAllByType(PressFeedback).some((node) => node.props.pressed)).toBe(true);
    mockMorphSet.mockClear(); mockMorphUnmount.mockClear(); jest.mocked(withSpring).mockClear(); navigation.emit.mockClear();

    act(() => renderer.update(<FloatingTabBar state={{ index: 5, routes: allRoutes }} descriptors={descriptors} navigation={navigation} />));
    expect(getGlyph() === glyph).toBe(true);
    expect(renderer.root.findAllByProps({ testID: "primary-tab-surface" }).some((node) => node === surface)).toBe(true);
    expect(getGlyph()?.props.name).toBe("navShop");
    const bar = renderer.root.findByProps({ testID: "primary-tab-bar" });
    expect(bar.props).toMatchObject({ pointerEvents: "none", accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", "aria-hidden": true });
    expect(StyleSheet.flatten(bar.props.style).opacity).toBe(0);
    expect(renderer.root.findAllByType(PressFeedback).every((node) => !node.props.pressed)).toBe(true);
    act(() => getTab(renderer, "settings").props.onPress());
    expect(navigation.emit).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(500));
    expect(mockMorphUnmount).not.toHaveBeenCalled();
    expect(mockMorphSet).not.toHaveBeenCalled();

    act(() => renderer.update(<FloatingTabBar state={{ index: 1, routes: allRoutes }} descriptors={descriptors} navigation={navigation} />));
    expect(getGlyph() === glyph).toBe(true);
    expect(getGlyph()?.props.name).toBe("navShop");
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: "primary-tab-bar" }).props.style).opacity).toBe(1);
    act(() => jest.advanceTimersByTime(500));
    expect(mockMorphUnmount).not.toHaveBeenCalled();
    expect(mockMorphSet).not.toHaveBeenCalled();
    expect(withSpring).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
