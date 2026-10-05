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
import { COLORS, MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import LiquidGlassBackdrop from "~/components/ui/LiquidGlassBackdrop";
import { RefractiveGlassCard } from "~/components/ui/refractive-glass";
import { withSpring } from "react-native-reanimated";

jest.mock("~/components/ui/refractive-glass", () => ({ RefractiveGlassCard: "RefractiveGlassCard" }));

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
    withSpring: jest.fn((value: number) => value), withTiming: (value: number) => value, withSequence: (...values: number[]) => values.at(-1) };
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
  expect(shop.findAllByType(LiquidGlassBackdrop)).toHaveLength(0);
  expect(gallery.findAllByType(LiquidGlassBackdrop)).toHaveLength(0);
  [shop, gallery].forEach((root) => {
    expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
    expect(StyleSheet.flatten(button(root).props.style)).toMatchObject({ backgroundColor: COLORS.SURFACE,
      borderColor: getContentTierVisual(skin.contentTierUuid).border });
    expect(root.findByType(CachedImage).props).toMatchObject({ source: { uri: skin.displayIcon }, contentFit: "contain", cacheId: "skin:skin-1:display" });
    expect(texts(root)).toContain(skin.displayName);
  });
});

it("store content remains flat and sharp during press without scale, art blur or reveal", () => {
  mockReduceMotion = false;
  const renderer = render(<ShopItem item={skin} />);
  const image = renderer.root.findByType(CachedImage);
  const source = image.props.source;
  const card = button(renderer.root);
  expect(renderer.root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
  expect(renderer.root.findAllByType(LiquidGlassBackdrop)).toHaveLength(0);
  jest.mocked(withSpring).mockClear();
  act(() => card.props.onPressIn());
  expect(renderer.root.findByType(CachedImage)).toBe(image);
  expect(image.props.source).toBe(source);
  expect(image.props.transition).toBe(0);
  expect(jest.mocked(withSpring).mock.calls.some(([value]) => value === 0.97)).toBe(false);
  expect(StyleSheet.flatten(button(renderer.root).props.style)).toMatchObject({ shadowOpacity: 0, elevation: 0, boxShadow: "none" });
  act(() => card.props.onPressOut());
});

it("Night Market press changes only its border and does not fade text or artwork", () => {
  mockReduceMotion = false;
  const root = render(<NightMarketCard item={{ ...skin, discountedPrice: 1000, discountPercent: 35 }} width={180} />).root;
  const card = button(root);
  const resting = StyleSheet.flatten(card.props.style({ pressed: false }));
  const pressed = StyleSheet.flatten(card.props.style({ pressed: true }));
  expect(pressed.opacity ?? 1).toBe(resting.opacity ?? 1);
  expect(pressed.transform).toEqual(resting.transform);
  expect(root.findByType(CachedImage).props.transition).toBe(0);
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
  expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
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
    expect.objectContaining({ label: "Unavailable", kind: "image", imageUri: skin.levels[0].displayIcon }),
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
  expect(tile.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
  const button = tile.findByType(TouchableOpacity);
  expect(button.props.accessibilityState).toEqual({ selected: true });
  act(() => button.props.onPress());
  expect(onPress).toHaveBeenCalledWith(agent);
  expect(tile.findByType(CachedImage).props).toMatchObject({ cacheId: "agent:agent:display-icon", contentFit: "contain" });
});

it.each(["Knife", "Classic", "Spectre", "Bucky", "Vandal", "Operator", "Odin", "Artifact"])("Night Market %s retains discount/price/preview with one crisp flat edge", (name) => {
  const item: NightMarketItem = { ...skin, displayName: `Special ${name}`, discountedPrice: 1000, discountPercent: 35 };
  const root = render(<NightMarketCard item={item} width={150} />).root;
  expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
  expect(texts(root)).toEqual(expect.arrayContaining([item.displayName, "-35%", 1000, 1775]));
  const card = button(root);
  expect(StyleSheet.flatten(card.props.style({ pressed: true }))).toMatchObject({ width: 150, backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.VALORANT_RED,
    elevation: 0, shadowOpacity: 0, boxShadow: "none" });
  expect(StyleSheet.flatten(card.props.style({ pressed: false })).borderColor).toBe(getContentTierVisual(item.contentTierUuid).border);
  expect(StyleSheet.flatten(card.props.style({ pressed: true })).opacity ?? 1).toBe(1);
  expect(card.props.accessibilityState).toEqual({ disabled: false });
  act(() => card.props.onPress());
  expect(mockPreview).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ uri: skin.levels[0].displayIcon })]), item.displayName);
  expect(root.findByType(CachedImage).props.transition).toBe(0);
});

it("Night Market unavailable media stays disabled and keeps fallback artwork/price", () => {
  mockScreenshot = true;
  mockReduceMotion = false;
  const root = render(<NightMarketCard item={{ ...skin, levels: [], chromas: [], discountedPrice: 0, discountPercent: 100 }} width={150} />).root;
  expect(button(root).props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  expect(root.findByType(CachedImage).props.source).not.toHaveProperty("uri");
  expect(root.findByType(CachedImage).props.transition).toBe(0);
  expect(texts(root)).toContain(0);
});

it.each([false, true])("accessory shop keeps KC price and screenshot fallback=%s on a crisp flat surface", (screenshot) => {
  mockScreenshot = screenshot;
  const root = render(<ShopAccessoryItem item={{ uuid: "buddy", displayName: "Real Buddy", price: 4500, displayIcon: "https://example.com/buddy.png" }} />).root;
  expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
  expect(texts(root)).toEqual(expect.arrayContaining(["Real Buddy", 4500]));
  expect(root.findByType(CachedImage).props).toMatchObject({ cacheId: "accessory:buddy:display", contentFit: "contain", transition: 0 });
  if (screenshot) expect(root.findByType(CachedImage).props.source).not.toHaveProperty("uri");
  else expect(root.findByType(CachedImage).props.source).toEqual({ uri: "https://example.com/buddy.png" });
});

it("gallery keeps the same art instance/source sharp during press, with no whole-card shrink or replayed reveal", () => {
  mockReduceMotion = false;
  const renderer = render(<GalleryWeapon item={{ ...skin, onWishlist: false }} />);
  const image = renderer.root.findByType(CachedImage);
  const source = image.props.source;
  const card = button(renderer.root);
  jest.mocked(withSpring).mockClear();
  act(() => card.props.onPressIn());
  expect(renderer.root.findByType(CachedImage)).toBe(image);
  expect(renderer.root.findByType(CachedImage).props.source).toBe(source);
  expect(jest.mocked(withSpring).mock.calls.some(([value]) => value === 0.97)).toBe(false);
  expect(image.props.transition).toBe(0);
  expect(renderer.root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
  expect(StyleSheet.flatten(button(renderer.root).props.style)).toMatchObject({ shadowOpacity: 0, elevation: 0, boxShadow: "none" });
  act(() => card.props.onPressOut());
});

it("restores compact Store/Night flat native materials and tier art with sharp contents and 48dp targets", () => {
  const shop = render(<ShopItem item={skin} />).root;
  const night = render(<NightMarketCard item={{ ...skin, discountedPrice: 1000, discountPercent: 35 }} width={108} />).root;
  [shop, night].forEach((root, index) => {
    expect(root.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    const card = button(root);
    const style = StyleSheet.flatten(typeof card.props.style === "function" ? card.props.style({ pressed: false }) : card.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
    expect(style.minWidth).toBeGreaterThanOrEqual(48);
    expect(style).toMatchObject({ backgroundColor: COLORS.SURFACE, borderRadius: MORE_GLASS_MATERIAL.radius,
      shadowOpacity: 0, shadowRadius: 0, elevation: 0, boxShadow: "none" });
    const frame = StyleSheet.flatten(root.findByType(CachedImage).parent!.props.style);
    expect(frame).toMatchObject({ backgroundColor: getContentTierVisual(skin.contentTierUuid).cardBackground, padding: 8 });
    if (index === 0) expect(frame.aspectRatio).toBe(1.5);
    else {
      expect(frame).toMatchObject({ width: 106, height: 106 / 1.5 });
      expect(frame.aspectRatio).toBeUndefined();
    }
    expect(root.findAllByType(Text).filter((node) => node.props.children === "1775" || node.props.children === 1000)
      .every((node) => node.props.numberOfLines === undefined)).toBe(true);
  });
});

it.each([360, 390, 430].flatMap((width) => [["store", width], ["night", width]] as const))(
  "compact %s geometry targets approximately 45–60 percent of former two-column area at %sdp", (kind, width) => {
  const root = render(kind === "store" ? <ShopItem item={skin} /> :
    <NightMarketCard item={{ ...skin, discountedPrice: 1000, discountPercent: 35 }} width={Math.floor((width - 64) / 3)} />).root;
  const art = StyleSheet.flatten(root.findByType(CachedImage).parent!.props.style);
  const title = root.findAllByType(Text).find((node) => node.props.children === skin.displayName)!;
  const titleStyle = StyleSheet.flatten(title.props.style);
  const content = StyleSheet.flatten(title.parent!.props.style);
  const price = root.findAllByType(Text).find((node) => node.props.children === (kind === "store" ? "1775" : 1000))!;
  const priceStyle = StyleSheet.flatten(price.props.style);
  const priceChip = StyleSheet.flatten(price.parent!.props.style);
  const compactWidth = Math.floor((width - 40 - 24) / 3);
  const previousWidth = Math.floor((width - 40 - 12) / 2);
  // Source geometry estimate with normal fonts; device layout remains main's gate.
  const previousHeight = previousWidth / 1.45 + 29 + 13 + 34 + 8 + 28;
  const artworkHeight = kind === "night" ? art.height : compactWidth / art.aspectRatio;
  const compactHeight = artworkHeight + content.paddingTop + content.paddingBottom
    + 13 + titleStyle.minHeight + titleStyle.marginBottom + priceStyle.fontSize * 1.2 + priceChip.paddingVertical * 2 + 2;
  const ratio = compactWidth * compactHeight / (previousWidth * previousHeight);
  // Report this normal-font geometry estimate at whole-percent precision;
  // the explicit Night frame excludes its two 1dp card borders.
  expect(Math.round(ratio * 100)).toBeGreaterThanOrEqual(45);
  expect(ratio).toBeLessThanOrEqual(0.60);
  expect(titleStyle.fontSize).toBeGreaterThanOrEqual(12);
  expect(priceStyle.fontSize).toBeGreaterThanOrEqual(14);
});
