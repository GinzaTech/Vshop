import { VItemTypes } from "~/utils/misc";

export type BundleOwnershipItem = SkinShopItem | AccessoryShopItem;
export type BundleOwnershipMatcher = (item: BundleOwnershipItem) => boolean;

const ACCESSORY_TYPES = [VItemTypes.Spray, VItemTypes.Flex, VItemTypes.PlayerCard,
  VItemTypes.PlayerTitle, VItemTypes.Buddy];

function isSkinShopItem(item: BundleOwnershipItem): item is SkinShopItem {
  return Array.isArray((item as SkinShopItem).levels) &&
    Array.isArray((item as SkinShopItem).chromas);
}

/** Snapshot inventories; legacy evidence proves only skins, accessories require an exact type. */
export function createBundleOwnershipLookup(
  ownedSkinIds: readonly string[],
  ownedByType: Readonly<Record<string, readonly string[]>> = {},
): BundleOwnershipMatcher {
  const skins = new Set([...ownedSkinIds, ...(ownedByType[VItemTypes.SkinLevel] ?? []),
    ...(ownedByType[VItemTypes.SkinChroma] ?? [])]);
  const accessories = new Map(ACCESSORY_TYPES.map((type) => [type, new Set(ownedByType[type] ?? [])]));

  return (item) => {
    const identities = [item.uuid, ...(item.entitlementItemIds ?? [])];
    if (item.itemTypeId !== undefined && accessories.has(item.itemTypeId)) {
      const owned = accessories.get(item.itemTypeId)!;
      return identities.some((id) => owned.has(id));
    }
    // Explicit unsupported/accessory metadata must never fall through to legacy skin IDs.
    if (item.itemTypeId !== undefined && item.itemTypeId !== VItemTypes.SkinLevel &&
      item.itemTypeId !== VItemTypes.SkinChroma) return false;
    if (!isSkinShopItem(item)) return false;
    return identities.some((id) => skins.has(id)) ||
      item.levels.some((level) => skins.has(level.uuid)) ||
      item.chromas.some((chroma) => skins.has(chroma.uuid));
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidInventory(): never {
  // Response contents may identify an account; never include them in error messages.
  throw new Error("Invalid Bundle inventory response");
}

function entitlementIds(value: unknown): string[] {
  if (!Array.isArray(value)) return invalidInventory();
  return value.map((row: unknown) => {
    if (!isRecord(row) || typeof row.ItemID !== "string" || !row.ItemID.trim()) {
      return invalidInventory();
    }
    return row.ItemID;
  });
}

/** Validate provenance before admitting positives; entitlement TypeID is not an item type. */
export function extractBundleOwnedItemIds(
  response: unknown,
  subject: string,
  itemTypeId: string,
): string[] {
  if (!isRecord(response) ||
    ("Subject" in response && response.Subject !== subject) ||
    ("ItemTypeID" in response && response.ItemTypeID !== itemTypeId)) return invalidInventory();

  if (!("Entitlements" in response) && !("EntitlementsByTypes" in response)) return invalidInventory();
  const flat = "Entitlements" in response ? entitlementIds(response.Entitlements) : [];
  const grouped = "EntitlementsByTypes" in response ? response.EntitlementsByTypes : [];
  if (!Array.isArray(grouped)) return invalidInventory();
  const matching = grouped.flatMap((group: unknown) => {
    if (!isRecord(group) || typeof group.ItemTypeID !== "string" || !group.ItemTypeID) return invalidInventory();
    return group.ItemTypeID === itemTypeId ? entitlementIds(group.Entitlements) : [];
  });
  return [...new Set([...flat, ...matching])];
}
