import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
  FloatingTabBar,
  PRIMARY_TAB_SCREEN_OPTIONS,
} from "~/app/(authenticated)/_layout";

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
  it("mounts primary screens on demand and freezes inactive tabs", () => {
    expect(PRIMARY_TAB_SCREEN_OPTIONS).toEqual({
      lazy: true,
      freezeOnBlur: true,
    });
  });

  const renderTabBar = () => {
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented: false })),
      navigate: jest.fn(),
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
});
