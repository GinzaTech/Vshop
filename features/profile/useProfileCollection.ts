import React from "react";
import { filterProfileCollection } from "./profile-derived-data";
import { getAssets } from "~/utils/valorant-assets";
import { CATEGORY_ORDER, TabKey, OwnedWeaponCollectionItem, resolveCategory } from "~/components/GalleryProfile";
import { getContentTierVisual } from "~/utils/content-tier";
import { getProfileWeaponOrderIndex, normalizeProfileWeaponCategory } from "~/features/profile/profile-loadout";
import type { useProfileLoadoutData } from "./useProfileLoadoutData";
import type { useProfileState } from "./useProfileState";
import type { useProfileSession } from "./useProfileSession";
type ProfileListRow =
    | { key: "identity"; kind: "identity" }
    | { key: "expressions"; kind: "expressions" }
    | { key: string; kind: "skin-category"; category: string }
    | {
      key: string;
      kind: "collection-row";
      items: OwnedWeaponCollectionItem[];
    }
    | { key: string; kind: "loading" }
    | {
      key: string;
      kind: "message";
      message: string;
      tone: "error" | "empty";
    };
type Props = Pick<ReturnType<typeof useProfileLoadoutData>,
  "loadoutDetails" |
  "ownedSkinIdSet" |
  "skinWeaponMetadata" |
  "loadoutSorted" |
  "orderedLoadoutCategories"> &
Pick<ReturnType<typeof useProfileState>, "collectionWeaponFilter" | "setCollectionWeaponFilter" | "searchQuery" | "loading" | "error"> &
Pick<ReturnType<typeof useProfileSession>, "t" | "profileGridColumns">;

export function useProfileCollection({
  loadoutDetails, ownedSkinIdSet, skinWeaponMetadata, loadoutSorted, collectionWeaponFilter,
  setCollectionWeaponFilter, searchQuery, loading, error, t, orderedLoadoutCategories, profileGridColumns,
}: Props) {


  // ─── ownedCollection: Bộ sưu tập skin đã sở hữu ─────────────────────────────
  const ownedCollection = React.useMemo<OwnedWeaponCollectionItem[]>(() => {
    const assets = getAssets();
    const equippedBySkinId = new Map(
        loadoutDetails.map((weapon) => [weapon.skinId, weapon] as const)
    );

    const categoryWeight = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(
          category as (typeof CATEGORY_ORDER)[number]
      );
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    const ownedSkins = assets.skins
        .filter((skin) => {
          if (!skin.contentTierUuid) {
            return false;
          }

          return (
              ownedSkinIdSet.has(skin.uuid) ||
              skin.levels.some((level) => ownedSkinIdSet.has(level.uuid)) ||
              skin.chromas.some((chroma) => ownedSkinIdSet.has(chroma.uuid))
          );
        })
        .map((skin) => {
          const weapon = skinWeaponMetadata.get(skin.uuid);
          const equippedWeapon = equippedBySkinId.get(skin.uuid);
          const category = normalizeProfileWeaponCategory(resolveCategory(weapon));
          const weaponName = weapon?.displayName || equippedWeapon?.weaponName || "Unknown";
          const ownedLevels = skin.levels.filter((level) =>
              ownedSkinIdSet.has(level.uuid)
          );
          const ownedChromas = skin.chromas.filter((chroma) =>
              ownedSkinIdSet.has(chroma.uuid)
          );
          const selectedLevel =
              ownedLevels[ownedLevels.length - 1] ||
              skin.levels[skin.levels.length - 1] ||
              skin.levels[0];
          const selectedChroma =
              ownedChromas[0] ||
              skin.chromas[0];
          const upgradeLevelIndex = skin.levels.findIndex(
              (level) => level.uuid === selectedLevel?.uuid
          );
          const tierVisual = getContentTierVisual(skin.contentTierUuid);

          return {
            collectionId: skin.uuid,
            weaponId: weapon?.uuid || equippedWeapon?.weaponId || skin.uuid,
            weaponName,
            category,
            skinId: skin.uuid,
            skinLevelId: selectedLevel?.uuid || equippedWeapon?.skinLevelId || "",
            chromaId: selectedChroma?.uuid || equippedWeapon?.chromaId || "",
            charmInstanceId: equippedWeapon?.charmInstanceId,
            charmId: equippedWeapon?.charmId,
            charmLevelId: equippedWeapon?.charmLevelId,
            skinName: skin.displayName,
            skinLevelName: selectedLevel?.displayName,
            chromaName: selectedChroma?.displayName,
            image:
                selectedChroma?.displayIcon ||
                selectedLevel?.displayIcon ||
                skin.displayIcon ||
                selectedChroma?.fullRender,
            buddyName: equippedWeapon?.buddyName,
            buddyIcon: equippedWeapon?.buddyIcon,
            contentTierUuid: skin.contentTierUuid,
            contentTierName: tierVisual.label,
            upgradeLevel:
                upgradeLevelIndex >= 0 ? upgradeLevelIndex + 1 : undefined,
            maxUpgradeLevel: skin.levels.length || undefined,
          };
        })
        .sort((a, b) => {
          const categoryDiff = categoryWeight(a.category) - categoryWeight(b.category);
          if (categoryDiff !== 0) {
            return categoryDiff;
          }

          const weaponDiff =
              getProfileWeaponOrderIndex(a.weaponName) -
              getProfileWeaponOrderIndex(b.weaponName);
          if (weaponDiff !== 0) {
            return weaponDiff;
          }

          const weaponNameDiff = a.weaponName.localeCompare(b.weaponName);
          if (weaponNameDiff !== 0) {
            return weaponNameDiff;
          }

          return a.skinName.localeCompare(b.skinName);
        });

    if (ownedSkins.length > 0) {
      return ownedSkins;
    }

    return loadoutSorted.map((weapon) => ({
      ...weapon,
      collectionId: weapon.skinId || weapon.weaponId,
    }));
  }, [loadoutDetails, loadoutSorted, ownedSkinIdSet, skinWeaponMetadata]);

  // ─── collectionWeaponTabs: Danh sách tab lọc vũ khí trong collection ──────
  const collectionWeaponTabs = React.useMemo(() => {
    const uniqueWeaponNames = Array.from(
        new Set(
            ownedCollection
                .map((item) => item.weaponName)
                .filter((weaponName) => weaponName?.trim().length)
        )
    );

    uniqueWeaponNames.sort((left, right) => {
      const orderDiff =
          getProfileWeaponOrderIndex(left) - getProfileWeaponOrderIndex(right);
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return left.localeCompare(right);
    });

    return ["all", ...uniqueWeaponNames];
  }, [ownedCollection]);

  React.useEffect(() => {
    if (
        collectionWeaponFilter !== "all" &&
        !collectionWeaponTabs.includes(collectionWeaponFilter)
    ) {
      setCollectionWeaponFilter("all");
    }
  }, [collectionWeaponFilter, collectionWeaponTabs, setCollectionWeaponFilter]);

  // ─── filteredCollection: Collection đã lọc theo tab weapon + search query ─
const filteredCollection = React.useMemo(() => filterProfileCollection(ownedCollection, collectionWeaponFilter, searchQuery), [collectionWeaponFilter, ownedCollection, searchQuery]);
  // profileListRowsByTab: build rows (loading/error/empty/section) cho từng tab.
  const profileListRowsByTab = React.useMemo<Record<TabKey, ProfileListRow[]>>(() => {
    if (loading) {
      const rows: ProfileListRow[] = [
        { key: "status-loading", kind: "loading" },
      ];
      return { loadout: rows, skins: rows, collection: rows };
    }

    if (error) {
      const rows: ProfileListRow[] = [
        {
          key: "status-error",
          kind: "message",
          message: error,
          tone: "error",
        },
      ];
      return { loadout: rows, skins: rows, collection: rows };
    }

    const loadoutRows: ProfileListRow[] = [
      { key: "identity", kind: "identity" },
      { key: "expressions", kind: "expressions" },
    ];

    if (loadoutSorted.length === 0) {
      const emptyRows: ProfileListRow[] = [
        {
          key: "status-empty-loadout",
          kind: "message",
          message: t("equip_page.empty"),
          tone: "empty",
        },
      ];
      return {
        loadout: loadoutRows,
        skins: emptyRows,
        collection: emptyRows,
      };
    }

    const skinRows: ProfileListRow[] = orderedLoadoutCategories.map(
        (category) => ({
        key: `skin-category:${category}`,
        kind: "skin-category" as const,
        category,
      })
    );

    let collectionRows: ProfileListRow[];
    if (filteredCollection.length === 0) {
      collectionRows = [
        {
          key: "status-empty-collection",
          kind: "message",
          message: t("equip_page.empty"),
          tone: "empty",
        },
      ];
    } else {
      collectionRows = [];
      for (
        let index = 0;
        index < filteredCollection.length;
        index += profileGridColumns
      ) {
        const items = filteredCollection.slice(index, index + profileGridColumns);
        collectionRows.push({
          key: `collection-row:${items[0].collectionId}`,
          kind: "collection-row",
          items,
        });
      }
    }

    return {
      loadout: loadoutRows,
      skins: skinRows,
      collection: collectionRows,
    };
  }, [
    error,
    filteredCollection,
    loading,
    loadoutSorted.length,
    orderedLoadoutCategories,
    profileGridColumns,
    t,
  ]);
  return { ownedCollection, collectionWeaponTabs, profileListRowsByTab };
}
