import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

import { CachedImage } from "~/components/CachedImage";
import ContentCardTouchable from "~/components/ui/ContentCardTouchable";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import type { PickerState, OwnedSkinOption } from "~/features/profile/profile-loadout";
import type { EquippedWeapon } from "~/components/GalleryProfile";

jest.mock("~/components/ui/refractive-glass", () => jest.requireActual("./helpers/profile-picker-glass-mock"));
jest.mock("react-native-paper/lib/module/components/Modal", () => ({ __esModule: true, default: "Modal" }));
jest.mock("react-native-paper/lib/module/components/Portal/Portal", () => ({ __esModule: true, default: "Portal" }));
jest.mock("react-native-paper/lib/module/components/Searchbar", () => ({ __esModule: true, default: "Searchbar" }));
jest.mock("~/hooks/useAppTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: () => null }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/GalleryProfile", () => ({ FALLBACK_IMAGE: "fallback", formatSpraySlot: (slot: string) => slot }));

type Props = React.ComponentProps<typeof ProfilePickerModal>;
const weapon: EquippedWeapon = {
  weaponId: "gun", weaponName: "Rifle", category: "Rifle", skinId: "old-skin", skinName: "Old skin",
  skinLevelId: "old-level", chromaId: "old-chroma",
};
const skin: OwnedSkinOption = {
  id: "skin", name: "Skin", skinId: "skin", skinLevelId: "level", chromaId: "chroma", selected: false,
  image: "https://example.com/skin.png",
  chromas: [{ id: "other-chroma", name: "Other chroma", selected: false }],
};
const cases: [string, PickerState, string, string | undefined][] = [
  ["weapon", { type: "weapon", weapon, options: [skin] }, "skin-image:chroma:display", undefined],
  ["expression", { type: "expression", mode: "flex", expression: { id: "old", name: "Old", kind: "flex", slotIndex: 3 },
    options: [{ id: "flex", name: "Flex", kind: "flex", assetId: "asset-flex", selected: false }] }, "flex:flex:display", undefined],
  ["spray", { type: "spray", spray: { id: "old", name: "Old", slot: "slot" },
    options: [{ id: "spray", name: "Spray", sprayId: "asset-spray", sprayLevelId: null, selected: false }] }, "spray:spray:display", undefined],
  ["player-card", { type: "player-card", options: [{ id: "card", name: "Card", selected: false }] }, "player-card:card:picker", "card"],
];
const renderers: TestRenderer.ReactTestRenderer[] = [];
function renderPicker(pickerState: PickerState, overrides: Partial<Props> = {}) {
  const props: Props = {
    pickerState, pickerLoading: false, updatingLoadout: false, activeWeaponChroma: null,
    palette: { accent: "red", background: "white", card: "white", cardBorder: "gray", chipBackground: "white", textPrimary: "black", textSecondary: "gray" },
    pickerError: null, identityDetails: null, identityPickerQuery: "", handleDismissPicker: jest.fn(),
    handleEquipWeapon: jest.fn(), handleEquipSpray: jest.fn(), handleEquipExpression: jest.fn(), handleEquipIdentity: jest.fn(),
    handleOpenExpressionPicker: jest.fn(), setActiveWeaponChroma: jest.fn(), setIdentityPickerQuery: jest.fn(), ...overrides,
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<ProfilePickerModal {...props} />); });
  renderers.push(renderer);
  return { renderer, root: renderer.root, props };
}
function mediaButton(root: TestRenderer.ReactTestInstance) {
  return root.findAllByType(TouchableOpacity).find((node) => typeof node.props.disabled === "boolean")!;
}
afterEach(() => { act(() => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

describe("Profile picker crisp media content", () => {
  it.each(cases.slice(0, 3))("%s mounts foreground artwork without a reveal fade", (_name, state, cacheId) => {
    const { root } = renderPicker(state);
    const image = root.findAllByType(CachedImage).find((node) => node.props.cacheId === cacheId)!;
    expect(image.props.transition).toBe(0);
    expect(image.props.cachePolicy).toBe("memory-disk");
    expect(image.props.contentFit).toBe("contain");
  });

  it.each(cases)("%s keeps press/cancel feedback on an outline with stable artwork and cache identity", (_name, state, cacheId, recyclingKey) => {
    const { root } = renderPicker(state);
    const button = mediaButton(root);
    const image = root.findAllByType(CachedImage).find((node) => node.props.cacheId === cacheId)!;
    const initialStyle = StyleSheet.flatten(button.props.style);
    const initialImageProps = image.props;
    expect(button.props.activeOpacity).toBe(1);
    expect(initialStyle.opacity ?? 1).toBe(1);
    expect(initialStyle.transform).toBeUndefined();
    expect(image.props.recyclingKey).toBe(recyclingKey);
    act(() => button.props.onPressIn());
    expect(StyleSheet.flatten(button.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(button.props.style)).toEqual(initialStyle);
    expect(image.props).toEqual(initialImageProps);
    act(() => button.props.onPressOut());
    expect(StyleSheet.flatten(button.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(0);
  });

  it.each(cases)("%s gates loading locally, allows selection while saving, and preserves callback returns and option snapshots", (_name, state) => {
    const result = Promise.resolve("mock-selection");
    const equip = jest.fn(() => result);
    const snapshot = JSON.stringify(state);
    const { root, renderer, props } = renderPicker(state, {
      updatingLoadout: true, handleEquipWeapon: equip, handleEquipSpray: equip, handleEquipExpression: equip, handleEquipIdentity: equip,
    });
    const button = mediaButton(root);
    expect(root.findAllByType(ContentCardTouchable)).toHaveLength(1);
    expect(button.props.accessibilityState).toMatchObject({ selected: false, disabled: false });
    let returned: unknown;
    act(() => { returned = button.props.onPress(); });
    expect(returned).toBe(result);
    if (state.type === "weapon") expect(equip).toHaveBeenCalledWith(state.weapon, state.options[0]);
    if (state.type === "expression") expect(equip).toHaveBeenCalledWith(state.expression, state.options[0]);
    if (state.type === "spray") expect(equip).toHaveBeenCalledWith(state.spray, state.options[0]);
    if (state.type === "player-card") expect(equip).toHaveBeenCalledWith("player-card", state.options[0].id);
    act(() => { button.props.onPressIn(); renderer.update(<ProfilePickerModal {...props} pickerLoading />); });
    const disabled = mediaButton(renderer.root);
    expect(disabled.props.accessibilityState).toMatchObject({ disabled: true });
    expect(disabled.props.disabled).toBe(true);
    expect(StyleSheet.flatten(disabled.props.style).opacity ?? 1).toBe(1);
    expect(disabled.findByProps({ testID: "profile-picker-option-busy" }).findByType(ActivityIndicator).props.animating).toBe(true);
    expect(StyleSheet.flatten(disabled.findByProps({ testID: "content-card-press-outline" }).props.style).opacity).toBe(0);
    act(() => disabled.props.onPress());
    expect(equip).toHaveBeenCalledTimes(1);
    const selectedState = { ...state, options: state.options.map((option) => ({ ...option, selected: true })) } as PickerState;
    act(() => renderer.update(<ProfilePickerModal {...props} pickerState={selectedState} />));
    expect(mediaButton(renderer.root).props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    expect(StyleSheet.flatten(mediaButton(renderer.root).props.style).borderColor).toBe(props.palette.accent);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("keeps the guarded chroma long press and its supplied weapon/option identities", () => {
    const state: PickerState = { type: "weapon", weapon, options: [skin] };
    const { root, renderer, props } = renderPicker(state);
    act(() => mediaButton(root).props.onLongPress());
    expect(props.setActiveWeaponChroma).toHaveBeenCalledWith({ weapon, option: skin });
    act(() => renderer.update(<ProfilePickerModal {...props} pickerLoading />));
    act(() => mediaButton(renderer.root).props.onLongPress());
    expect(props.setActiveWeaponChroma).toHaveBeenCalledTimes(1);
    act(() => renderer.update(<ProfilePickerModal {...props} pickerState={{ ...state, options: [{ ...skin, chromas: [] }] }} />));
    act(() => mediaButton(renderer.root).props.onLongPress());
    expect(props.setActiveWeaponChroma).toHaveBeenCalledTimes(1);
  });
});
