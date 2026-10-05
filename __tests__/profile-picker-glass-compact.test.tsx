import React from "react";
import * as Native from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { GlassFlatList, RefractiveGlassCard, RefractiveGlassViewport } from "~/components/ui/refractive-glass";
import { CachedImage } from "~/components/CachedImage";
import ContentCardTouchable from "~/components/ui/ContentCardTouchable";
import { COLORS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import { getProfilePickerGeometry } from "~/features/profile/profile-picker-geometry";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import type { PickerState, OwnedSkinOption } from "~/features/profile/profile-loadout";
import type { EquippedWeapon } from "~/components/GalleryProfile";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("react-native-paper/lib/module/components/Modal", () => ({ __esModule: true, default: "Modal" }));
jest.mock("react-native-paper/lib/module/components/Portal/Portal", () => ({ __esModule: true, default: "Portal" }));
jest.mock("react-native-paper/lib/module/components/Searchbar", () => ({ __esModule: true, default: "Searchbar" }));
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({
  t: (key: string, options?: { level?: string | number }) => options?.level ? `${key}:${options.level}` : key,
}) }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/GalleryProfile", () => ({ FALLBACK_IMAGE: "fallback", formatSpraySlot: (slot: string) => slot }));

// Detect accidental material integration without executing the separately owned Canvas.
jest.mock("~/components/ui/refractive-glass", () => jest.requireActual("./helpers/profile-picker-glass-mock"));

type Props = React.ComponentProps<typeof ProfilePickerModal>;
const weapon: EquippedWeapon = { weaponId: "gun", weaponName: "Rifle", category: "Rifle", skinId: "old", skinName: "Old", skinLevelId: "old-level", chromaId: "old-chroma" };
const skin: OwnedSkinOption = { id: "skin", name: "Champions 2026 Collector Vandal Long Name", skinId: "skin", skinLevelId: "level", chromaId: "chroma", selected: true,
  contentTierName: "Exclusive", upgradeLevel: 4, maxUpgradeLevel: 4,
  chromas: [{ id: "red", name: "Red variant", selected: true }, { id: "blue", name: "Blue variant", selected: false }] };
const cases: [string, PickerState][] = [
  ["weapon", { type: "weapon", weapon, options: [skin] }],
  ["expression", { type: "expression", mode: "flex", expression: { id: "old", name: "Old", kind: "flex", slotIndex: 3 }, options: [{ id: "flex", name: "Long expression name", kind: "flex", assetId: "flex", selected: true }] }],
  ["spray", { type: "spray", spray: { id: "old", name: "Old", slot: "slot" }, options: [{ id: "spray", name: "Long spray name", sprayId: "spray", sprayLevelId: null, selected: true }] }],
  ["player-card", { type: "player-card", options: [{ id: "card", name: "Long player card name", selected: true }] }],
  ["player-title", { type: "player-title", options: [{ id: "title", name: "Long player title name", selected: true }] }],
];
const renderers: TestRenderer.ReactTestRenderer[] = [];
function render(state: PickerState, overrides: Partial<Props> = {}) {
  const props: Props = { pickerState: state, pickerLoading: false, updatingLoadout: false, activeWeaponChroma: null,
    palette: { accent: "red", background: "ivory", card: "white", cardBorder: "gray", chipBackground: "beige", textPrimary: "black", textSecondary: "gray" },
    pickerError: null, identityDetails: null, identityPickerQuery: "", handleDismissPicker: jest.fn(), handleEquipWeapon: jest.fn(), handleEquipSpray: jest.fn(),
    handleEquipExpression: jest.fn(), handleEquipIdentity: jest.fn(), handleOpenExpressionPicker: jest.fn(), setActiveWeaponChroma: jest.fn(), setIdentityPickerQuery: jest.fn(), ...overrides };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<ProfilePickerModal {...props} />); });
  renderers.push(renderer);
  return { renderer, props, root: renderer.root };
}
beforeEach(() => jest.mocked(Native.useWindowDimensions).mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 }));
afterEach(() => { act(() => renderers.splice(0).forEach((renderer) => renderer.unmount())); jest.restoreAllMocks(); });

describe("Profile picker original surfaces and compact native content", () => {
  it.each(cases)("%s retains a bounded native sheet and original option backgrounds without material wrappers", (_kind, state) => {
    const { root, props } = render(state);
    const nativeModal = root.findByType(Native.Modal);
    expect(nativeModal.findAllByType(RefractiveGlassViewport)).toHaveLength(0);
    expect(nativeModal.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    expect(nativeModal.findAllByType(GlassFlatList)).toHaveLength(0);
    const scene = nativeModal.findAllByType(Native.View).find((node) => {
      const style = Native.StyleSheet.flatten(node.props.style);
      return typeof style?.height === "number" && style.overflow === "hidden";
    })!;
    expect(scene).toBeDefined();
    const sceneStyle = Native.StyleSheet.flatten(scene.props.style);
    expect(sceneStyle.height).toBeGreaterThan(0);
    expect(sceneStyle.height).toBeLessThanOrEqual(844 * 0.82);
    expect(sceneStyle.overflow).toBe("hidden");
    const sheet = scene.findByProps({ accessibilityViewIsModal: true });
    expect(Native.StyleSheet.flatten(sheet.props.style).backgroundColor).toBe(props.palette.card);
    const list = scene.findByType(Native.FlatList);
    expect(list.props.removeClippedSubviews).toBe(true);
    expect(list.props.showsVerticalScrollIndicator).toBe(false);
    const option = list.findAllByType(Native.TouchableOpacity).find((node) => typeof node.props.disabled === "boolean")!;
    expect(option.props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    const expectedBackground = state.type === "weapon"
      ? getContentTierVisual(skin.contentTierUuid, skin.contentTierName).cardBackground
      : state.type === "player-card" ? props.palette.background
      : state.type === "player-title" ? props.palette.chipBackground : COLORS.SURFACE_MUTED;
    expect(Native.StyleSheet.flatten(option.props.style).backgroundColor).toBe(expectedBackground);
    if (state.type !== "player-title") {
      expect(list.findAllByType(ContentCardTouchable)).toHaveLength(1);
      expect(Native.StyleSheet.flatten(option.props.style).width).toBe(getProfilePickerGeometry({ width: 390, height: 844, fontScale: 1 }).cardWidth);
      const image = list.findAllByType(CachedImage).find((node) => !String(node.props.cacheId).includes("swatch"))!;
      expect(Native.StyleSheet.flatten(image.parent!.props.style).backgroundColor).toBe(state.type === "weapon"
        ? getContentTierVisual(skin.contentTierUuid, skin.contentTierName).visualBackground : props.palette.chipBackground);
    }
    if (state.type === "expression") {
      const tabs = scene.findByProps({ accessibilityRole: "tablist" });
      expect(Native.StyleSheet.flatten(tabs.props.style).backgroundColor).toBe(props.palette.chipBackground);
      const controls = tabs.findAllByType(Native.TouchableOpacity);
      controls.forEach((control) => {
        expect(Native.StyleSheet.flatten(control.props.style).minHeight).toBeGreaterThanOrEqual(48);
        expect(Native.StyleSheet.flatten(control.props.style).backgroundColor).toBe(control.props.accessibilityState.selected ? COLORS.PURE_BLACK : "transparent");
      });
    }
    if (state.type === "player-title") {
      const unselectedState: PickerState = { ...state, options: state.options.map((item) => ({ ...item, selected: false })) };
      const unselected = render(unselectedState).root.findByType(Native.FlatList).findAllByType(Native.TouchableOpacity)[0];
      expect(Native.StyleSheet.flatten(unselected.props.style).backgroundColor).toBe(props.palette.card);
    }
  });

  it.each([[390, 1, 3], [360, 1, 2], [390, 1.4, 2], [320, 2, 2]])("uses %i dp at font scale %s with %i columns", (width, fontScale, columns) => {
    jest.mocked(Native.useWindowDimensions).mockReturnValue({ width, height: 844, scale: 3, fontScale });
    const { root } = render(cases[0][1]);
    expect(root.findByType(Native.FlatList).props.numColumns).toBe(columns);
  });

  it("retains data, keys, virtualization, full names, tier, levels and chroma artwork while shrinking geometry", () => {
    const state = cases[0][1];
    const { root } = render(state);
    const list = root.findByType(Native.FlatList);
    expect(list.props.data).toBe(state.options);
    expect(list.props.keyExtractor(skin)).toBe(skin.id);
    expect(list.props).toMatchObject({ initialNumToRender: 6, maxToRenderPerBatch: 6, windowSize: 5, updateCellsBatchingPeriod: 16 });
    const name = root.findAllByType(Native.Text).find((node) => node.props.children === skin.name)!;
    const nameStyle = Native.StyleSheet.flatten(name.props.style);
    expect(nameStyle.fontSize).toBeGreaterThanOrEqual(13);
    expect(name.props.numberOfLines).toBeUndefined();
    expect(root.findAllByType(Native.Text).some((node) => node.props.children === skin.contentTierName)).toBe(true);
    expect(root.findAllByType(Native.Text).some((node) => node.props.children === "profile_page.level:4/4")).toBe(true);
    expect(root.findAllByType(CachedImage).filter((node) => String(node.props.cacheId).includes("swatch"))).toHaveLength(2);
    const art = root.findAllByType(CachedImage).find((node) => String(node.props.cacheId).startsWith("skin-image"))!.parent!;
    expect(Native.StyleSheet.flatten(art.props.style).height).toBe(62);
    expect(Native.StyleSheet.flatten(art.props.style).backgroundColor).toBe(getContentTierVisual(skin.contentTierUuid, skin.contentTierName).visualBackground);
  });

  it.each(cases)("%s exposes the full name as readable native text with no whole-card transform", (_kind, state) => {
    const { root } = render(state);
    const name = root.findAllByType(Native.Text).find((node) => node.props.children === state.options[0].name)!;
    expect(name).toBeDefined();
    expect(Native.StyleSheet.flatten(name.props.style).fontSize).toBeGreaterThanOrEqual(13);
    expect(name.props.numberOfLines).toBeUndefined();
    root.findAllByType(Native.TouchableOpacity).forEach((card) => expect(Native.StyleSheet.flatten(card.props.style)?.transform).toBeUndefined());
  });

  it.each([[390, 1, 3, 62], [360, 1, 2, 72], [390, 1.4, 2, 72]])(
    "enlarges only rendered graffiti/Flex options at width %i / font scale %s with %i bounded columns",
    (width, fontScale, columns, baselineArtHeight) => {
      jest.mocked(Native.useWindowDimensions).mockReturnValue({ width, height: 844, scale: 3, fontScale });
      const expression = cases[1][1];
      if (expression.type !== "expression") throw new Error("Expected expression fixture");
      const expressionSpray: PickerState = { ...expression, mode: "spray", expression: { ...expression.expression, kind: "spray" },
        options: expression.options.map((option) => ({ ...option, kind: "spray" as const })) };
      for (const state of [cases[2][1], expression, expressionSpray]) {
        if (state.type !== "spray" && state.type !== "expression") throw new Error("Expected graffiti/Flex fixture");
        const equip = jest.fn(() => Promise.resolve("saved"));
        const snapshot = JSON.stringify(state);
        const { root, props, renderer } = render(state, { updatingLoadout: true, handleEquipSpray: equip, handleEquipExpression: equip });
        const list = root.findByType(Native.FlatList);
        const card = list.findByType(ContentCardTouchable);
        const cardStyle = Native.StyleSheet.flatten(card.props.style);
        const art = card.findAllByType(CachedImage)[0];
        const artStyle = Native.StyleSheet.flatten(art.parent!.props.style);
        const name = card.findAllByType(Native.Text).find((node) => node.props.children === state.options[0].name)!;
        const nameStyle = Native.StyleSheet.flatten(name.props.style);
        expect(list.props.numColumns).toBe(columns);
        expect(cardStyle.width).toBe(getProfilePickerGeometry({ width, height: 844, fontScale }).cardWidth);
        expect(cardStyle.padding).toBe(8);
        expect(cardStyle.minHeight).toBeCloseTo(48 * 1.2);
        expect(artStyle.height).toBeCloseTo(baselineArtHeight * 1.2);
        const baselineBody = 16 + baselineArtHeight + artStyle.marginBottom + nameStyle.minHeight + 2;
        const enlargedBody = 2 * cardStyle.paddingVertical + artStyle.height + artStyle.marginBottom + nameStyle.minHeight + 2;
        expect(enlargedBody / baselineBody).toBeCloseTo(1.2);
        expect(cardStyle.backgroundColor).toBe(COLORS.SURFACE_MUTED);
        expect(cardStyle.borderColor).toBe(props.palette.accent);
        expect(cardStyle.transform).toBeUndefined();
        expect(nameStyle).toMatchObject({ fontSize: 13, lineHeight: 17, minHeight: 34 });
        expect(name.props.numberOfLines).toBeUndefined();
        expect(art.props).toMatchObject({ transition: 0, contentFit: "contain", cachePolicy: "memory-disk" });
        expect(card.props.accessibilityState).toEqual({ selected: true, disabled: false });
        let result: unknown;
        act(() => { result = card.findByType(Native.TouchableOpacity).props.onPress(); });
        expect(result).toBe(equip.mock.results[0].value);
        expect(equip).toHaveBeenCalledWith(state.type === "spray" ? state.spray : state.expression, state.options[0]);
        act(() => renderer.update(<ProfilePickerModal {...props} pickerLoading />));
        const busy = renderer.root.findByType(ContentCardTouchable);
        expect(busy.props.accessibilityState).toEqual({ selected: true, disabled: true });
        act(() => busy.findByType(Native.TouchableOpacity).props.onPress());
        expect(equip).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(state)).toBe(snapshot);
        if (state.type === "expression") {
          const tabs = root.findByProps({ accessibilityRole: "tablist" });
          expect(Native.StyleSheet.flatten(tabs.props.style).flexDirection).toBe("row");
          tabs.findAllByType(Native.TouchableOpacity).forEach((tab) => {
            expect(Native.StyleSheet.flatten(tab.props.style)).toMatchObject({ flex: 1, minHeight: 48 });
          });
        }
      }
    },
  );

  it("rekeys the responsive grid after width changes while preserving supplied state and callbacks", () => {
    const state = cases[0][1];
    const snapshot = JSON.stringify(state);
    const { renderer, props } = render(state);
    jest.mocked(Native.useWindowDimensions).mockReturnValue({ width: 320, height: 700, scale: 3, fontScale: 1.6 });
    act(() => renderer.update(<ProfilePickerModal {...props} />));
    expect(renderer.root.findByType(Native.FlatList).props.numColumns).toBe(2);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(props.handleEquipWeapon).not.toHaveBeenCalled();
  });

  it("keeps the native chroma panel in the same sheet with original backgrounds, selected controls, names and exact callback return", () => {
    const promise = Promise.resolve("saved");
    const equip = jest.fn(() => promise);
    const { root, props } = render(cases[0][1], { activeWeaponChroma: { weapon, option: skin }, handleEquipWeapon: equip, updatingLoadout: true });
    const scene = root.findByProps({ accessibilityViewIsModal: true });
    expect(root.findAllByType(RefractiveGlassViewport)).toHaveLength(0);
    expect(root.findAllByType(RefractiveGlassCard)).toHaveLength(0);
    const chip = scene.findAllByType(Native.TouchableOpacity).find((node) => node.props.accessibilityLabel === "Blue variant")!;
    expect(Native.StyleSheet.flatten(chip.props.style).backgroundColor).toBe(props.palette.chipBackground);
    const panel = scene.findAllByType(Native.View).find((node) =>
      Native.StyleSheet.flatten(node.props.style)?.backgroundColor === props.palette.background
      && node.findAllByType(Native.Text).some((text) => text.props.children === "Chọn màu"))!;
    expect(panel).toBeDefined();
    expect(Native.StyleSheet.flatten(panel.props.style).backgroundColor).toBe(props.palette.background);
    const selected = panel.findAllByType(Native.TouchableOpacity).find((node) => node.props.accessibilityLabel === "Red variant")!;
    expect(Native.StyleSheet.flatten(selected.props.style).backgroundColor).toBe(props.palette.accent);
    expect(Native.StyleSheet.flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(chip.props.onPress()).toBe(promise);
    expect(equip).toHaveBeenCalledWith(weapon, { ...skin, chromaId: "blue", chromaName: "Blue variant", image: skin.image, selected: false });
  });
});
