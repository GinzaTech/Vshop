import React from "react";
import { TouchableOpacity } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { ProfilePickerModal } from "~/features/profile/ProfilePickerModal";
import type { PickerState, OwnedSkinOption } from "~/features/profile/profile-loadout";
import type { EquippedWeapon } from "~/components/GalleryProfile";

jest.mock("react-native-paper/lib/module/components/Portal/Portal", () => ({ __esModule: true, default: "Portal" }));
jest.mock("react-native-paper/lib/module/components/Modal", () => ({ __esModule: true, default: "Modal" }));
jest.mock("react-native-paper/lib/module/components/Searchbar", () => ({ __esModule: true, default: "Searchbar" }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("~/components/CachedImage", () => ({ CachedImage: "CachedImage" }));
jest.mock("~/components/ui/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("~/components/GalleryProfile", () => ({ FALLBACK_IMAGE: "fallback", formatSpraySlot: (slot: string) => slot }));
jest.mock("~/utils/content-tier", () => ({ getContentTierVisual: () => ({ cardBackground: "white", border: "gray", accent: "red" }) }));

const weapon = { weaponId: "gun", weaponName: "Rifle" } as EquippedWeapon;
const skin: OwnedSkinOption = { id: "skin", name: "Skin", skinId: "skin", skinLevelId: "level", chromaId: "chroma", selected: false,
  chromas: [{ id: "chroma-other", name: "Other chroma", selected: false }] };
const cases: [string, PickerState, boolean][] = [
  ["weapon", { type: "weapon", weapon, options: [skin] }, false],
  ["chroma", { type: "weapon", weapon, options: [skin] }, true],
  ["spray", { type: "spray", spray: { id: "old", name: "Old", slot: "slot" }, options: [{ id: "spray", name: "Spray", sprayId: "spray", sprayLevelId: null, selected: false }] }, false],
  ["expression-spray", { type: "expression", mode: "spray", expression: { id: "old", name: "Old", kind: "spray", slotIndex: 0 },
    options: [{ id: "spray", name: "Spray", kind: "spray", assetId: "spray", selected: false }] }, false],
  ["expression-flex", { type: "expression", mode: "flex", expression: { id: "old", name: "Old", kind: "flex", slotIndex: 0 },
    options: [{ id: "flex", name: "Flex", kind: "flex", assetId: "flex", selected: false }] }, false],
  ["card", { type: "player-card", options: [{ id: "card", name: "Card", selected: false }] }, false],
  ["title", { type: "player-title", options: [{ id: "title", name: "Title", selected: false }] }, false],
];
describe("Profile pickers remain interactive while saving", () => {
  it("removes the dismissed picker immediately even while its authorized mutation keeps saving", () => {
    const props = { pickerState: null, updatingLoadout: true, pickerLoading: false } as React.ComponentProps<typeof ProfilePickerModal>;
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ProfilePickerModal {...props} />); });
    expect(renderer.toJSON()).toBeNull();
    act(() => { renderer.unmount(); });
  });
  it.each(cases)("%s permits selection during a PUT and gates only option loading", (_name, pickerState, chroma) => {
    const equip = jest.fn();
    const props: React.ComponentProps<typeof ProfilePickerModal> = { pickerState, pickerLoading: false, updatingLoadout: true,
      activeWeaponChroma: chroma ? { weapon, option: skin } : null,
      palette: { accent: "red", background: "white", card: "white", cardBorder: "gray", chipBackground: "white", textPrimary: "black", textSecondary: "gray" },
      pickerError: null, identityDetails: null, identityPickerQuery: "", handleDismissPicker: jest.fn(),
      handleEquipWeapon: equip, handleEquipSpray: equip, handleEquipExpression: equip, handleEquipIdentity: equip,
      handleOpenExpressionPicker: jest.fn(), setActiveWeaponChroma: jest.fn(), setIdentityPickerQuery: jest.fn() };
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ProfilePickerModal {...props} />); });
    const buttons = renderer.root.findAllByType(TouchableOpacity).filter((node) => typeof node.props.disabled === "boolean");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((button) => { expect(button.props.disabled).toBe(false); act(() => { button.props.onPress(); }); });
    expect(equip).toHaveBeenCalledTimes(buttons.length);
    act(() => { renderer.update(<ProfilePickerModal {...props} pickerLoading />); });
    renderer.root.findAllByType(TouchableOpacity).filter((node) => typeof node.props.disabled === "boolean")
      .forEach((button) => { expect(button.props.disabled).toBe(true); });
    act(() => { renderer.unmount(); });
  });
});
