import React from "react";
import { getAssets } from "~/utils/valorant-assets";
import { EquippedWeapon, EquippedSpray } from "~/components/GalleryProfile";
import { getContentTierVisual } from "~/utils/content-tier";
import {
  normalizeVariantLabel, normalizeWeaponKey, type EquippedExpression, type ExpressionKind,
  type OwnedExpressionOption, type OwnedSkinOption, type OwnedSprayOption,
} from "~/features/profile/profile-loadout";
import type { useProfileState } from "./useProfileState";
import type { useProfileLoadoutData } from "./useProfileLoadoutData";

type Props = Pick<ReturnType<typeof useProfileState>, "weaponMetadata"> &
Pick<ReturnType<typeof useProfileLoadoutData>, "ownedSkinIdSet" | "ownedSprayIdSet" | "equippedExpressionIdSet" | "ownedFlexIdSet">;

export function useProfilePickerOptions({ weaponMetadata, ownedSkinIdSet, ownedSprayIdSet, equippedExpressionIdSet, ownedFlexIdSet }: Props) {


  /**
   * buildOwnedSkinOptions — Xây dựng danh sách OwnedSkinOption cho một vũ khí.
   * Lọc các skin mà user sở hữu, kèm chroma options, tier, upgrade level.
   */
  const buildOwnedSkinOptions = React.useCallback(
      (weapon: EquippedWeapon): OwnedSkinOption[] => {
        const assets = getAssets();
        const metadata = weaponMetadata[weapon.weaponId];
        const weaponSkinIds = new Set((metadata?.skins ?? []).map((skin) => skin.uuid));
        const normalizedWeaponName = normalizeWeaponKey(weapon.weaponName);
        const candidateSkins = assets.skins.filter((skin) => {
          if (weaponSkinIds.size > 0) {
            return weaponSkinIds.has(skin.uuid) || skin.uuid === weapon.skinId;
          }

          if (skin.uuid === weapon.skinId) {
            return true;
          }

          if (!normalizedWeaponName) {
            return false;
          }

          const skinName = normalizeWeaponKey(skin.displayName);
          const levelNames = (skin.levels ?? []).map((level) =>
              normalizeWeaponKey(level.displayName)
          );

          return (
              skinName.includes(normalizedWeaponName) ||
              levelNames.some((levelName) => levelName.includes(normalizedWeaponName))
          );
        });

        const options = candidateSkins
            .filter(
                (skin) =>
                    skin.uuid === weapon.skinId ||
                    ownedSkinIdSet.has(skin.uuid) ||
                    skin.levels.some((level) => ownedSkinIdSet.has(level.uuid)) ||
                    skin.chromas.some((chroma) => ownedSkinIdSet.has(chroma.uuid))
            )
            .filter(
                (skin, index, list) =>
                    list.findIndex((item) => item.uuid === skin.uuid) === index
            )
            .map((skin) => {
              const currentLevel = skin.levels.find(
                  (level) => level.uuid === weapon.skinLevelId
              );
              const ownedLevels = skin.levels.filter((level) =>
                  ownedSkinIdSet.has(level.uuid)
              );
              const selectedLevel =
                  currentLevel ||
                  ownedLevels[ownedLevels.length - 1] ||
                  skin.levels[0];

              const levelIndex = skin.levels.findIndex(
                  (level) => level.uuid === selectedLevel?.uuid
              );
              const tier = getContentTierVisual(skin.contentTierUuid);
              const chromaOptions = skin.chromas
                  .filter(Boolean)
                  .filter(
                      (chroma, index, list) =>
                          list.findIndex((item) => item.uuid === chroma.uuid) === index
                  );
              const previewChroma =
                  chromaOptions.find((chroma) => chroma.uuid === weapon.chromaId) ||
                  chromaOptions[0];

              return {
                id: skin.uuid,
                skinId: skin.uuid,
                skinLevelId: selectedLevel?.uuid || weapon.skinLevelId,
                chromaId: previewChroma?.uuid || weapon.chromaId,
                name: skin.displayName,
                chromaName:
                    normalizeVariantLabel(skin.displayName, previewChroma?.displayName) ||
                    undefined,
                image:
                    previewChroma?.displayIcon ||
                    selectedLevel?.displayIcon ||
                    skin.displayIcon ||
                    previewChroma?.fullRender,
                contentTierUuid: skin.contentTierUuid,
                contentTierName: tier.label,
                upgradeLevel: levelIndex >= 0 ? levelIndex + 1 : undefined,
                maxUpgradeLevel: skin.levels.length || undefined,
                chromas: chromaOptions.map((chroma) => ({
                  id: chroma.uuid,
                  name:
                      normalizeVariantLabel(skin.displayName, chroma.displayName) ||
                      "Default",
                  swatch: chroma.swatch,
                  image: chroma.displayIcon || chroma.fullRender,
                  selected: chroma.uuid === weapon.chromaId,
                })),
                selected:
                    skin.uuid === weapon.skinId &&
                    (selectedLevel?.uuid || weapon.skinLevelId) === weapon.skinLevelId &&
                    (previewChroma?.uuid || weapon.chromaId) === weapon.chromaId,
              };
            })
            .sort((a, b) => {
              const selectedDiff = Number(b.selected) - Number(a.selected);
              if (selectedDiff !== 0) {
                return selectedDiff;
              }

              const nameDiff = a.name.localeCompare(b.name);
              if (nameDiff !== 0) {
                return nameDiff;
              }

              return (a.chromaName || "").localeCompare(b.chromaName || "");
            });

        return options;
      },
      [ownedSkinIdSet, weaponMetadata]
  );

  /**
   * buildOwnedSprayOptions — Xây dựng danh sách OwnedSprayOption.
   */
  const buildOwnedSprayOptions = React.useCallback(
      (spray: EquippedSpray): OwnedSprayOption[] => {
        const assets = getAssets();

        return assets.sprays
            .filter(
                (sprayAsset) =>
                    sprayAsset.uuid === spray.id ||
                    ownedSprayIdSet.has(sprayAsset.uuid) ||
                    sprayAsset.levels.some((level) => ownedSprayIdSet.has(level.uuid))
            )
            .map((sprayAsset) => ({
              id: sprayAsset.uuid,
              sprayId: sprayAsset.uuid,
              sprayLevelId: sprayAsset.levels[0]?.uuid ?? null,
              name: sprayAsset.displayName,
              icon:
                  sprayAsset.fullTransparentIcon ||
                  sprayAsset.displayIcon ||
                  sprayAsset.fullIcon,
              selected: sprayAsset.uuid === spray.id,
            }))
            .sort((a, b) => {
              const selectedDiff = Number(b.selected) - Number(a.selected);
              if (selectedDiff !== 0) {
                return selectedDiff;
              }

              return a.name.localeCompare(b.name);
            });
      },
      [ownedSprayIdSet]
  );

  /**
   * buildOwnedExpressionOptions — Xây dựng danh sách OwnedExpressionOption.
   * Hỗ trợ cả spray và flex.
   */
  const buildOwnedExpressionOptions = React.useCallback(
      (
          expression: EquippedExpression,
          kind: ExpressionKind
      ): OwnedExpressionOption[] => {
        const assets = getAssets();
        const options =
            kind === "spray"
                ? assets.sprays
                    .filter(
                        (spray) =>
                            equippedExpressionIdSet.has(spray.uuid) ||
                            ownedSprayIdSet.has(spray.uuid) ||
                            spray.levels.some(
                                (level) =>
                                    equippedExpressionIdSet.has(level.uuid) ||
                                    ownedSprayIdSet.has(level.uuid)
                            )
                    )
                    .map((spray) => ({
                      id: spray.uuid,
                      kind: "spray" as const,
                      assetId: spray.uuid,
                      name: spray.displayName,
                      icon:
                          spray.fullTransparentIcon ||
                          spray.displayIcon ||
                          spray.fullIcon,
                      selected:
                          expression.kind === "spray" &&
                          spray.uuid === expression.id,
                    }))
                : assets.flex
                    .filter(
                        (flex) =>
                            equippedExpressionIdSet.has(flex.uuid) ||
                            ownedFlexIdSet.has(flex.uuid)
                    )
                    .map((flex) => ({
                      id: flex.uuid,
                      kind: "flex" as const,
                      assetId: flex.uuid,
                      name: flex.displayName,
                      icon: flex.displayIcon,
                      selected:
                          expression.kind === "flex" && flex.uuid === expression.id,
                    }));

        return options.sort((left, right) => {
          const selectedDiff = Number(right.selected) - Number(left.selected);
          return selectedDiff || left.name.localeCompare(right.name);
        });
      },
      [equippedExpressionIdSet, ownedFlexIdSet, ownedSprayIdSet]
  );
  return { buildOwnedSkinOptions, buildOwnedSprayOptions, buildOwnedExpressionOptions };
}
