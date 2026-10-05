import React from "react";
import { FlatList, ScrollView, StyleSheet, View } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RefractiveGlassViewport, GlassScrollView } from "~/components/ui/refractive-glass";
import ShopItem from "~/components/ShopItem";
import NightMarketItem from "~/components/NightMarketItem";
import BundleImage from "~/components/BundleImage";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import Shop from "~/app/(authenticated)/shop";
import NightMarket from "~/app/(authenticated)/night_market";
import Bundles from "~/app/(authenticated)/bundles";
import Gallery from "~/app/(authenticated)/gallery";
import { COLORS } from "~/constants/DesignSystem";

let mockDimensions = { width: 390, height: 844, fontScale: 1, scale: 3 };
jest.mock("~/constants/Motion", () => ({ NAV_MOTION: {} }));
const mockRefresh = jest.fn();
const mockGalleryRefresh = jest.fn();
const mockReload = jest.fn();
const mockOwned = jest.fn();
const mockSkin = { uuid: "skin", levels: [{ uuid: "level" }] };
let mockUser = { name: "Player", balances: { vp: 1775 }, shops: {
  main: [mockSkin], nightMarket: [mockSkin], bundles: [{ uuid: "bundle" }],
  remainingSecs: { main: 60, nightMarket: 60, bundles: [60] },
} };
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/ui/AppViewport", () => ({ useAppWindowDimensions: () => mockDimensions }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock("~/components/ui/refractive-glass", () => ({
  RefractiveGlassViewport: "GlassViewport", GlassScrollView: "GlassScroll", RefractiveGlassCard: "GlassCard",
  GlassFlatList: "GlassFlatList",
}));
jest.mock("~/components/ShopItem", () => "ShopItem");
jest.mock("~/components/GalleryWeapon", () => "GalleryWeapon");
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ skins: [] }) }));
jest.mock("~/components/NightMarketItem", () => "NightMarketItem");
jest.mock("~/components/BundleImage", () => "BundleImage");
jest.mock("~/components/Countdown", () => "Countdown");
jest.mock("~/components/CurrencyIcon", () => "CurrencyIcon");
jest.mock("~/components/ui/EmptyStateCard", () => "EmptyStateCard");
jest.mock("~/components/ui/InfoPill", () => "InfoPill");
jest.mock("~/components/ui/PageIntro", () => "PageIntro");
jest.mock("~/components/ui/AppIcon", () => "AppIcon");
jest.mock("~/components/ui/AppRefreshControl", () => "AppRefreshControl");
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: () => mockUser }));
jest.mock("~/hooks/useWishlistStore", () => ({ useWishlistStore: () => ["level"] }));
jest.mock("~/hooks/useBundleOwnership", () => ({ useBundleOwnership: () => ({ isOwned: mockOwned, reload: mockReload }) }));
jest.mock("~/hooks/useAsyncRefresh", () => ({ useAsyncRefresh: (task: () => unknown) => ({ refreshing: false, onRefresh: task }) }));
jest.mock("~/utils/app-sync", () => ({
  refreshShopAndBalances: (...args: unknown[]) => mockRefresh(...args),
  fullBackgroundSync: (...args: unknown[]) => mockGalleryRefresh(...args),
}));

let renderer: TestRenderer.ReactTestRenderer;
function mount(element: React.ReactElement) {
  act(() => { renderer = TestRenderer.create(element); });
  return renderer.root;
}
afterEach(() => { act(() => renderer?.unmount()); mockDimensions = { width: 390, height: 844, fontScale: 1, scale: 3 }; });

it.each([["Store", Shop], ["Night", NightMarket], ["Bundle", Bundles]] as const)("restores native %s scrolling and plain material while keeping refresh and clearance", async (_name, Route) => {
  const root = mount(<Route />);
  expect(root.findAllByType(RefractiveGlassViewport)).toHaveLength(0);
  expect(root.findAllByType(GlassScrollView)).toHaveLength(0);
  const scroll = root.findByType(ScrollView);
  expect(StyleSheet.flatten(scroll.props.style).flex).toBe(1);
  expect(scroll.props.alwaysBounceVertical).toBe(true);
  expect(StyleSheet.flatten(scroll.props.style).backgroundColor).toBe(COLORS.BACKGROUND);
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBeGreaterThan(48);
  await act(async () => { await scroll.props.refreshControl.props.onRefresh(); });
  expect(mockRefresh).toHaveBeenCalledWith(true);
  if (Route === Bundles) {
    expect(mockReload).toHaveBeenCalled();
    expect(root.findByType(BundleImage).props.isOwned).toBe(mockOwned);
  }
});

it.each([["Store", Shop], ["Night", NightMarket]] as const)("preserves route-specific normal-phone columns and two for narrow/large fonts in actual %s", (_name, Route) => {
  const root = mount(<Route />);
  const width = () => Route === Shop
    ? StyleSheet.flatten(root.findByType(ShopItem).parent!.props.style).width
    : root.findByType(NightMarketItem).props.width;
  expect(width()).toBe(Route === Shop ? 169 : 171);
  mockDimensions = { ...mockDimensions, width: 320 };
  act(() => renderer.update(<Route />));
  expect(width()).toBe(Route === Shop ? 134 : 136);
  mockDimensions = { ...mockDimensions, width: 390, fontScale: 1.4 };
  act(() => renderer.update(<Route />));
  expect(width()).toBe(Route === Shop ? 169 : 171);
});

it.each([[320, 1, 2], [390, 1, 2], [390, 1.3, 2], [699, 1, 2],
  [700, 1, 3], [1024, 1, 4], [700, 1.3, 2], [1024, 1.3, 2]])(
  "Store daily four cards retain a balanced phone grid and responsive widths at %sdp/font %s", (width, fontScale, columns) => {
    const user = mockUser;
    const daily = Array.from({ length: 4 }, (_, index) => ({
      uuid: `daily-${index}`, levels: [{ uuid: index < 2 ? "level" : `other-${index}` }],
    }));
    mockUser = { ...user, shops: { ...user.shops, main: daily } };
    mockDimensions = { ...mockDimensions, width, fontScale };
    try {
      const root = mount(<Shop />);
      const cards = root.findAllByType(ShopItem);
      const expectedWidth = Math.floor((width - 40 - 12 * (columns - 1)) / columns);
      expect(cards.map((card) => card.props.item)).toEqual(daily);
      cards.forEach((card) => expect(StyleSheet.flatten(card.parent!.props.style).width).toBe(expectedWidth));
      const grid = root.findAllByType(View).find((node) => StyleSheet.flatten(node.props.style)?.flexWrap === "wrap")!;
      const gridStyle = StyleSheet.flatten(grid.props.style);
      expect(gridStyle).toMatchObject({ flexDirection: "row", flexWrap: "wrap", gap: 12 });
      const actualWidth = StyleSheet.flatten(cards[0].parent!.props.style).width;
      const fittedColumns = Math.floor((width - 40 + gridStyle.gap) / (actualWidth + gridStyle.gap));
      expect(fittedColumns).toBe(columns);
      if (width < 700) expect(Math.ceil(cards.length / fittedColumns)).toBe(2);

      const scrollOwner = root.findByType(ScrollView);
      const refreshCallback = scrollOwner.props.refreshControl.props.onRefresh;
      act(() => root.findAllByProps({ testID: "shop-filter-wishlist" })[0].props.onPress());
      expect(root.findAllByType(ShopItem).map((card) => card.props.item)).toEqual(daily.slice(0, 2));
      root.findAllByType(ShopItem).forEach((card) =>
        expect(StyleSheet.flatten(card.parent!.props.style).width).toBe(expectedWidth));
      expect(root.findByType(ScrollView)).toBe(scrollOwner);
      expect(scrollOwner.props.refreshControl.props.onRefresh).toBe(refreshCallback);
      act(() => root.findAllByProps({ testID: "shop-filter-all" })[0].props.onPress());
      expect(root.findAllByType(ShopItem).map((card) => card.props.item)).toEqual(daily);
    } finally { mockUser = user; }
  },
);

it.each([["Store", Shop], ["Night", NightMarket], ["Bundle", Bundles]] as const)("keeps empty %s route in the same native refreshable scroll owner", (_name, Route) => {
  const user = mockUser;
  mockUser = { ...user, shops: { ...user.shops, main: [], nightMarket: [], bundles: [] } };
  try {
    const root = mount(<Route />);
    expect(root.findAllByType(RefractiveGlassViewport)).toHaveLength(0);
    expect(root.findByType(ScrollView).props.refreshControl).toBeDefined();
    expect(root.findAllByType(EmptyStateCard)).toHaveLength(1);
  } finally { mockUser = user; }
});

it("uses native reveal clipping and a virtualized horizontal list without a viewport renderer", () => {
  const source = readFileSync(join(process.cwd(), "components/BundleImage.tsx"), "utf8");
  expect(source).toMatch(/useDerivedValue\(\(\) => contentHeight\.value \* progress\.value\)/);
  expect(source).not.toMatch(/refractive-glass|GlassClip|GlassFlatList|RefractiveGlassCard/);
  expect(source).toMatch(/<FlatList[\s\S]*?horizontal/);
  expect(source).not.toMatch(/<Text style=\{styles\.(oldPrice|priceText)\} numberOfLines/);
});

it.each([[320, 1, 2], [390, 1, 3], [390, 1.4, 2], [700, 1, 5]])(
  "retains Gallery columns at %sdp/font %s in its native wrapper and list", async (width, fontScale, columns) => {
    mockDimensions = { ...mockDimensions, width, fontScale };
    const root = mount(<Gallery />);
    expect(root.findAllByType(RefractiveGlassViewport)).toHaveLength(0);
    expect(StyleSheet.flatten(root.findAllByType(View)[0].props.style)).toMatchObject({ flex: 1, backgroundColor: COLORS.BACKGROUND });
    const list = root.findByType(FlatList);
    expect(list.props).toMatchObject({ numColumns: columns, alwaysBounceVertical: true,
      initialNumToRender: 8, maxToRenderPerBatch: 8, windowSize: 5 });
    await act(async () => { await list.props.refreshControl.props.onRefresh(); });
    expect(mockGalleryRefresh).toHaveBeenCalledWith(true);
  },
);
