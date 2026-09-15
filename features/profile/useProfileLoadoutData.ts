import React from "react";
import { buildProfileLoadoutDetails } from "./profile-derived-data";
import { type CollectionCheckerProfile } from "~/components/profile/CollectionCheckerExport";
import { getAssets } from "~/utils/valorant-assets";
import { CATEGORY_ORDER, WeaponMetadata, EquippedWeapon, EquippedSpray, IdentityDetails } from "~/components/GalleryProfile";
import { VItemTypes } from "~/utils/misc";
import {
  getProfileWeaponOrderIndex, type EquippedExpression, type OwnedPlayerCardOption,
  type OwnedPlayerTitleOption,
} from "~/features/profile/profile-loadout";
import type { useProfileState } from "./useProfileState";
import type { useProfileSession } from "./useProfileSession";
import type { useProfileHeroData } from "./useProfileHeroData";

type Props = Pick<ReturnType<typeof useProfileState>,
  "rawGuns" |
  "weaponMetadata" |
  "rawSprays" |
  "rawActiveExpressions" |
  "identity" |
  "competitiveRank" |
  "ownedSkinItemIds" |
  "ownedSprayItemIds" |
  "ownedFlexItemIds" |
  "ownedPlayerCardItemIds" |
  "ownedPlayerTitleItemIds"> &
Pick<ReturnType<typeof useProfileSession>, "t" | "user"> &
Pick<ReturnType<typeof useProfileHeroData>, "regionLabel">;

export function useProfileLoadoutData({
  rawGuns, weaponMetadata, t, rawSprays, rawActiveExpressions, identity, user, regionLabel,
  competitiveRank, ownedSkinItemIds, ownedSprayItemIds, ownedFlexItemIds, ownedPlayerCardItemIds,
  ownedPlayerTitleItemIds,
}: Props) {


  // ─── loadoutDetails: Map rawGuns → EquippedWeapon[] với đầy đủ metadata ──
  // Kết hợp dữ liệu từ weaponMetadata và assets để tạo object hiển thị.
const loadoutDetails = React.useMemo(() => buildProfileLoadoutDetails(rawGuns, weaponMetadata, t), [rawGuns, t, weaponMetadata]);

  // ─── loadoutSorted: Sắp xếp loadout theo category → weapon order → tên ──
  const loadoutSorted = React.useMemo(() => {
    const categoryWeight = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(
          category as (typeof CATEGORY_ORDER)[number]
      );
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    return [...loadoutDetails].sort((a, b) => {
      const diff = categoryWeight(a.category) - categoryWeight(b.category);
      if (diff !== 0) return diff;

      const weaponDiff =
          getProfileWeaponOrderIndex(a.weaponName) -
          getProfileWeaponOrderIndex(b.weaponName);
      if (weaponDiff !== 0) return weaponDiff;

      return a.weaponName.localeCompare(b.weaponName);
    });
  }, [loadoutDetails]);

  // ─── loadoutByCategory: Nhóm loadout theo category ─────────────────────────
  const loadoutByCategory = React.useMemo(
      () =>
          loadoutSorted.reduce<Record<string, EquippedWeapon[]>>((groups, weapon) => {
            const category = weapon.category || "Other";
            (groups[category] ??= []).push(weapon);
            return groups;
          }, {}),
      [loadoutSorted]
  );

  // ─── orderedLoadoutCategories: Danh sách category đã sắp xếp ──────────────
  // Categories biết trước (trong CATEGORY_ORDER) + các category lạ.
  const orderedLoadoutCategories = React.useMemo(() => {
    const knownCategories = CATEGORY_ORDER.filter(
        (category) => loadoutByCategory[category]?.length
    );
    const customCategories = Object.keys(loadoutByCategory).filter(
        (category) =>
            !CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number])
    );

    return [...knownCategories, ...customCategories];
  }, [loadoutByCategory]);

  // ─── sprayDetails: Map rawSprays → EquippedSpray[] ────────────────────────
  const sprayDetails = React.useMemo<EquippedSpray[]>(() => {
    const assets = getAssets();

    return rawSprays
        .map((spray) => {
          const sprayAsset = assets.sprays.find(
              (item) => item.uuid === spray.SprayID
          );

          if (!sprayAsset) return null;

          return {
            id: spray.SprayID,
            slot: spray.EquipSlotID,
            sprayLevelId: spray.SprayLevelID,
            name: sprayAsset.displayName,
            icon: sprayAsset.displayIcon,
          };
        })
        .filter(Boolean) as EquippedSpray[];
  }, [rawSprays]);

  // ─── expressionDetails: Map rawActiveExpressions → EquippedExpression[] ──
  const expressionDetails = React.useMemo<EquippedExpression[]>(() => {
    const assets = getAssets();

    return rawActiveExpressions
        .map((expression, slotIndex) => {
          const typeId = expression.TypeID.toLowerCase();

          if (typeId === VItemTypes.Spray.toLowerCase()) {
            const spray = assets.sprays.find(
                (item) =>
                    item.uuid === expression.AssetID ||
                    item.levels.some((level) => level.uuid === expression.AssetID)
            );

            return {
              slotIndex,
              kind: "spray" as const,
              id: expression.AssetID,
              name: spray?.displayName || "Graffiti",
              icon:
                  spray?.fullTransparentIcon ||
                  spray?.displayIcon ||
                  spray?.fullIcon,
            };
          }

          if (typeId === VItemTypes.Flex.toLowerCase()) {
            const flex = assets.flex.find(
                (item) => item.uuid === expression.AssetID
            );

            return {
              slotIndex,
              kind: "flex" as const,
              id: expression.AssetID,
              name: flex?.displayName || "Flex",
              icon: flex?.displayIcon,
            };
          }

          return null;
        })
        .filter(Boolean) as EquippedExpression[];
  }, [rawActiveExpressions]);

  // ─── identityDetails: Thông tin identity đã enrich từ assets ──────────────
  const identityDetails = React.useMemo<IdentityDetails | null>(() => {
    if (!identity) return null;

    const assets = getAssets();
    const card = assets.cards.find((item) => item.uuid === identity.PlayerCardID);
    const title = assets.titles.find((item) => item.uuid === identity.PlayerTitleID);
    const accountLevel =
        identity.AccountLevel > 0 ? identity.AccountLevel : user.progress.level;

    return {
      cardId: identity.PlayerCardID,
      cardArt: card?.displayIcon || card?.largeArt || card?.wideArt,
      cardName: card?.displayName,
      titleName: title?.titleText || title?.displayName,
      level: accountLevel,
      hideLevel: identity.HideAccountLevel,
    };
  }, [identity, user.progress.level]);
  // collectionCheckerProfile: profile gọn cho CollectionCheckerExport (export collection).
  const collectionCheckerProfile = React.useMemo<CollectionCheckerProfile>(
      () => ({
        gameName: user.name,
        tagLine: user.TagLine,
        region: regionLabel,
        level: identityDetails?.level ?? user.progress.level,
        avatarUri: identityDetails?.cardArt,
        avatarCacheId: identityDetails?.cardId
            ? `player-card:${identityDetails.cardId}:avatar`
            : undefined,
        rank: competitiveRank,
        balances: {
          vp: user.balances.vp,
          rad: user.balances.rad,
          kc: user.balances.kc,
        },
      }),
      [
        competitiveRank,
        identityDetails?.cardArt,
        identityDetails?.cardId,
        identityDetails?.level,
        regionLabel,
        user.TagLine,
        user.balances.kc,
        user.balances.rad,
        user.balances.vp,
        user.name,
        user.progress.level,
      ]
  );

  // ─── ownedSkinIdSet/Spray/Flex/Card/Title: Set từ danh sách ID sở hữu ──
  // Dùng để kiểm tra nhanh "có sở hữu item này không?" (O(1)).
  const ownedSkinIdSet = React.useMemo(
      () => new Set(ownedSkinItemIds),
      [ownedSkinItemIds]
  );

  const ownedSprayIdSet = React.useMemo(
      () => new Set(ownedSprayItemIds),
      [ownedSprayItemIds]
  );

  const ownedFlexIdSet = React.useMemo(
      () => new Set(ownedFlexItemIds),
      [ownedFlexItemIds]
  );

  const ownedPlayerCardIdSet = React.useMemo(
      () => new Set(ownedPlayerCardItemIds.map((itemId) => itemId.toLowerCase())),
      [ownedPlayerCardItemIds]
  );

  const ownedPlayerTitleIdSet = React.useMemo(
      () => new Set(ownedPlayerTitleItemIds.map((itemId) => itemId.toLowerCase())),
      [ownedPlayerTitleItemIds]
  );

  const ownedPlayerCardOptions = React.useMemo<OwnedPlayerCardOption[]>(() => {
    const currentCardId = identity?.PlayerCardID?.toLowerCase();
    const options: OwnedPlayerCardOption[] = getAssets()
        .cards.filter(
            (card) =>
                card.uuid.toLowerCase() === currentCardId ||
                ownedPlayerCardIdSet.has(card.uuid.toLowerCase())
        )
        .map((card) => ({
          id: card.uuid,
          name: card.displayName,
          image: card.displayIcon || card.smallArt || card.largeArt,
          selected: card.uuid.toLowerCase() === currentCardId,
        }));

    if (identity?.PlayerCardID && !options.some((option) => option.selected)) {
      options.push({
        id: identity.PlayerCardID,
        name:
            identityDetails?.cardName ||
            t("equip_page.identity.card_fallback"),
        image: identityDetails?.cardArt,
        selected: true,
      });
    }

    return options.sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "vi");
    });
  }, [identity?.PlayerCardID, identityDetails, ownedPlayerCardIdSet, t]);

  const ownedPlayerTitleOptions = React.useMemo<OwnedPlayerTitleOption[]>(() => {
    const currentTitleId = identity?.PlayerTitleID?.toLowerCase();
    const options = getAssets()
        .titles.filter(
            (title) =>
                title.uuid.toLowerCase() === currentTitleId ||
                ownedPlayerTitleIdSet.has(title.uuid.toLowerCase())
        )
        .map((title) => ({
          id: title.uuid,
          name:
              title.titleText?.trim() ||
              title.displayName ||
              t("equip_page.identity.title_fallback"),
          selected: title.uuid.toLowerCase() === currentTitleId,
        }));

    if (identity?.PlayerTitleID && !options.some((option) => option.selected)) {
      options.push({
        id: identity.PlayerTitleID,
        name:
            identityDetails?.titleName ||
            t("equip_page.identity.title_fallback"),
        selected: true,
      });
    }

    return options.sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "vi");
    });
  }, [identity?.PlayerTitleID, identityDetails, ownedPlayerTitleIdSet, t]);

  const equippedExpressionIdSet = React.useMemo(
      () => new Set(rawActiveExpressions.map((expression) => expression.AssetID)),
      [rawActiveExpressions]
  );

  // ─── skinWeaponMetadata: Map skinUUID → weapon metadata ──────────────────
  // Tra ngược: từ skin UUID tìm weapon cha.
  const skinWeaponMetadata = React.useMemo(() => {
    const map = new Map<string, WeaponMetadata>();

    Object.values(weaponMetadata).forEach((weapon) => {
      weapon.skins?.forEach((skin) => {
        map.set(skin.uuid, weapon);
      });
    });

    return map;
  }, [weaponMetadata]);
  return {
    loadoutDetails, loadoutSorted, loadoutByCategory, orderedLoadoutCategories, sprayDetails,
    expressionDetails, identityDetails, collectionCheckerProfile, ownedSkinIdSet, ownedSprayIdSet,
    ownedFlexIdSet, ownedPlayerCardOptions, ownedPlayerTitleOptions, equippedExpressionIdSet,
    skinWeaponMetadata,
  };
}
