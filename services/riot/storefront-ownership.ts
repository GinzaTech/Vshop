import { VItemTypes } from "~/utils/misc";

/** Display metadata can remap a grant/level ID to its parent asset UUID. */
export function attachBundleOwnershipIdentity(
  items: readonly (SkinShopItem | AccessoryShopItem)[],
  offers: BundleSchema["Items"],
  buddies: ReadonlyMap<string, ValorantBuddyAccessory>,
): (SkinShopItem | AccessoryShopItem)[] {
  return items.map((item, index) => {
    const grant = offers[index].Item;
    const buddy = grant.ItemTypeID === VItemTypes.Buddy ? buddies.get(grant.ItemID) : undefined;
    return {
      ...item,
      itemTypeId: grant.ItemTypeID,
      entitlementItemIds: [...new Set([grant.ItemID, ...(buddy?.levels?.map((level) => level.uuid) ?? [])])],
    };
  });
}
