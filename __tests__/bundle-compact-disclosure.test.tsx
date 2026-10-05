import React from "react";
import { AccessibilityInfo, FlatList, ScrollView, StyleSheet, type ViewProps, type ViewStyle } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { cancelAnimation, withTiming } from "react-native-reanimated";
import { GlassClip } from "~/components/ui/refractive-glass";
import BundleImage from "~/components/BundleImage";
import AppIcon from "~/components/ui/AppIcon";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { MOTION_TIMING } from "~/constants/Motion";
import { SPACING } from "~/constants/DesignSystem";

jest.mock("~/components/popups/MediaPopup", () => ({ useMediaPopupStore: () => jest.fn() }));

jest.mock("~/components/ui/refractive-glass", () => {
  const native = require("react-native");
  const react = require("react") as typeof React;
  function Clip(props: ViewProps) { return react.createElement(native.View, props); }
  return { RefractiveGlassCard: native.View, GlassClip: Clip, GlassFlatList: native.FlatList };
});

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, options?: { count: number }) =>
    key === "bundles_page.items_count" ? `${options?.count} items` : key }),
}));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/ui/AppViewport", () => ({
  useAppWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1, scale: 3 }),
}));
jest.mock("react-native-reanimated", () => {
  const react = require("react") as typeof React;
  return {
    __esModule: true, default: { View: require("react-native").View },
    ReduceMotion: { System: "system" },
    Easing: { out: () => undefined, inOut: () => undefined, cubic: () => undefined, bezier: () => undefined },
    useReducedMotion: () => false,
    useDerivedValue: (factory: () => number) => Object.defineProperty({}, "value", { get: factory }),
    useSharedValue: (value: number) => react.useRef({ value }).current,
    // Read the latest shared value when inspecting the rendered native style.
    useAnimatedStyle: (factory: () => Record<string, unknown>) =>
      Object.defineProperties({}, Object.fromEntries(Object.keys(factory()).map((key) =>
        [key, { enumerable: true, get: () => factory()[key] }]))),
    cancelAnimation: jest.fn(), withTiming: jest.fn((value: number) => value),
  };
});

const item: AccessoryShopItem = {
  uuid: "compact-item", displayName: "Compact card", price: 1_000_000,
  originalPrice: 2_000_000, displayIcon: "https://example.com/card.png",
};
const bundle: BundleShopItem = {
  uuid: "compact-bundle", displayName: "Compact bundle", description: "",
  useAdditionalContext: false, assetPath: "", displayIcon: "https://example.com/hero.png",
  displayIcon2: "", price: 5310, originalPrice: 6640, items: [item],
};
let mockMotionListener: ((reduced: boolean) => void) | undefined;
const mockRemove = jest.fn();
let renderer: TestRenderer.ReactTestRenderer | undefined;
// Narrow the native overloaded API to the boolean event this test observes.
const motionInfo: {
  addEventListener: (event: "reduceMotionChanged", listener: (reduced: boolean) => void) => { remove: () => void };
} = AccessibilityInfo;

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  jest.spyOn(motionInfo, "addEventListener").mockImplementation((event, listener) => {
    if (event === "reduceMotionChanged") mockMotionListener = listener;
    return { remove: mockRemove };
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

async function mount(current = bundle) {
  await act(async () => { renderer = TestRenderer.create(<BundleImage bundle={current} remainingSecs={3600} />); });
  return renderer!.root;
}
function button() { return renderer!.root.findByProps({ testID: "bundle-item-toggle" }); }
function panel() { return renderer!.root.findByProps({ testID: "bundle-item-disclosure" }); }
function panelStyle() { return StyleSheet.flatten(panel().props.style) as ViewStyle; }
function measure(height: number) {
  act(() => renderer!.root.findByProps({ testID: "bundle-item-measure" }).props.onLayout({
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height } },
  }));
}
function toggle() { act(() => button().props.onPress()); }

it("starts collapsed below the visible summary with a labeled 48dp expanded-state button", async () => {
  const root = await mount();
  const buttons = root.findAll((node) => typeof node.type === "string" && node.props.accessibilityRole === "button");
  expect(buttons).toHaveLength(1);
  expect(button().props).toMatchObject({ accessibilityRole: "button", accessibilityState: { expanded: false } });
  expect(button().props.accessibilityLabel).toContain("Compact bundle");
  expect(button().props.accessibilityLabel).toContain("1 items");
  expect(root.findAllByType(AppIcon).map((icon) => icon.props.name)).toContain("chevronDown");
  expect(StyleSheet.flatten(button().props.style).minHeight).toBeGreaterThanOrEqual(48);
  expect(StyleSheet.flatten(button().props.style).minWidth).toBeGreaterThanOrEqual(48);
  expect(panel().props).toMatchObject({ pointerEvents: "none", accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants" });
  expect(panelStyle().height).toBe(0);
  const texts = root.findAll((node) => typeof node.type === "string").map((node) => node.props.children);
  expect(texts).toEqual(expect.arrayContaining(["Compact bundle", "5.310", "6.640"]));
  const hosts = root.findAll((node) => typeof node.type === "string");
  expect(hosts.findIndex((node) => node.props.children === "Compact bundle")).toBeLessThan(
    hosts.findIndex((node) => node.props.testID === "bundle-item-disclosure"));
});

it("opens measured compact items downward, closes and reopens without remounting items or list", async () => {
  const root = await mount();
  measure(156);
  const cell = root.findAllByProps({ testID: "bundle-item-cell" })[0];
  const carousel = root.findByProps({ testID: "bundle-item-carousel" });
  const nativeList = root.findByType(FlatList);
  const nativeScrollOwner = root.findByType(ScrollView);
  toggle();
  expect(button().props.accessibilityState.expanded).toBe(true);
  expect(root.findAllByType(AppIcon).map((icon) => icon.props.name)).toContain("chevronUp");
  expect(panel().props).toMatchObject({ pointerEvents: "auto", accessibilityElementsHidden: false,
    importantForAccessibility: "auto" });
  expect(panelStyle().height).toBe(156);
  expect(carousel.props).toMatchObject({ horizontal: true, nestedScrollEnabled: true });
  expect(withTiming).toHaveBeenLastCalledWith(1, MOTION_TIMING.standard);
  expect(root.findByProps({ testID: "bundle-item-measure" }).props.style).toBeDefined();
  toggle();
  expect(panelStyle().height).toBe(0);
  expect(panel().props.pointerEvents).toBe("none");
  expect(button().props.accessibilityState.expanded).toBe(false);
  toggle();
  expect(root.findByProps({ testID: "bundle-item-carousel" })).toBe(carousel);
  expect(root.findByType(FlatList)).toBe(nativeList);
  expect(root.findByType(ScrollView)).toBe(nativeScrollOwner);
  expect(root.findAllByProps({ testID: "bundle-item-cell" })[0]).toBe(cell);
  expect(root.findByProps({ cacheId: "bundle-item:compact-item:display" }).props.recyclingKey).toBe(item.uuid);
});

it("retains disclosure through same-bundle refresh and resets immediately when reused for another identity", async () => {
  const root = await mount(); measure(156); toggle();
  const carousel = root.findByProps({ testID: "bundle-item-carousel" });
  act(() => renderer!.update(<BundleImage bundle={{ ...bundle, price: 4800 }} remainingSecs={3600} />));
  expect(button().props.accessibilityState.expanded).toBe(true);
  expect(root.findByProps({ testID: "bundle-item-carousel" })).toBe(carousel);
  act(() => renderer!.update(<BundleImage bundle={{ ...bundle, uuid: "next-bundle" }} remainingSecs={3600} />));
  expect(button().props.accessibilityState.expanded).toBe(false);
  expect(panelStyle().height).toBe(0);
  expect(panel().props.pointerEvents).toBe("none");
  expect(panel().props.accessibilityElementsHidden).toBe(true);
});

it("locks accessibility and touch immediately even while close animation is still in flight", async () => {
  await mount(); measure(156); toggle();
  jest.mocked(withTiming).mockReturnValueOnce(1);
  toggle();
  expect(panelStyle().height).toBe(156);
  expect(panel().props).toMatchObject({ pointerEvents: "none", accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants" });
});

it("slides only the measured item region downward and accommodates new natural content height", async () => {
  const root = await mount(); measure(156);
  jest.mocked(withTiming).mockReturnValueOnce(0.5);
  toggle();
  expect(panelStyle().height).toBe(78);
  expect(root.findAllByType(GlassClip)).toHaveLength(0);
  expect(panelStyle().overflow).toBe("hidden");
  const contentStyle = StyleSheet.flatten(root.findByProps({ testID: "bundle-item-measure" }).props.style) as ViewStyle;
  expect(contentStyle.transform).toEqual([{ translateY: -SPACING.sm / 2 }]);
  expect(contentStyle.opacity).toBeUndefined();
  expect(panelStyle().opacity).toBeUndefined();
  expect(StyleSheet.flatten(root.findByProps({ testID: "bundle-card" }).props.style).transform).toBeUndefined();
  // Retarget a rapid close/reopen; the content stays mounted at its updated size.
  toggle(); toggle(); measure(212);
  expect(panelStyle().height).toBe(212);
  const settled = StyleSheet.flatten(root.findByProps({ testID: "bundle-item-measure" }).props.style) as ViewStyle;
  expect(settled.transform).toEqual([{ translateY: expect.closeTo(0) }]);
  toggle(); measure(240);
  expect(panelStyle().height).toBe(0);
  expect(root.findAllByType(GlassClip)).toHaveLength(0);
  toggle(); expect(panelStyle().height).toBe(240);
});

it("honors the native initial Reduce Motion value and keeps empty disclosure bounded", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
  await mount({ ...bundle, items: [] }); measure(24);
  const timings = jest.mocked(withTiming).mock.calls.length;
  toggle();
  expect(panelStyle().height).toBe(24);
  expect(renderer!.root.findByProps({ testID: "bundle-item-carousel" }).props.data).toEqual([]);
  toggle();
  expect(panelStyle().height).toBe(0);
  expect(withTiming).toHaveBeenCalledTimes(timings);
});

it("falls back to FlatList content height when its closed holder reports zero without truncating resized content", async () => {
  const root = await mount();
  measure(0);
  const carousel = root.findByProps({ testID: "bundle-item-carousel" });
  act(() => carousel.props.onContentSizeChange(360, 156));
  toggle();
  expect(panelStyle().height).toBe(156);
  measure(0);
  act(() => carousel.props.onContentSizeChange(0, 0));
  expect(panelStyle().height).toBe(156);
  act(() => carousel.props.onContentSizeChange(360, 280));
  expect(panelStyle().height).toBe(280);
});

it("settles an in-flight reveal on live native Reduce Motion and cancels animation on unmount", async () => {
  await mount(); measure(156);
  jest.mocked(withTiming).mockReturnValueOnce(0);
  toggle();
  expect(panelStyle().height).toBe(0);
  const before = jest.mocked(withTiming).mock.calls.length;
  act(() => mockMotionListener!(true));
  expect(panelStyle().height).toBe(156);
  toggle();
  expect(panelStyle().height).toBe(0);
  expect(withTiming).toHaveBeenCalledTimes(before);
  act(() => mockMotionListener!(false));
  toggle();
  expect(withTiming).toHaveBeenLastCalledWith(1, MOTION_TIMING.standard);
  const cancellations = jest.mocked(cancelAnimation).mock.calls.length;
  act(() => renderer!.unmount()); renderer = undefined;
  expect(jest.mocked(cancelAnimation).mock.calls.length).toBeGreaterThan(cancellations);
  expect(mockRemove).toHaveBeenCalled();
});

it("keeps refreshed ownership, all long VP digits and screenshot hero behavior while disclosure is retained", async () => {
  const root = await mount(); measure(156); toggle(); toggle();
  const owned = (candidate: SkinShopItem | AccessoryShopItem) => candidate.uuid === item.uuid;
  act(() => renderer!.update(<BundleImage bundle={bundle} remainingSecs={3600} isOwned={owned} />));
  expect(root.findAllByProps({ testID: "bundle-item-owned-overlay" }).length).toBeGreaterThan(0);
  toggle();
  const texts = root.findAll((node) => typeof node.type === "string").map((node) => node.props.children);
  expect(texts).toEqual(expect.arrayContaining(["1.000.000", "2.000.000"]));
  const originalMode = useFeatureStore.getState().screenshotModeEnabled;
  try {
    act(() => useFeatureStore.setState({ screenshotModeEnabled: true }));
    expect(root.findByProps({ cacheId: "bundle:compact-bundle:hero:displayIcon" }).props.source).toEqual(
      require("~/assets/images/noimage.png"));
    expect(button().props.accessibilityState.expanded).toBe(true);
  } finally { act(() => useFeatureStore.setState({ screenshotModeEnabled: originalMode })); }
});
