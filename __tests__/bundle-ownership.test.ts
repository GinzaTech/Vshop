import {
  createBundleOwnershipLookup,
  type BundleOwnershipMatcher,
} from "~/utils/bundle-ownership";
import { VItemTypes } from "~/utils/misc";

function makeSkin(
  overrides: Partial<SkinShopItem> = {}
): SkinShopItem {
  return {
    uuid: "skin-root",
    displayName: "Champions Vandal",
    themeUuid: "theme-1",
    assetPath: "",
    chromas: [
      {
        uuid: "chroma-base",
        displayName: "Standard",
        fullRender: "https://example.com/base.png",
        assetPath: "",
      },
    ],
    levels: [
      {
        uuid: "level-1",
        displayName: "Level 1",
        assetPath: "",
      },
      {
        uuid: "level-2",
        displayName: "Level 2",
        assetPath: "",
      },
    ],
    price: 1766,
    ...overrides,
  };
}

function makeAccessory(
  overrides: Partial<AccessoryShopItem> = {}
): AccessoryShopItem {
  return {
    uuid: "accessory-1",
    displayName: "Champions Card",
    price: 300,
    ...overrides,
  };
}

describe("createBundleOwnershipLookup", () => {
  it.each([
    VItemTypes.Spray, VItemTypes.Flex, VItemTypes.PlayerCard,
    VItemTypes.PlayerTitle, VItemTypes.Buddy,
  ])("matches accessory UUIDs only within supported exact type %s", (itemTypeId) => {
    const item = makeAccessory({ uuid: "shared", itemTypeId });
    expect(createBundleOwnershipLookup([], { [itemTypeId]: ["shared"] })(item)).toBe(true);
    expect(createBundleOwnershipLookup(["shared"])(item)).toBe(false);
    const otherType = itemTypeId === VItemTypes.Spray ? VItemTypes.PlayerCard : VItemTypes.Spray;
    expect(createBundleOwnershipLookup([], { [otherType]: ["shared"] })(item)).toBe(false);
  });

  it("matches raw Buddy offer IDs and metadata levels after root remapping", () => {
    const buddy = makeAccessory({ uuid: "buddy-root", itemTypeId: VItemTypes.Buddy,
      entitlementItemIds: ["buddy-offer-level", "buddy-known-level"] });
    for (const id of ["buddy-root", "buddy-offer-level", "buddy-known-level"]) {
      expect(createBundleOwnershipLookup([], { [VItemTypes.Buddy]: [id] })(buddy)).toBe(true);
    }
    expect(createBundleOwnershipLookup([], { [VItemTypes.PlayerCard]: ["buddy-known-level"] })(buddy)).toBe(false);
  });

  it("fails closed for legacy and unsupported accessory metadata", () => {
    const inventory = { [VItemTypes.PlayerCard]: ["accessory-1"], [VItemTypes.Agent]: ["accessory-1"] };
    const isOwned = createBundleOwnershipLookup([], inventory);
    expect(isOwned(makeAccessory())).toBe(false);
    expect(isOwned(makeAccessory({ itemTypeId: VItemTypes.Agent }))).toBe(false);
    expect(isOwned(makeAccessory({ itemTypeId: VItemTypes.SkinLevel }))).toBe(false);
    expect(isOwned(makeAccessory({ itemTypeId: "unknown" }))).toBe(false);
  });

  it("uses typed skin evidence and raw skin offers without mixing accessory IDs", () => {
    const skin = makeSkin({ itemTypeId: VItemTypes.SkinLevel, entitlementItemIds: ["raw-offer"] });
    expect(createBundleOwnershipLookup([], { [VItemTypes.SkinLevel]: ["raw-offer"] })(skin)).toBe(true);
    expect(createBundleOwnershipLookup([], { [VItemTypes.SkinChroma]: ["chroma-base"] })(skin)).toBe(true);
    expect(createBundleOwnershipLookup([], { [VItemTypes.PlayerCard]: ["level-1", "raw-offer"] })(skin)).toBe(false);
    expect(createBundleOwnershipLookup(["raw-offer"])(skin)).toBe(true);
  });

  it("snapshots caller inventories and does not mutate frozen identity metadata", () => {
    const ids = ["owned-card"];
    const byType = { [VItemTypes.PlayerCard]: ids };
    const item = Object.freeze(makeAccessory({ uuid: "card-root", itemTypeId: VItemTypes.PlayerCard,
      entitlementItemIds: Object.freeze(["owned-card"]) }));
    const isOwned = createBundleOwnershipLookup([], byType);
    ids.splice(0, 1, "later-card");
    expect(isOwned(item)).toBe(true);
    expect(isOwned(makeAccessory({ uuid: "later-card", itemTypeId: VItemTypes.PlayerCard }))).toBe(false);
  });

  it("does not route explicitly typed accessories through legacy skin evidence even with skin-shaped arrays", () => {
    const item = makeSkin({ itemTypeId: VItemTypes.PlayerCard });
    expect(createBundleOwnershipLookup(["skin-root", "level-1", "chroma-base"])(item)).toBe(false);
    expect(createBundleOwnershipLookup([], { [VItemTypes.PlayerCard]: ["skin-root"] })(item)).toBe(true);
    expect(createBundleOwnershipLookup([], { [VItemTypes.PlayerCard]: ["level-1"] })(item)).toBe(false);
    expect(createBundleOwnershipLookup(["skin-root"])(makeSkin({ itemTypeId: "unknown" }))).toBe(false);
  });

  it("matches when the root skin UUID is owned", () => {
    const isOwned = createBundleOwnershipLookup(["skin-root"]);
    expect(isOwned(makeSkin())).toBe(true);
  });

  it("matches when a nested skin level UUID is owned", () => {
    const isOwned = createBundleOwnershipLookup(["level-2"]);
    expect(isOwned(makeSkin())).toBe(true);
  });

  it("matches when a nested chroma UUID is owned", () => {
    const isOwned = createBundleOwnershipLookup(["chroma-base"]);
    expect(isOwned(makeSkin())).toBe(true);
  });

  it("does not match an unrelated skin", () => {
    const isOwned = createBundleOwnershipLookup(["someone-elses-level"]);
    expect(isOwned(makeSkin())).toBe(false);
    expect(
      isOwned(
        makeSkin({
          uuid: "other-root",
          levels: [{ uuid: "other-level", displayName: "Level 1", assetPath: "" }],
          chromas: [
            {
              uuid: "other-chroma",
              displayName: "Standard",
              fullRender: "https://example.com/other.png",
              assetPath: "",
            },
          ],
        })
      )
    ).toBe(false);
  });

  it("never badges an accessory even when its UUID collides with an owned skin ID", () => {
    // Phụ kiện không có bằng chứng sở hữu (entitlement chỉ là SkinLevel/
    // SkinChroma) — UUID trùng nhau tuyệt đối không được sinh badge.
    const isOwned = createBundleOwnershipLookup(["skin-root", "level-1", "chroma-base"]);
    expect(isOwned(makeAccessory({ uuid: "skin-root" }))).toBe(false);
    expect(isOwned(makeAccessory({ uuid: "level-1" }))).toBe(false);
  });

  it("returns false when ownership evidence is absent", () => {
    const isOwned = createBundleOwnershipLookup([]);
    expect(isOwned(makeSkin())).toBe(false);
    expect(isOwned(makeAccessory())).toBe(false);
  });

  it("does not mutate or rely on mutable caller input", () => {
    const ownedItemIds = Object.freeze(["level-1", "level-1", "skin-root"]);
    const skin = Object.freeze(makeSkin());
    const skinLevels = Object.freeze(skin.levels);
    const skinChromas = Object.freeze(skin.chromas);

    const isOwned: BundleOwnershipMatcher =
      createBundleOwnershipLookup(ownedItemIds);

    expect(isOwned(skin)).toBe(true);
    expect(isOwned(skin)).toBe(true);
    expect(ownedItemIds).toEqual(["level-1", "level-1", "skin-root"]);
    expect(skin.levels).toBe(skinLevels);
    expect(skin.chromas).toBe(skinChromas);
    expect(skin.uuid).toBe("skin-root");
  });

  it("is stable across repeated evaluations of the same item", () => {
    const isOwned = createBundleOwnershipLookup(["chroma-base"]);
    const skin = makeSkin();
    const first = isOwned(skin);
    expect(isOwned(skin)).toBe(first);
  });
});
