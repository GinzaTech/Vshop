import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import NightMarket from "~/app/(authenticated)/night_market";
import NightMarketItem from "~/components/NightMarketItem";
import { CachedImage } from "~/components/CachedImage";
import { COLORS } from "~/constants/DesignSystem";
import { getGlassNavigationMetrics } from "~/features/navigation/navigation-model";

let mockDimensions = { width: 411, height: 914, fontScale: 1, scale: 2.625 };
const mockRefresh = jest.fn();
const mockPreview = jest.fn();
const offers: NightMarketItem[] = Array.from({ length: 6 }, (_, index) => ({
  uuid: `night-${index}`, displayName: `Offer ${index} Vandal`, themeUuid: "theme", assetPath: "asset",
  contentTierUuid: "0cebb8be-46d7-c12a-d306-e9907bfc5a25", price: 1775, discountedPrice: 1000,
  discountPercent: 35, displayIcon: `https://example.com/skin-${index}.png`, chromas: [],
  levels: [{ uuid: `level-${index}`, displayName: "Level", assetPath: "asset", displayIcon: `https://example.com/level-${index}.png` }],
}));
let mockOffers = offers;
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const copy = Object.create(null, Object.getOwnPropertyDescriptors(actual));
  Object.defineProperty(copy, "Pressable", { value: "MockPressable", configurable: true });
  return copy;
});
jest.mock("~/constants/Motion", () => ({ NAV_MOTION: {} }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => mockDimensions }));
jest.mock("~/components/ui/AppIcon", () => "AppIcon");
jest.mock("~/components/Countdown", () => "Countdown");
jest.mock("~/components/CurrencyIcon", () => "CurrencyIcon");
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/EmptyStateCard", () => "EmptyStateCard");
jest.mock("~/components/ui/AppRefreshControl", () => "AppRefreshControl");
jest.mock("~/hooks/useFeatureStore", () => ({ useFeatureStore: () => false }));
jest.mock("~/components/popups/MediaPopup", () => ({ useMediaPopupStore: () => mockPreview }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({}) }));
jest.mock("~/utils/app-sync", () => ({ refreshShopAndBalances: (...args: unknown[]) => mockRefresh(...args) }));
jest.mock("~/hooks/useAsyncRefresh", () => ({ useAsyncRefresh: (task: () => unknown) => ({ refreshing: false, onRefresh: task }) }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: () => ({ name: "Player", balances: { vp: 1775 },
  shops: { nightMarket: mockOffers, remainingSecs: { nightMarket: 60 } } }) }));

let renderer: TestRenderer.ReactTestRenderer;
function mount() { act(() => { renderer = TestRenderer.create(<NightMarket />); }); return renderer.root; }
function layout(width: number, height: number, y = 0) { return { nativeEvent: { layout: { x: 0, y, width, height } } }; }
function measure(root: TestRenderer.ReactTestInstance, viewportHeight = 850, gridTop = 140, footerHeight = 48) {
  expect(root.findByType(ScrollView).props.onLayout).toEqual(expect.any(Function));
  act(() => root.findByType(ScrollView).props.onLayout(layout(mockDimensions.width, viewportHeight)));
  act(() => root.findAllByProps({ testID: "night-market-grid" })[0].props.onLayout(layout(mockDimensions.width - 40, 0, gridTop)));
  act(() => root.findAllByProps({ testID: "night-market-info" })[0].props.onLayout(layout(mockDimensions.width - 40, footerHeight)));
  root.findAllByProps({ testID: "night-market-item-content" }).filter((node) => node.type === View).forEach((content) =>
    act(() => content.props.onLayout(layout(181, 96))));
}
function expectNaturalArtwork(root: TestRenderer.ReactTestInstance) {
  root.findAllByType(CachedImage).forEach((image) => {
    const frame = StyleSheet.flatten(image.parent!.props.style);
    expect(frame.height).toBe(frame.width / 1.5);
    expect(frame.aspectRatio).toBeUndefined();
  });
}
afterEach(() => { act(() => renderer?.unmount()); mockDimensions = { width: 411, height: 914, fontScale: 1, scale: 2.625 }; mockOffers = offers; });

it("Night Market uses two equal columns for all six phone offers", () => {
  const root = mount();
  const cards = root.findAllByType(NightMarketItem);
  expect(cards).toHaveLength(6);
  expect(cards.map((card) => card.props.width)).toEqual(Array(6).fill(181));
  const grid = root.findAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.flexWrap === "wrap")!;
  expect(StyleSheet.flatten(grid.props.style)).toMatchObject({ gap: 8, flexDirection: "row", flexWrap: "wrap" });
});

it.each([false, true])("Night artwork frame fills the card width with measured height=%s and anchors both badges to that frame", (measured) => {
  const root = mount();
  if (measured) measure(root);
  const images = root.findAllByType(CachedImage);
  expect(images).toHaveLength(6);
  images.forEach((image, index) => {
    const frame = image.parent!;
    const style = StyleSheet.flatten(frame.props.style);
    const innerWidth = root.findAllByType(NightMarketItem)[index].props.width - 2;
    expect(style).toMatchObject({ width: innerWidth, alignSelf: "stretch", position: "relative" });
    expect(style.aspectRatio).toBeUndefined();
    if (measured) {
      expect(style.height).toBeGreaterThan(0);
      expect(style.aspectRatio).toBeUndefined();
    } else {
      expect(style.height).toBe(innerWidth / 1.5);
    }
    expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: "100%", height: "100%" });
    expect(image.props.contentFit).toBe("contain");
    const badgeStyles = frame.findAllByType(Text).map((badge) => StyleSheet.flatten(badge.parent!.props.style));
    expect(badgeStyles).toEqual(expect.arrayContaining([
      expect.objectContaining({ position: "absolute", left: 4, top: 4 }),
      expect.objectContaining({ position: "absolute", right: 4, top: 4 }),
    ]));
  });
});

it("fits three measured rows above navigation without imposing clipping heights on text or disabling refresh", () => {
  const root = mount();
  measure(root);
  const clearance = getGlassNavigationMetrics(411, 24).contentBottomPadding;
  const rowBudget = Math.floor((850 - 140 - 48 - clearance - 8 - 16) / 3);
  const images = root.findAllByType(CachedImage);
  expect(images).toHaveLength(6);
  images.forEach((image) => {
    const art = StyleSheet.flatten(image.parent!.props.style);
    expect(art.height).toBe(rowBudget - 96 - 2);
    expect(art.aspectRatio).toBeUndefined();
    expect(image.props).toMatchObject({ contentFit: "contain", transition: 0, cachePolicy: "memory-disk" });
  });
  expect(140 + rowBudget * 3 + 16 + 8 + 48 + clearance).toBeLessThanOrEqual(850);
  const buttons = root.findAllByType(Pressable);
  expect(buttons).toHaveLength(6);
  buttons.forEach((card) => {
    const style = StyleSheet.flatten(card.props.style({ pressed: false }));
    expect(style.height).toBeUndefined();
    expect(style.maxHeight).toBeUndefined();
    expect(style).toMatchObject({ minHeight: 48, minWidth: 48, shadowOpacity: 0, elevation: 0 });
  });
  const scroll = root.findByType(ScrollView);
  expect(scroll.props.scrollEnabled).not.toBe(false);
  expect(scroll.props.alwaysBounceVertical).toBe(true);
  expect(StyleSheet.flatten(scroll.props.style).backgroundColor).toBe(COLORS.BACKGROUND);
  act(() => scroll.props.refreshControl.props.onRefresh());
  expect(mockRefresh).toHaveBeenCalledWith(true);
});

it("accepts native viewport pixel rounding and invalidates the fit budget on resize until remeasured", () => {
  const root = mount(); measure(root);
  const fittedHeight = StyleSheet.flatten(root.findAllByType(CachedImage)[0].parent!.props.style).height;
  act(() => root.findByType(ScrollView).props.onLayout(layout(411.01, 850)));
  expect(StyleSheet.flatten(root.findAllByType(CachedImage)[0].parent!.props.style).height).toBe(fittedHeight);
  mockDimensions = { ...mockDimensions, width: 390 };
  act(() => renderer.update(<NightMarket />));
  expectNaturalArtwork(root);
  expect(StyleSheet.flatten(root.findAllByType(CachedImage)[0].parent!.props.style).width).toBe(169);
  measure(root);
  const clearance = getGlassNavigationMetrics(390, 24).contentBottomPadding;
  const rowBudget = Math.floor((850 - 140 - 48 - clearance - 8 - 16) / 3);
  expect(StyleSheet.flatten(root.findAllByType(CachedImage)[0].parent!.props.style).height).toBe(rowBudget - 96 - 2);
});

it("recalculates artwork from header/footer and natural text measurements while retaining card and preview owners", () => {
  const root = mount(); measure(root);
  const cards = root.findAllByType(NightMarketItem);
  const images = root.findAllByType(CachedImage);
  const previousHeight = StyleSheet.flatten(images[0].parent!.props.style).height;
  act(() => root.findAllByProps({ testID: "night-market-grid" })[0].props.onLayout(layout(371, 0, 170)));
  expect(StyleSheet.flatten(images[0].parent!.props.style).height).toBe(previousHeight - 10);
  act(() => root.findAllByProps({ testID: "night-market-item-content" }).find((node) => node.type === View)!.props.onLayout(layout(181, 110)));
  expect(StyleSheet.flatten(images[0].parent!.props.style).height).toBe(previousHeight - 24);
  expect(root.findAllByType(NightMarketItem)).toEqual(cards);
  expect(root.findAllByType(CachedImage)).toEqual(images);
  act(() => root.findAllByType(Pressable)[0].props.onPress());
  expect(mockPreview).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ uri: offers[0].levels[0].displayIcon })]), offers[0].displayName);
});

it.each([[320, 1], [411, 1.3], [411, 1.6]])("retains natural unbounded text and scrolling for width %s/font %s", (width, fontScale) => {
  mockDimensions = { ...mockDimensions, width, fontScale };
  const longName = "A very long Night Market weapon name that needs several readable lines";
  mockOffers = offers.map((item) => ({ ...item, displayName: longName, price: 100000000, discountedPrice: 1000000 }));
  const root = mount(); measure(root);
  expectNaturalArtwork(root);
  const titles = root.findAllByType(Text).filter((text) => text.props.children === longName);
  expect(titles).toHaveLength(6);
  titles.forEach((title) => expect(title.props.numberOfLines).toBeUndefined());
  expect(root.findByType(ScrollView).props.scrollEnabled).not.toBe(false);
  expect(root.findAllByType(Text).filter((text) => text.props.children === 100000000 || text.props.children === 1000000)
    .every((text) => text.props.numberOfLines === undefined)).toBe(true);
});

it("falls back to natural height when measured space cannot safely fit text and artwork", () => {
  const root = mount(); measure(root, 480, 200, 100);
  expectNaturalArtwork(root);
  expect(root.findByType(ScrollView).props.scrollEnabled).not.toBe(false);
});
