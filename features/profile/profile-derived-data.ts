import type { TFunction } from "i18next";
import { type EquippedWeapon, type OwnedWeaponCollectionItem, type PlayerLoadoutGun, type WeaponMetadataMap, resolveCategory } from "~/components/GalleryProfile";
import { getAssets } from "~/utils/valorant-assets";
import { getContentTierVisual } from "~/utils/content-tier";
import { normalizeProfileWeaponCategory, normalizeWeaponKey } from "./profile-loadout";

export function buildProfileLoadoutDetails(rawGuns: readonly PlayerLoadoutGun[], weaponMetadata: WeaponMetadataMap, t: TFunction): EquippedWeapon[] {

    const assets = getAssets();

    return rawGuns.map((gun) => {
      const metadata = weaponMetadata[gun.ID];
      const category = normalizeProfileWeaponCategory(resolveCategory(metadata));

      const skin =
          assets.skins.find((item) => item.uuid === gun.SkinID) ||
          assets.skins.find((item) =>
              item.levels.some((level) => level.uuid === gun.SkinLevelID)
          );

      const chroma = skin?.chromas.find((item) => item.uuid === gun.ChromaID);
      const level = skin?.levels.find((item) => item.uuid === gun.SkinLevelID);
      const upgradeLevelIndex = skin?.levels.findIndex(
          (item) => item.uuid === gun.SkinLevelID
      );
      const tierVisual = getContentTierVisual(skin?.contentTierUuid);

      const buddy = assets.buddies.find(
          (item) =>
              item.uuid === gun.CharmID ||
              item.levels.some((level) => level.uuid === gun.CharmLevelID)
      );

      const buddyLevel =
          buddy?.levels.find((level) => level.uuid === gun.CharmLevelID) ||
          buddy?.levels?.[0];

      const weaponName = metadata?.displayName || skin?.displayName || gun.ID;

      return {
        weaponId: gun.ID,
        weaponName,
        category,
        skinId: gun.SkinID,
        skinLevelId: gun.SkinLevelID,
        chromaId: gun.ChromaID,
        charmInstanceId: gun.CharmInstanceID,
        charmId: gun.CharmID,
        charmLevelId: gun.CharmLevelID,
        skinName: skin?.displayName || t("equip_page.unknown_skin"),
        skinLevelName: level?.displayName,
        chromaName: chroma?.displayName,
        image:
            chroma?.displayIcon ||
            level?.displayIcon ||
            skin?.displayIcon ||
            chroma?.fullRender,
        buddyName: buddyLevel?.displayName || buddy?.displayName,
        buddyIcon: buddyLevel?.displayIcon,
        contentTierUuid: skin?.contentTierUuid,
        contentTierName: tierVisual.label,
        upgradeLevel:
            typeof upgradeLevelIndex === "number" && upgradeLevelIndex >= 0
                ? upgradeLevelIndex + 1
                : undefined,
        maxUpgradeLevel: skin?.levels.length,
      };
    });

}

export function filterProfileCollection(ownedCollection: OwnedWeaponCollectionItem[], collectionWeaponFilter: string, searchQuery: string): OwnedWeaponCollectionItem[] {

    const normalizedFilter = normalizeWeaponKey(collectionWeaponFilter);
    const scopedCollection =
        collectionWeaponFilter === "all"
            ? ownedCollection
            : ownedCollection.filter(
                (item) =>
                    normalizeWeaponKey(item.weaponName) === normalizedFilter
            );

    if (!searchQuery.trim()) return scopedCollection;

    const query = searchQuery.trim().toLowerCase();
    return scopedCollection.filter(
        (item) =>
            item.skinName.toLowerCase().includes(query) ||
            item.weaponName.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
    );

}
