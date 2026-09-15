import { filterProfileCollection, buildProfileLoadoutDetails } from "~/features/profile/profile-derived-data";
import type { OwnedWeaponCollectionItem, PlayerLoadoutGun, WeaponMetadataMap } from "~/components/GalleryProfile";
import type { TFunction } from "i18next";

jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({
  skins: [{ uuid: "skin", displayName: "Prime Vandal", displayIcon: "skin.png", contentTierUuid: "tier",
    levels: [{ uuid: "level", displayName: "Level 1" }], chromas: [{ uuid: "chroma", displayName: "Green", fullRender: "green.png" }] }],
  buddies: [],
}) }));
jest.mock("~/utils/content-tier", () => ({ getContentTierVisual: () => ({ label: "Premium" }) }));

const t = ((key: string) => key) as TFunction;
describe("profile derived loadout and collection data", () => {
  it("combines loadout IDs with weapon metadata and preserves chroma fallback", () => {
    const guns = [{ ID: "weapon", SkinID: "skin", SkinLevelID: "level", ChromaID: "chroma" }] as PlayerLoadoutGun[];
    const metadata = { weapon: { uuid: "weapon", displayName: "Vandal", category: "EEquippableCategory::Rifle" } } as WeaponMetadataMap;
    const before = JSON.stringify(guns);
    expect(buildProfileLoadoutDetails(guns, metadata, t)).toEqual([expect.objectContaining({
      weaponId: "weapon", weaponName: "Vandal", skinName: "Prime Vandal", chromaName: "Green",
      upgradeLevel: 1, maxUpgradeLevel: 1, contentTierName: "Premium",
    })]);
    expect(JSON.stringify(guns)).toBe(before);
  });
  it("filters category/weapon/name case-insensitively without changing source order", () => {
    const collection = [
      { collectionId: "one", weaponName: "Vandal", skinName: "Prime Vandal", category: "Rifles" },
      { collectionId: "two", weaponName: "Phantom", skinName: "Oni Phantom", category: "Rifles" },
    ] as OwnedWeaponCollectionItem[];
    expect(filterProfileCollection(collection, "VANDAL", " prime ")).toEqual([collection[0]]);
    expect(filterProfileCollection(collection, "all", "RIFLES")).toEqual(collection);
    expect(filterProfileCollection(collection, "all", "")).toBe(collection);
    expect(filterProfileCollection(collection, "Phantom", "prime")).toEqual([]);
    expect(collection.map((item) => item.collectionId)).toEqual(["one", "two"]);
  });
});
