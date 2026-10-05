import React from "react";
import { RefractiveGlassCard } from "~/components/ui/refractive-glass";
import { Platform, StyleSheet, Text, TouchableOpacity, type ScaledSize } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import i18next from "i18next";

import { CachedImage } from "~/components/CachedImage";
import { FALLBACK_IMAGE, formatSpraySlot, type EquippedSpray } from "~/components/GalleryProfile";
import { GLASS_MATERIAL, SPACING, TYPOGRAPHY } from "~/constants/DesignSystem";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import { ProfileExpressionSection, ProfileIdentitySection } from "~/features/profile/ProfileEquipmentSections";
import type { EquippedExpression } from "~/features/profile/profile-loadout";
import AppViewport from "~/components/ui/AppViewport";
import LiquidGlassBackdrop from "~/components/ui/LiquidGlassBackdrop";

jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/ui/AppRefreshControl", () => ({ useWebRefreshActivity: () => false }));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindowDimensions,
}));

let mockWindowDimensions: ScaledSize = { width: 320, height: 900, scale: 1, fontScale: 1 };
const originalPlatform = Platform.OS;
beforeEach(() => {
  mockWindowDimensions = { width: 320, height: 900, scale: 1, fontScale: 1 };
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
});
afterAll(() => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform });
});

const i18n = i18next.createInstance();
void i18n.init({ lng: "vi", initImmediate: false, resources: { vi: { translation: {
  equip_page: { spray_slots: { spray1: "Trước vòng", spray2: "Trong vòng", spray3: "Sau vòng", default: "Mặc định" } },
} } } });
const t = i18n.t;
const expressions: EquippedExpression[] = [
  { slotIndex: 3, kind: "flex", id: "flex-actual", name: "Tên Flex rất dài đầy đủ", icon: "https://example.com/flex.png" },
  { slotIndex: 0, kind: "spray", id: "spray-actual", name: "Graffiti thật", icon: "https://example.com/spray.png" },
  { slotIndex: 2, kind: "spray", id: "empty-art", name: "Không có ảnh" },
  { slotIndex: 1, kind: "flex", id: "flex-second", name: "Flex thứ hai", icon: "" },
];
const sprays: EquippedSpray[] = [
  { id: "legacy-a", slot: "5863985E-43AC-B05D-CB2D-139E72970014", name: "Legacy đầy đủ", icon: "https://example.com/legacy.png" },
  { id: "legacy-b", slot: "7CDC908E-4F69-9140-A604-899BD879EED1", name: "Legacy thiếu ảnh" },
];
type Props = React.ComponentProps<typeof ProfileExpressionSection>;
const renderers: TestRenderer.ReactTestRenderer[] = [];
function renderSection(overrides: Partial<Props> = {}) {
  const props: Props = { expressionDetails: expressions, sprayDetails: sprays,
    onOpenExpressionPicker: jest.fn(), onOpenSprayPicker: jest.fn(), t, ...overrides };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<AppViewport><ProfileExpressionSection {...props} /></AppViewport>); });
  renderers.push(renderer);
  return { root: renderer.root, renderer, props };
}
afterEach(() => { act(() => { renderers.forEach((renderer) => renderer.unmount()); }); renderers.length = 0; });

describe("Profile compact expression row", () => {
  it("keeps mounted slots opaque and shadowless with outline-only press feedback", () => {
    const { root } = renderSection();
    expect(root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
    root.findAllByType(TouchableOpacity).forEach((cell) => {
      const initial = StyleSheet.flatten(cell.props.style);
      expect(initial).toMatchObject({ backgroundColor: GLASS_MATERIAL.surface, minHeight: 48 });
      expect(cell.props.activeOpacity).toBe(1);
      act(() => cell.props.onPressIn());
      expect(StyleSheet.flatten(cell.props.style)).toEqual(initial);
      expect(StyleSheet.flatten(cell.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(1);
      act(() => cell.props.onPressOut());
      expect(StyleSheet.flatten(cell.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(0);
    });
  });
  it("keeps four supplied slots in original order and invokes their exact callbacks", () => {
    const { root, props } = renderSection();
    const cells = root.findAllByType(TouchableOpacity);
    expect(cells).toHaveLength(4);
    cells.forEach((cell, index) => {
      act(() => cell.props.onPress());
      expect(props.onOpenExpressionPicker).toHaveBeenNthCalledWith(index + 1, expressions[index]);
      expect(cell.props.accessibilityRole).toBe("button");
      expect(cell.props.accessible).toBe(true);
      expect(cell.props.accessibilityLabel).toContain(expressions[index].name);
      expect(cell.props.accessibilityLabel).toContain(expressions[index].kind === "flex" ? "Flex" : "Graffiti");
      expect(cell.props.accessibilityLabel).toContain(`Vị trí ${expressions[index].slotIndex + 1}`);
    });
    expect(props.onOpenSprayPicker).not.toHaveBeenCalled();
    expect(root.findAllByType(CachedImage).map((image) => image.props.cacheId)).toEqual(expressions.map((item) => `${item.kind}:${item.id}:display`));
  });

  it.each([[320, 1], [360, 1], [430, 1], [320, 2], [360, 2], [430, 2], [1440, 2]])("shares app context width at %idp / font scale %s without fixed screen metrics", (width, fontScale) => {
    mockWindowDimensions = { ...mockWindowDimensions, width, fontScale };
    const { root } = renderSection();
    const frame = StyleSheet.flatten(root.findByProps({ testID: "app-viewport-frame" }).props.style);
    expect(frame.width).toBe(Math.min(width, 430));
    const row = StyleSheet.flatten(root.findByProps({ testID: "profile-expression-row" }).props.style);
    expect(row).toMatchObject({ flexDirection: "row", flexWrap: "nowrap", gap: SPACING.xs });
    const available = Math.min(width, 430) - 2 * 20;
    const cellWidth = (available - 3 * row.gap) / 4;
    expect(cellWidth).toBeGreaterThanOrEqual(48);
    expect(root.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    root.findAllByType(TouchableOpacity).forEach((cell) => {
      const style = StyleSheet.flatten(cell.props.style);
      expect(style).toMatchObject({ flex: 1, minWidth: 0, minHeight: 48, backgroundColor: GLASS_MATERIAL.surface, borderColor: GLASS_MATERIAL.border });
      expect(style.width).toBeUndefined();
      expect(style.height).toBeUndefined();
      cell.findAllByType(Text).forEach((caption) => {
        expect(caption.props.allowFontScaling).not.toBe(false);
        expect(caption.props.numberOfLines).toBeUndefined();
      });
    });
  });

  it("reserves compact contained artwork and uses fallback only for missing images", () => {
    const { root } = renderSection();
    root.findAllByType(CachedImage).forEach((image, index) => {
      expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: "100%", maxWidth: 28, height: 28 });
      expect(image.props.contentFit).toBe("contain");
      expect(image.props.cachePolicy).toBe("memory-disk");
      expect(image.props.source).toEqual(expressions[index].icon ? { uri: expressions[index].icon } : FALLBACK_IMAGE);
      expect(image.props.accessible).toBe(false);
    });
  });

  it("keeps full names accessible while kind/slot captions can grow vertically at large font scales", () => {
    const { root } = renderSection();
    const captions = root.findAllByType(Text).slice(1);
    expect(captions).toHaveLength(8);
    captions.forEach((caption) => {
      expect(StyleSheet.flatten(caption.props.style).fontSize).toBe(TYPOGRAPHY.caption);
      expect(caption.props.allowFontScaling).not.toBe(false);
      expect(caption.props.numberOfLines).toBeUndefined();
      expect(caption.props.adjustsFontSizeToFit).not.toBe(true);
      expect(StyleSheet.flatten(caption.props.style).width).toBe("100%");
    });
    expect(root.findAllByType(TouchableOpacity)[0].props.accessibilityLabel).toContain(expressions[0].name);
  });

  it("renders legacy entries without inventing a fourth slot and retains real slot labels", () => {
    const { root, props } = renderSection({ expressionDetails: [] });
    const cells = root.findAllByType(TouchableOpacity);
    expect(cells).toHaveLength(sprays.length);
    cells.forEach((cell, index) => {
      act(() => cell.props.onPress());
      expect(props.onOpenSprayPicker).toHaveBeenNthCalledWith(index + 1, sprays[index]);
      expect(cell.props.accessibilityLabel).toBe(`${sprays[index].name}, Graffiti, ${formatSpraySlot(sprays[index].slot, t)}`);
    });
    expect(props.onOpenExpressionPicker).not.toHaveBeenCalled();
    expect(root.findAllByType(CachedImage).map((image) => image.props.source)).toEqual([{ uri: sprays[0].icon }, FALLBACK_IMAGE]);
    expect(root.findAllByType(CachedImage).map((image) => image.props.cacheId)).toEqual(sprays.map((item) => `spray:${item.id}:display`));
  });

  it("returns no section when both real sources are empty", () => {
    expect(renderSection({ expressionDetails: [], sprayDetails: [] }).root.findByType(ProfileExpressionSection).children).toHaveLength(0);
  });

  it("renders only the single supplied expression when legacy sprays also exist", () => {
    const { root } = renderSection({ expressionDetails: [expressions[2]] });
    expect(root.findAllByType(TouchableOpacity)).toHaveLength(1);
    expect(root.findByType(CachedImage).props.cacheId).toBe("spray:empty-art:display");
  });

  it("retains an unusual fifth actual slot with reachable minimum width rather than truncating", () => {
    const extra = { ...expressions[0], slotIndex: 7, id: "unexpected-actual" };
    const { root, props } = renderSection({ expressionDetails: [...expressions, extra] });
    expect(root.findAllByType(TouchableOpacity)).toHaveLength(5);
    const row = root.findByProps({ testID: "profile-expression-row" });
    expect(row.props.horizontal).toBe(true);
    act(() => root.findAllByType(TouchableOpacity)[4].props.onPress());
    expect(props.onOpenExpressionPicker).toHaveBeenCalledWith(extra);
    expect(StyleSheet.flatten(root.findAllByType(TouchableOpacity)[4].props.style).minWidth).toBeGreaterThanOrEqual(48);
  });
});

describe("identity section remains intact", () => {
  it.each([true, false])("retains identity content, image fallback and all picker callbacks (art=%s)", (withArt) => {
    const onOpenIdentityPicker = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ProfileIdentitySection t={t} onOpenIdentityPicker={onOpenIdentityPicker} identityDetails={{ cardId: "card", level: 42, hideLevel: false, cardArt: withArt ? "https://example.com/card.png" : undefined, cardName: withArt ? "Card" : undefined, titleName: withArt ? "Title" : undefined }} />); });
    renderers.push(renderer);
    expect(renderer.root.findAllByType(LiquidGlassDecoration)).toHaveLength(0);
    expect(renderer.root.findAllByType(LiquidGlassBackdrop)).toHaveLength(0);
    const image = renderer.root.findByType(CachedImage);
    const imageButton = renderer.root.findAllByType(TouchableOpacity)[0];
    const portrait = StyleSheet.flatten(imageButton.props.style);
    expect(portrait).toMatchObject({ width: "33.333333%", height: 120 });
    expect(Number.parseFloat(portrait.width) / 100).toBeCloseTo(1 / 3, 6);
    expect(renderer.root.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    const container = imageButton.parent!.parent!;
    expect(StyleSheet.flatten(container.props.style)).toMatchObject({ backgroundColor: GLASS_MATERIAL.surface, borderColor: GLASS_MATERIAL.border, borderWidth: 1 });
    expect(image.props.cacheId).toBe("player-card:card:display-icon");
    expect(imageButton.props.activeOpacity).toBe(1);
    expect(renderer.root.findByType(CachedImage).props.source).toEqual(withArt ? { uri: "https://example.com/card.png" } : FALLBACK_IMAGE);
    const buttons = renderer.root.findAllByType(TouchableOpacity);
    const renderedText = renderer.root.findAllByType(Text).map(node => String(node.props.children));
    expect(renderedText.some(text => text.includes("Cấp tài khoản"))).toBe(false);
    expect(renderedText).toContain("42"); // Artwork's level badge remains.
    expect(StyleSheet.flatten(buttons[2].parent!.props.style).justifyContent).toBe("space-between");
    expect(StyleSheet.flatten(buttons[2].props.style).marginTop).toBe(SPACING.xs);
    expect(StyleSheet.flatten(buttons[2].props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(buttons[1].props.accessibilityLabel).toBeTruthy();
    expect(buttons[2].props.accessibilityLabel).toBeTruthy();
    if (withArt) {
      expect(buttons[1].props.accessibilityLabel).toContain("Card");
      expect(buttons[2].props.accessibilityLabel).toContain("Title");
    }
    expect(StyleSheet.flatten(buttons[1].props.style).minHeight).toBeGreaterThanOrEqual(48);
    renderer.root.findAllByType(TouchableOpacity).forEach((cell) => { act(() => cell.props.onPress()); });
    expect(onOpenIdentityPicker.mock.calls).toEqual([["player-card"], ["player-card"], ["player-title"]]);
  });
  it("hides missing identity", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ProfileIdentitySection t={t} onOpenIdentityPicker={jest.fn()} identityDetails={null} />); });
    renderers.push(renderer);
    expect(renderer.toJSON()).toBeNull();
  });
});

// Profile integration owns wrappers; shader lifecycle is covered by the core owner.
jest.mock("~/components/ui/refractive-glass", () => {
  const ReactModule = require("react") as typeof React;
  const Native = require("react-native") as typeof import("react-native");
  return {
    RefractiveGlassCard: ({ children, compact: _compact, ...props }: React.PropsWithChildren<Record<string, unknown>>) => ReactModule.createElement(Native.View, props, children),
    GlassScrollView: ReactModule.forwardRef((props: Record<string, unknown>, ref: React.Ref<import("react-native").ScrollView>) => ReactModule.createElement(Native.ScrollView, { ...props, ref })),
  };
});
