import React from "react";
import { StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import BundleItem from "~/components/BundleItem";
import NightMarketCard from "~/components/NightMarketItem";
import SkinShowcaseCard from "~/components/SkinShowcaseCard";
import { CachedImage } from "~/components/CachedImage";
import { MORE_GLASS_MATERIAL, SPACING } from "~/constants/DesignSystem";
import { buildSkinPreviewMedia } from "~/utils/skin-preview";
import type { MediaPopupEntry } from "~/components/popups/MediaPopup";

const mockPreview = jest.fn<void, [MediaPopupEntry[], string]>();
const mockToggle = jest.fn();

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const copy = Object.create(null, Object.getOwnPropertyDescriptors(actual));
  Object.defineProperty(copy, "Pressable", { value: "MockPressable", configurable: true });
  return copy;
});
jest.mock("react-native-reanimated", () => {
  const { View, Easing } = jest.requireActual("react-native");
  return {
    __esModule: true, default: { View }, Easing, ReduceMotion: { System: "system" },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withSpring: (value: number) => value, withTiming: (value: number) => value,
    withSequence: (...values: number[]) => values.at(-1),
  };
});
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => true }));
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/CurrencyIcon", () => ({ __esModule: true, default: "CurrencyIcon" }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/GalleryProfile", () => ({ WEAPON_NAME_ORDER: ["Vandal"] }));
jest.mock("~/components/popups/MediaPopup", () => ({
  useMediaPopupStore: <T,>(selector: (state: { showMediaPopup: typeof mockPreview }) => T) =>
    selector({ showMediaPopup: mockPreview }),
}));
jest.mock("~/hooks/useWishlistStore", () => ({
  useWishlistStore: <T,>(selector: (state: { skinIds: string[]; toggleSkin: typeof mockToggle }) => T) =>
    selector({ skinIds: [], toggleSkin: mockToggle }),
}));
jest.mock("~/hooks/useFeatureStore", () => ({
  useFeatureStore: <T,>(selector: (state: { screenshotModeEnabled: boolean }) => T) =>
    selector({ screenshotModeEnabled: false }),
}));
jest.mock("~/utils/misc", () => ({ getDisplayIconUri: (item: { displayIcon?: string }) => item.displayIcon }));
jest.mock("expo-haptics", () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success" } }));

// Commerce flow was explored by Main with ARTEMIS before this suite was authored.
// Before evidence: ~/.codex/artifacts/vshop-skin-preview-20261005/viewer-before.png + XML.
// These component tests verify the handoff; Main owns sheet/device verification.
const skin: SkinShopItem = {
  uuid: "commerce-skin", displayName: "Preview Vandal", themeUuid: "theme", assetPath: "skin",
  price: 1775, originalPrice: 2175, contentTierUuid: "0cebb8be-46d7-c12a-d306-e9907bfc5a25",
  displayIcon: "https://example.com/skin.png",
  levels: [{ uuid: "commerce-level", displayName: "Level 1", assetPath: "level",
    displayIcon: "https://example.com/level.png", streamedVideo: "https://example.com/level.mp4" }],
  chromas: [{ uuid: "commerce-chroma", displayName: "Blue", assetPath: "chroma",
    fullRender: "https://example.com/blue.png", swatch: "https://example.com/blue-swatch.png",
    streamedVideo: "https://example.com/blue.mp4" }],
};
const accessory: AccessoryShopItem = {
  uuid: "commerce-accessory", displayName: "Preview Buddy", price: 475, originalPrice: 575,
  displayIcon: "https://example.com/buddy.png",
};
const renderers: TestRenderer.ReactTestRenderer[] = [];

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
}
function buttons(root: TestRenderer.ReactTestInstance) {
  return root.findAll((node) => typeof node.type === "string" && node.props.accessibilityRole === "button");
}
function cell(root: TestRenderer.ReactTestInstance) {
  return root.findAll((node) => node.props.testID === "bundle-item-cell"
    && (typeof node.type === "string" || node.type === View))[0];
}
function texts(root: TestRenderer.ReactTestInstance) {
  return root.findAllByType(Text).map((node) => node.props.children);
}
function mountSource(source: "store" | "night" | "bundle", item = skin) {
  if (source === "store") return render(<SkinShowcaseCard item={item} />);
  if (source === "night") return render(<NightMarketCard item={{ ...item, discountedPrice: 1000, discountPercent: 35 }} width={180} cardHeight={190} />);
  return render(<BundleItem item={item} width={84} owned />);
}

beforeEach(() => { jest.useFakeTimers(); mockPreview.mockClear(); mockToggle.mockClear(); });
afterEach(() => {
  act(() => renderers.splice(0).forEach((renderer) => renderer.unmount()));
  jest.useRealTimers();
});

it.each(["store", "night", "bundle"] as const)("%s hands off real still/video/swatch/tier metadata with the unchanged two-argument API", (source) => {
  const root = mountSource(source).root;
  const targets = buttons(root);
  expect(targets).toHaveLength(1);
  act(() => targets[0].props.onPress());
  if (source === "store") {
    act(() => jest.advanceTimersByTime(219));
    expect(mockPreview).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
  }
  expect(mockPreview).toHaveBeenCalledTimes(1);
  expect(mockPreview.mock.calls[0]).toHaveLength(2);
  const [entries, title] = mockPreview.mock.calls[0];
  expect(title).toBe(skin.displayName);
  expect(entries).toEqual(buildSkinPreviewMedia(skin));
  expect(entries).toEqual([
    expect.objectContaining({ cacheId: "skin-level:commerce-level:media", group: "level", kind: "video",
      uri: skin.levels[0].streamedVideo, label: "Level 1", imageUri: skin.levels[0].displayIcon,
      imageCacheId: expect.any(String), videoUri: skin.levels[0].streamedVideo, contentTierUuid: skin.contentTierUuid }),
    expect.objectContaining({ cacheId: "skin-chroma:commerce-chroma:media", group: "chroma", kind: "video",
      uri: skin.chromas[0].streamedVideo, label: "Blue", imageUri: skin.chromas[0].fullRender,
      imageCacheId: expect.any(String), videoUri: skin.chromas[0].streamedVideo,
      swatchUri: skin.chromas[0].swatch, contentTierUuid: skin.contentTierUuid }),
  ]);
  expect(mockToggle).not.toHaveBeenCalled();
});

it("Night Market includes real variants even when there are no levels", () => {
  const item = { ...skin, levels: [] };
  const target = buttons(mountSource("night", item).root)[0];
  expect(target.props.disabled).toBe(false);
  act(() => target.props.onPress());
  expect(mockPreview).toHaveBeenCalledWith(buildSkinPreviewMedia(item), item.displayName);
  expect(mockPreview.mock.calls[0][0]).toEqual([expect.objectContaining({ group: "chroma", imageUri: skin.chromas[0].fullRender })]);
});

it.each(["store", "night", "bundle"] as const)("%s preserves image-only level/chroma identities without requiring video", (source) => {
  const item: SkinShopItem = { ...skin,
    levels: [{ ...skin.levels[0], streamedVideo: undefined }],
    chromas: [{ ...skin.chromas[0], streamedVideo: undefined }],
  };
  const root = mountSource(source, item).root;
  act(() => buttons(root)[0].props.onPress());
  act(() => jest.advanceTimersByTime(220));
  expect(mockPreview).toHaveBeenCalledWith([
    expect.objectContaining({ cacheId: "skin-level:commerce-level:media", kind: "image", uri: item.levels[0].displayIcon }),
    expect.objectContaining({ cacheId: "skin-chroma:commerce-chroma:media", kind: "image", uri: item.chromas[0].fullRender }),
  ], item.displayName);
  expect(mockToggle).not.toHaveBeenCalled();
});

it("Bundle keeps accessories display-only even when artwork exists", () => {
  const root = render(<BundleItem item={accessory} width={84} owned />).root;
  expect(buttons(root)).toHaveLength(0);
  expect(cell(root).type).toBe(View);
  expect(cell(root).props.accessibilityRole).toBe("text");
  expect(cell(root).props.onPress).toBeUndefined();
  expect(mockPreview).not.toHaveBeenCalled();
});

it("Bundle rejects a malformed non-array levels property instead of turning an accessory into a viewer", () => {
  const item = { ...accessory, levels: { uuid: "not-a-level-array" } };
  const root = render(<BundleItem item={item} width={84} />).root;
  expect(buttons(root)).toHaveLength(0);
  expect(cell(root).props.accessibilityRole).toBe("text");
});

it("Bundle stays display-only when an actual skin has no preview entries", () => {
  const item: SkinShopItem = { ...skin, displayIcon: undefined, levels: [], chromas: [] };
  expect(buildSkinPreviewMedia(item)).toEqual([]);
  const root = render(<BundleItem item={item} width={84} />).root;
  expect(buttons(root)).toHaveLength(0);
  expect(cell(root).props.accessibilityRole).toBe("text");
  expect(mockPreview).not.toHaveBeenCalled();
});

it("Bundle skin preview retains the accessory cell geometry, prices and ownership overlay", () => {
  const root = mountSource("bundle").root;
  const accessoryRoot = render(<BundleItem item={accessory} width={84} owned />).root;
  expect(StyleSheet.flatten(cell(root).props.style)).toEqual(StyleSheet.flatten(cell(accessoryRoot).props.style));
  expect(StyleSheet.flatten(cell(root).props.style)).toMatchObject({ width: 84, minWidth: 48, minHeight: 48, borderRadius: MORE_GLASS_MATERIAL.radius, overflow: "hidden" });
  const image = root.findByType(CachedImage);
  expect(image.props).toMatchObject({ cacheId: "bundle-item:commerce-skin:display", contentFit: "contain", source: { uri: skin.displayIcon } });
  expect(StyleSheet.flatten(image.parent!.props.style)).toMatchObject({ aspectRatio: 2.1, padding: SPACING.xxs });
  expect(texts(root)).toEqual([skin.displayName, "2.175", "1.775"]);
  expect(cell(root).props.accessibilityLabel).toContain("bundles_page.purchased");
  for (const testID of ["bundle-item-owned-overlay", "bundle-item-owned-check"]) {
    expect(root.findAllByType(View).find((node) => node.props.testID === testID)?.props.pointerEvents).toBe("none");
  }
  act(() => buttons(root)[0].props.onPress());
  expect(mockPreview).toHaveBeenCalledTimes(1);
  expect(mockToggle).not.toHaveBeenCalled();
});

it("Store double tap still toggles wishlist once and cancels preview", () => {
  const root = mountSource("store").root;
  act(() => buttons(root)[0].props.onPress());
  act(() => jest.advanceTimersByTime(100));
  act(() => buttons(root)[0].props.onPress());
  act(() => jest.advanceTimersByTime(500));
  expect(mockToggle).toHaveBeenCalledTimes(1);
  expect(mockToggle).toHaveBeenCalledWith(skin.levels[0].uuid);
  expect(mockPreview).not.toHaveBeenCalled();
});

it("Store unmount cancels a pending preview", () => {
  const renderer = mountSource("store");
  act(() => buttons(renderer.root)[0].props.onPress());
  act(() => renderer.unmount());
  act(() => jest.advanceTimersByTime(220));
  expect(mockPreview).not.toHaveBeenCalled();
  expect(mockToggle).not.toHaveBeenCalled();
});

it.each(["store", "night"] as const)("%s avoids opening an empty viewer", (source) => {
  const item: SkinShopItem = { ...skin, displayIcon: undefined, levels: [], chromas: [] };
  const target = buttons(mountSource(source, item).root)[0];
  if (source === "night") {
    expect(target.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  }
  act(() => target.props.onPress());
  act(() => jest.advanceTimersByTime(220));
  expect(mockPreview).not.toHaveBeenCalled();
});

it.each(["store", "night", "bundle"] as const)("%s refresh uses the latest whole item including tier metadata", (source) => {
  const renderer = mountSource(source);
  const refreshed = { ...skin, contentTierUuid: "e046854e-406c-37f4-6607-19a9ba8426fc", displayIcon: "https://example.com/refreshed.png" };
  act(() => {
    if (source === "store") renderer.update(<SkinShowcaseCard item={refreshed} />);
    else if (source === "night") renderer.update(<NightMarketCard item={{ ...refreshed, discountedPrice: 1000, discountPercent: 35 }} width={180} cardHeight={190} />);
    else renderer.update(<BundleItem item={refreshed} width={84} owned />);
  });
  act(() => buttons(renderer.root)[0].props.onPress());
  act(() => jest.advanceTimersByTime(220));
  expect(mockPreview).toHaveBeenCalledWith(buildSkinPreviewMedia(refreshed), refreshed.displayName);
  for (const entry of mockPreview.mock.calls[0][0]) {
    expect(entry).toMatchObject({ contentTierUuid: refreshed.contentTierUuid });
  }
});

it("Night Market preview preserves explicit frame width, measured fit and contain artwork", () => {
  const root = mountSource("night").root;
  const image = root.findByType(CachedImage);
  expect(image.props).toMatchObject({ contentFit: "contain", transition: 0, cacheId: "skin:commerce-skin:display" });
  expect(StyleSheet.flatten(image.parent!.props.style)).toMatchObject({ width: 178, height: 178 / 1.5 });
  const content = root.findAllByType(View).find((node) => node.props.testID === "night-market-item-content")!;
  act(() => content.props.onLayout({ nativeEvent: { layout: { width: 178, height: 96, x: 0, y: 0 } } }));
  expect(StyleSheet.flatten(root.findByType(CachedImage).parent!.props.style)).toMatchObject({ width: 178, height: 92 });
  expect(texts(root)).toContain(1000);
  expect(texts(root)).toContain(1775);
});
