import {
  formatOneDecimal,
  formatPercentage,
  getProfileWeaponOrderIndex,
  loadoutsMatch,
  normalizeProfileWeaponCategory,
  normalizeVariantLabel,
  normalizeWeaponKey,
} from "~/features/profile/profile-loadout";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";

const makeLoadout = (): PlayerLoadoutResponse => ({
  SourceApiVersion: "v3",
  Subject: "subject",
  Version: 1,
  Guns: [
    {
      ID: "vandal",
      SkinID: "skin",
      SkinLevelID: "level",
      ChromaID: "chroma",
      CharmID: "buddy",
      CharmLevelID: "buddy-level",
      Attachments: [],
    },
  ],
  Sprays: [
    { EquipSlotID: "slot", SprayID: "spray", SprayLevelID: "spray-level" },
  ],
  ActiveExpressions: [{ TypeID: "spray", AssetID: "expression" }],
  DynamicOptions: {},
  Identity: {
    PlayerCardID: "card",
    PlayerTitleID: "title",
    AccountLevel: 10,
    PreferredLevelBorderID: "border",
    HideAccountLevel: false,
  },
  Incognito: false,
});

describe("profile loadout domain helpers", () => {
  it.each([
    ["Sidearms", "Sidearm"],
    ["Heavy Weapons", "Heavy"],
    ["Machine Gun", "Heavy"],
    ["Melee", "Melee"],
    [undefined, "Other"],
  ])("normalizes weapon category %s", (input, expected) => {
    expect(normalizeProfileWeaponCategory(input)).toBe(expected);
  });

  it("normalizes names and keeps the configured weapon order", () => {
    expect(normalizeWeaponKey("  Vándal Prime! ")).toBe("vandal prime");
    expect(getProfileWeaponOrderIndex("Vandal")).toBeLessThan(
      getProfileWeaponOrderIndex("Melee")
    );
  });

  it("formats variants and decimal values deterministically", () => {
    expect(normalizeVariantLabel("Prime Vandal", "Prime Vandal - Gold")).toBe("Gold");
    expect(normalizeVariantLabel("Prime Vandal", "Prime Vandal")).toBeNull();
    expect(formatOneDecimal(1.29)).toBe("1.2");
    expect(formatPercentage(47.89)).toBe("47.8%");
  });

  it("compares all mutable loadout resources", () => {
    const left = makeLoadout();
    const right = makeLoadout();
    expect(loadoutsMatch(left, right)).toBe(true);

    right.Guns[0].ChromaID = "different";
    expect(loadoutsMatch(left, right)).toBe(false);
    expect(loadoutsMatch(left, null)).toBe(false);
  });
});
