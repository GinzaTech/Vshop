import React from "react";
import { AccessibilityInfo, FlatList, StyleSheet, Text, TouchableOpacity } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import ShopItem from "~/components/ShopItem";
import GalleryWeapon from "~/components/GalleryWeapon";
import SkinShowcaseCard from "~/components/SkinShowcaseCard";
import NightMarketCard from "~/components/NightMarketItem";
import ShopAccessoryItem from "~/components/ShopAccessoryItem";
import GalleryEquip from "~/components/GalleryEquip";
import { AgentGrid } from "~/components/GalleryAgent";
import { CachedImage } from "~/components/CachedImage";
import { GLASS_MATERIAL } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import LiquidGlassBackdrop from "~/components/ui/LiquidGlassBackdrop";

const mockPreview = jest.fn();
const mockToggle = jest.fn();
let mockSaved: string[] = [];
let mockScreenshot = false;
let mockReduceMotion = true;
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const copy = Object.create(null, Object.getOwnPropertyDescriptors(actual));
  Object.defineProperty(copy, "Pressable", { value: "MockPressable", configurable: true });
  return copy;
});
jest.mock("react-native-reanimated", () => {
  const { View, Easing } = jest.requireActual("react-native");
  return { __esModule: true, default: { View }, Easing, ReduceMotion: { System: "system" },
    useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (callback: () => unknown) => callback(),
    withSpring: (value: number) => value, withTiming: (value: number) => value, withSequence: (...values: number[]) => values.at(-1) };
});
jest.mock("~/hooks/useMotionPreference", () => ({ useMotionPreference: () => mockReduceMotion }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/popups/MediaPopup", () => ({ useMediaPopupStore: <T,>(selector: (state: { showMediaPopup: typeof mockPreview }) => T) => selector({ showMediaPopup: mockPreview }) }));
jest.mock("~/hooks/useWishlistStore", () => ({ useWishlistStore: <T,>(selector: (state: { skinIds: string[]; toggleSkin: typeof mockToggle }) => T) => selector({ skinIds: mockSaved, toggleSkin: mockToggle }) }));
jest.mock("~/hooks/useFeatureStore", () => ({ useFeatureStore: <T,>(selector: (state: { screenshotModeEnabled: boolean }) => T) => selector({ screenshotModeEnabled: mockScreenshot }) }));
jest.mock("~/utils/misc", () => ({ getDisplayIconUri: (item: { displayIcon?: string }) => item.displayIcon }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({}) }));
jest.mock("~/components/ui/AppRefreshControl", () => ({ __esModule: true, default: "RefreshControl" }));
jest.mock("expo-haptics", () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: "success" } }));

const skin: SkinShopItem = {
  uuid: "skin-1", displayName: "Premium Vandal", themeUuid: "theme", assetPath: "asset", price: 1775,
  contentTierUuid: "0cebb8be-46d7-c12a-d306-e9907bfc5a25", displayIcon: "https://example.com/skin.png",
  levels: [{ uuid: "level-1", displayName: "Level 1", assetPath: "level", displayIcon: "https://example.com/level.png" }],
  chromas: [{ uuid: "chroma-1", displayName: "Blue", fullRender: "https://example.com/blue.png", assetPath: "chroma" }],
};
const renderers: TestRenderer.ReactTestRenderer[] = [];
function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(element); });
  renderers.push(renderer);
  return renderer;
}
function texts(root: TestRenderer.ReactTestInstance) { return root.findAllByType(Text).map((node) => Array.isArray(node.props.children) ? node.props.children.join("") : node.props.children); }
function button(root: TestRenderer.ReactTestInstance) { return root.findAll((node) => typeof node.type === "string" && node.props.accessibilityRole === "button")[0]; }
beforeEach(() => { jest.useFakeTimers(); mockSaved = []; mockScreenshot = false; mockReduceMotion = true;
  jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
});
afterEach(() => { act(() => renderers.splice(0).forEach((renderer) => renderer.unmount())); jest.useRealTimers(); jest.restoreAllMocks(); });

it("actual Shop/Gallery weapon wrappers retain price vs chroma count, rarity and clear cached art", () => {
  const shop = render(<ShopItem item={skin} />).root;
  const gallery = render(<GalleryWeapon item={{ ...skin, onWishlist: false }} />).root;
  expect(texts(shop)).toContain("1775");
  expect(texts(gallery)).toContain("chromas 1");
  expect(texts(gallery)).not.toContain("1775");
  expect(shop.findByType(LiquidGlassBackdrop).props).toMatchObject({ artworkUri: skin.displayIcon, cacheId: "skin:skin-1:display" });
  expect(gallery.findAllByType(LiquidGlassBackdrop)).toHaveLength(0);
  [shop, gallery].forEach((root) => {
    expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(1);
    expect(StyleSheet.flatten(button(root).props.style)).toMatchObject({ backgroundColor: GLASS_MATERIAL.surface, borderColor: getContentTierVisual(skin.contentTierUuid).border });
    expect(root.findByType(CachedImage).props).toMatchObject({ source: { uri: skin.displayIcon }, contentFit: "contain", cacheId: "skin:skin-1:display" });
    expect(texts(root)).toContain(skin.displayName);
  });
});

it("preserves timed preview, double-tap wishlist and cancellation on unmount", () => {
  const renderer = render(<SkinShowcaseCard item={skin} />);
  act(() => button(renderer.root).props.onPress());
  expect(mockPreview).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(220));
  expect(mockPreview).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ uri: skin.chromas[0].fullRender })]), skin.displayName);
  mockPreview.mockClear();
  act(() => { button(renderer.root).props.onPress(); button(renderer.root).props.onPress(); });
  expect(mockToggle).toHaveBeenCalledWith("level-1");
  act(() => jest.advanceTimersByTime(220));
  expect(mockPreview).not.toHaveBeenCalled();
  act(() => button(renderer.root).props.onPress());
  act(() => renderer.unmount());
  act(() => jest.advanceTimersByTime(220));
  expect(mockPreview).not.toHaveBeenCalled();
});

it("keeps saved state, screenshot fallback and missing price/media honest", () => {
  mockSaved = ["skin-1"];
  mockScreenshot = true;
  const item: GalleryItem = { uuid: skin.uuid, displayName: skin.displayName, themeUuid: skin.themeUuid,
    assetPath: skin.assetPath, contentTierUuid: skin.contentTierUuid, levels: [], chromas: [], onWishlist: true };
  const root = render(<SkinShowcaseCard variant="bundle" item={item} />).root;
  expect(texts(root)).toContain("shop_cards.saved");
  expect(texts(root)).toContain("--");
  expect(root.findByType(CachedImage).props.source).not.toEqual({ uri: skin.displayIcon });
  act(() => { button(root).props.onPress(); jest.advanceTimersByTime(220); });
  expect(mockPreview).not.toHaveBeenCalled();
});

it.each(["buddies", "sprays", "cards", "titles"] as const)("%s equipment keeps art/text on its own clear content layer", (section) => {
  const root = render(<GalleryEquip screenshotModeEnabled={false} data={{ id: "equip-1", displayName: "Real item", subtitle: "Real subtitle", section,
    item: { uuid: "equip-1", displayName: "Real item", displayIcon: "https://example.com/equip.png", smallArt: "https://example.com/card.png" } }} />).root;
  expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(1);
  expect(texts(root)).toContain("Real item");
  expect(texts(root)).toContain("Real subtitle");
  if (section !== "titles") expect(root.findByType(CachedImage).props.contentFit).toBe(section === "cards" ? "cover" : "contain");
});

it("preserves press feedback with motion enabled and preview video/media filtering", () => {
  mockReduceMotion = false;
  const item: SkinShopItem = { ...skin, displayName: "Special artifact", levels: [
    { ...skin.levels[0], streamedVideo: "https://example.com/level.mp4" },
    { uuid: "empty", displayName: "Unavailable", assetPath: "empty" }], chromas: [
    { ...skin.chromas[0], streamedVideo: "https://example.com/chroma.mp4" }] };
  const renderer = render(<SkinShowcaseCard item={item} variant="bundle" />);
  expect(texts(renderer.root)).toContain("shop_cards.bundle_skin");
  const card = button(renderer.root);
  act(() => { card.props.onPressIn(); card.props.onPressOut(); card.props.onPress(); jest.advanceTimersByTime(220); });
  expect(mockPreview).toHaveBeenCalledWith([
    expect.objectContaining({ uri: "https://example.com/level.mp4", kind: "video" }),
    expect.objectContaining({ uri: "https://example.com/chroma.mp4", kind: "video" }),
  ], item.displayName);
  mockSaved = ["level-1"];
  act(() => renderer.update(<SkinShowcaseCard item={{ ...item, displayName: "Updated saved artifact" }} />));
  expect(texts(renderer.root)).toContain("shop_cards.saved");
  mockSaved = [];
  act(() => renderer.update(<SkinShowcaseCard item={{ ...item, displayName: "Updated artifact" }} />));
  expect(texts(renderer.root)).not.toContain("shop_cards.saved");
});

it("handles fallback names/art in equipment and refreshes relevant memoized presentation", () => {
  const data: React.ComponentProps<typeof GalleryEquip>["data"] = { id: "equip-1", section: "titles", displayName: "", subtitle: "internal::Title",
    item: { uuid: "equip-1", displayName: "" } };
  const renderer = render(<GalleryEquip data={data} screenshotModeEnabled />);
  expect(texts(renderer.root)).not.toContain("internal::Title");
  expect(texts(renderer.root)).toContain("equip_gallery.labels.titles");
  act(() => renderer.update(<GalleryEquip data={data} screenshotModeEnabled />));
  act(() => renderer.update(<GalleryEquip data={{ ...data, displayName: "Actual title" }} screenshotModeEnabled />));
  expect(texts(renderer.root)).toContain("Actual title");
  act(() => renderer.update(<GalleryEquip data={{ ...data, section: "cards", displayName: "9a814d22-e049-4c84-8a0b-a128d47e9cd6" }} screenshotModeEnabled={false} />));
  expect(texts(renderer.root)).toContain("equip_gallery.labels.cards");
  expect(texts(renderer.root)).not.toContain("9a814d22-e049-4c84-8a0b-a128d47e9cd6");
  expect(renderer.root.findByType(CachedImage).props.source).not.toHaveProperty("uri");
});

it("keeps gallery and equipment text current when supplied data changes", () => {
  const galleryItem: GalleryItem = { ...skin, onWishlist: false };
  const renderer = render(<GalleryWeapon item={galleryItem} />);
  act(() => renderer.update(<GalleryWeapon item={galleryItem} />));
  act(() => renderer.update(<GalleryWeapon item={{ ...galleryItem, displayName: "Updated Vandal" }} />));
  expect(texts(renderer.root)).toContain("Updated Vandal");
  const data: React.ComponentProps<typeof GalleryEquip>["data"] = { id: "equip", section: "buddies", displayName: "Buddy", subtitle: "", item: { uuid: "equip", displayName: "Buddy" } };
  const equipment = render(<GalleryEquip data={data} screenshotModeEnabled={false} />);
  act(() => equipment.update(<GalleryEquip data={{ ...data, subtitle: "New subtitle" }} screenshotModeEnabled={false} />));
  expect(texts(equipment.root)).toContain("New subtitle");
  act(() => equipment.update(<GalleryEquip data={{ ...data, id: "new" }} screenshotModeEnabled={false} />));
  expect(equipment.root.findByType(CachedImage).props.recyclingKey).toBe("new");
});

it("retains virtualized agent gallery, refresh, selected state and exact item callback", () => {
  const agent: ValorantAgent = { uuid: "agent", displayName: "Actual agent", displayIcon: "https://example.com/agent.png",
    role: { uuid: "role", description: "Role", displayIcon: "https://example.com/role.png" } };
  const onPress = jest.fn();
  const onRefresh = jest.fn();
  const grid = render(<AgentGrid agents={[agent]} onAgentPress={onPress} selectedAgentId={agent.uuid} refreshing onRefresh={onRefresh} />).root;
  const list = grid.findByType(FlatList);
  expect(list.props).toMatchObject({ data: [agent], numColumns: 5, extraData: agent.uuid, alwaysBounceVertical: true });
  expect(list.props.refreshControl.props).toMatchObject({ refreshing: true, onRefresh });
  const tile = render(list.props.renderItem({ item: agent })).root;
  expect(tile.findAllByType(LiquidGlassDecoration)).toHaveLength(1);
  const button = tile.findByType(TouchableOpacity);
  expect(button.props.accessibilityState).toEqual({ selected: true });
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledWith(agent);
  expect(tile.findByType(CachedImage).props).toMatchObject({ cacheId: "agent:agent:display-icon", contentFit: "contain" });
});

it.each(["Knife", "Classic", "Spectre", "Bucky", "Vandal", "Operator", "Odin", "Artifact"])("Night Market %s retains discount/price/preview over glass", (name) => {
  const item: NightMarketItem = { ...skin, displayName: `Special ${name}`, discountedPrice: 1000, discountPercent: 35 };
  const root = render(<NightMarketCard item={item} width={150} />).root;
  expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(1);
  expect(texts(root)).toEqual(expect.arrayContaining([item.displayName, "-35%", 1000, 1775]));
  const card = button(root);
  expect(StyleSheet.flatten(card.props.style({ pressed: true }))).toMatchObject({ width: 150, backgroundColor: GLASS_MATERIAL.surface, opacity: 0.86 });
  expect(card.props.accessibilityState).toEqual({ disabled: false });
  act(() => card.props.onPress());
  expect(mockPreview).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ uri: skin.levels[0].displayIcon })]), item.displayName);
  expect(root.findByType(CachedImage).props.transition).toBe(0);
});

it("Night Market unavailable media stays disabled and keeps fallback artwork/price", () => {
  mockScreenshot = true;
  mockReduceMotion = false;
  const root = render(<NightMarketCard item={{ ...skin, levels: [], discountedPrice: 0, discountPercent: 100 }} width={150} />).root;
  expect(button(root).props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  expect(root.findByType(CachedImage).props.source).not.toHaveProperty("uri");
  expect(root.findByType(CachedImage).props.transition).toBe(120);
  expect(texts(root)).toContain(0);
});

it.each([false, true])("accessory shop keeps KC price and screenshot fallback=%s on glass", (screenshot) => {
  mockScreenshot = screenshot;
  const root = render(<ShopAccessoryItem item={{ uuid: "buddy", displayName: "Real Buddy", price: 4500, displayIcon: "https://example.com/buddy.png" }} />).root;
  expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(1);
  expect(texts(root)).toEqual(expect.arrayContaining(["Real Buddy", 4500]));
  expect(root.findByType(CachedImage).props).toMatchObject({ cacheId: "accessory:buddy:display", contentFit: "contain", transition: 0 });
  if (screenshot) expect(root.findByType(CachedImage).props.source).not.toHaveProperty("uri");
  else expect(root.findByType(CachedImage).props.source).toEqual({ uri: "https://example.com/buddy.png" });
});
