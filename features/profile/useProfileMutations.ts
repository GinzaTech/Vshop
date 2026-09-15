import React from "react";
import { PlayerLoadoutResponse, updatePlayerLoadout, updatePlayerLoadoutV3, updatePlayerLoadoutV3First } from "~/utils/valorant-api";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { updateProfileLoadoutCache } from "./profile-refresh-data";
import { EquippedWeapon, OwnedWeaponCollectionItem, EquippedSpray } from "~/components/GalleryProfile";
import { VItemTypes } from "~/utils/misc";
import {
  loadoutsMatch, sameOptionalId, type EquippedExpression, type OwnedExpressionOption, type OwnedSkinOption,
  type OwnedSprayOption, type PendingLoadoutUpdate,
} from "~/features/profile/profile-loadout";
import { confirmProfileLoadout } from "~/features/profile/confirm-loadout";
import type { useProfileState } from "./useProfileState";
import type { useProfileSession } from "./useProfileSession";
import type { useProfileFetch } from "./useProfileFetch";
import type { useProfilePickers } from "./useProfilePickers";
import type { useProfileLoadoutData } from "./useProfileLoadoutData";
import type { useProfilePickerOptions } from "./useProfilePickerOptions";

type Props = Pick<ReturnType<typeof useProfileState>,
  "competitiveRank" |
  "ownedSkinItemIds" |
  "ownedSprayItemIds" |
  "ownedFlexItemIds" |
  "ownedPlayerCardItemIds" |
  "ownedPlayerTitleItemIds" |
  "pendingLoadoutRef" |
  "loadoutMutationVersionRef" |
  "loadoutSnapshot" |
  "updatingLoadout" |
  "loadoutSnapshotRef" |
  "setPickerState" |
  "setIdentityPickerQuery" |
  "setPickerError" |
  "setUpdatingLoadout" |
  "setPickerLoading" |
  "setActiveWeaponChroma"> &
Pick<ReturnType<typeof useProfileSession>, "cachedCompetitiveRank" | "setProfileCache" | "authKey" | "cachedProfile" | "user" | "hasAuth" | "t"> &
Pick<ReturnType<typeof useProfileFetch>, "syncLoadoutState"> &
Pick<ReturnType<typeof useProfilePickers>, "handleDismissPicker" | "showLoadoutUpdateError" | "handleOpenWeaponPicker"> &
Pick<ReturnType<typeof useProfileLoadoutData>, "loadoutDetails"> &
Pick<ReturnType<typeof useProfilePickerOptions>, "buildOwnedSkinOptions">;

export function useProfileMutations({
  competitiveRank, cachedCompetitiveRank, setProfileCache, authKey, ownedSkinItemIds, ownedSprayItemIds,
  ownedFlexItemIds, ownedPlayerCardItemIds, ownedPlayerTitleItemIds, cachedProfile, pendingLoadoutRef,
  loadoutMutationVersionRef, syncLoadoutState, user, hasAuth, loadoutSnapshot, updatingLoadout,
  loadoutSnapshotRef, setPickerState, setIdentityPickerQuery, setPickerError, setUpdatingLoadout,
  handleDismissPicker, showLoadoutUpdateError, t, loadoutDetails, handleOpenWeaponPicker,
  buildOwnedSkinOptions, setPickerLoading, setActiveWeaponChroma,
}: Props) {

  // persistLoadoutCache: ghi loadout vào profile cache kèm ownership + rank hiện có.
  const persistLoadoutCache = React.useCallback(
      (nextLoadout: PlayerLoadoutResponse, confirmed = false) => {
        const previous = useProfileCacheStore.getState().cacheByAuth[authKey] ?? {
          authKey,
          loadoutSnapshot: cachedProfile?.loadoutSnapshot ?? null,
          loadoutCacheVersion: cachedProfile?.loadoutCacheVersion,
          ownedSkinItemIds,
          ownedSprayItemIds,
          ownedFlexItemIds,
          ownedPlayerCardItemIds,
          ownedPlayerTitleItemIds,
          competitiveRank,
          rankCacheVersion: cachedProfile?.rankCacheVersion,
          componentUpdatedAt: cachedProfile?.componentUpdatedAt,
          updatedAt: cachedProfile?.updatedAt ?? 0,
        };
        setProfileCache(updateProfileLoadoutCache(previous, nextLoadout, confirmed ? Date.now() : undefined));
      },
      [
        authKey,
        cachedProfile,
        competitiveRank,
        ownedFlexItemIds,
        ownedPlayerCardItemIds,
        ownedPlayerTitleItemIds,
        ownedSkinItemIds,
        ownedSprayItemIds,
        setProfileCache,
      ]
  );
  // applyOptimisticLoadout: hiển thị loadout mới NGAY (pending + version++) trước khi PUT.
  const applyOptimisticLoadout = React.useCallback(
      (nextLoadout: PlayerLoadoutResponse) => {
        const pendingUpdate: PendingLoadoutUpdate = {
          loadout: nextLoadout,
          updatedAt: Date.now(),
        };

        pendingLoadoutRef.current = pendingUpdate;
        loadoutMutationVersionRef.current += 1;
        syncLoadoutState(nextLoadout);
        persistLoadoutCache(nextLoadout);
        return pendingUpdate;
      },
      [loadoutMutationVersionRef, pendingLoadoutRef, persistLoadoutCache, syncLoadoutState]
  );
  // rollbackOptimisticLoadout: hoàn tác optimistic nếu PUT lỗi/pending đã bị thay.
  const rollbackOptimisticLoadout = React.useCallback(
      (
          previousLoadout: PlayerLoadoutResponse,
          pendingUpdate: PendingLoadoutUpdate
      ) => {
        if (pendingLoadoutRef.current !== pendingUpdate) {
          return;
        }

        pendingLoadoutRef.current = null;
        loadoutMutationVersionRef.current += 1;
        syncLoadoutState(previousLoadout);
        persistLoadoutCache(previousLoadout);
      },
      [loadoutMutationVersionRef, pendingLoadoutRef, persistLoadoutCache, syncLoadoutState]
  );
  // confirmLoadoutUpdate: xác nhận bằng GET thật (confirmProfileLoadout); khớp → sync.
  const confirmLoadoutUpdate = React.useCallback(
      async (
          expectedLoadout: PlayerLoadoutResponse,
          pendingUpdate: PendingLoadoutUpdate,
          matchesExpected: (
              latest: PlayerLoadoutResponse,
              expected: PlayerLoadoutResponse
          ) => boolean = loadoutsMatch
      ) => {
        const latestLoadout = await confirmProfileLoadout(
          { accessToken: user.accessToken, entitlementsToken: user.entitlementsToken,
            region: user.region, id: user.id }, expectedLoadout, pendingUpdate,
          () => pendingLoadoutRef.current, matchesExpected,
        );
        if (!latestLoadout) return;

        pendingLoadoutRef.current = null;
        syncLoadoutState(latestLoadout);
        persistLoadoutCache(latestLoadout, true);
      },
      [pendingLoadoutRef, persistLoadoutCache, syncLoadoutState, user.accessToken, user.entitlementsToken, user.id, user.region]
  );
  // handleEquipIdentity: equip card/title: optimistic → PUT v3 → confirm; lỗi → rollback.
  const handleEquipIdentity = React.useCallback(
      async (type: "player-card" | "player-title", optionId: string) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const identityField =
            type === "player-card" ? "PlayerCardID" : "PlayerTitleID";
        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;

        if (currentLoadout.Identity?.[identityField] === optionId) {
          setPickerState(null);
          setIdentityPickerQuery("");
          setPickerError(null);
          return;
        }

        const buildNextLoadout = (source: PlayerLoadoutResponse) => ({
          ...source,
          Identity: {
            ...source.Identity,
            [identityField]: optionId,
          },
        });

        const nextLoadout = buildNextLoadout(currentLoadout);
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip identity request", {
              type,
              optionId,
            });
          }

          const response = await updatePlayerLoadoutV3First(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...response,
            Identity: {
              ...response.Identity,
              [identityField]: optionId,
            },
          };

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse, true);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) =>
                  latestLoadout.Identity?.[identityField] === optionId
          );
        } catch (err) {
          if (__DEV__) {
            console.error("[profile] equip identity failed", sanitizeErrorForLog(err));
          }
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [applyOptimisticLoadout, confirmLoadoutUpdate, handleDismissPicker, hasAuth, loadoutSnapshot, loadoutSnapshotRef, pendingLoadoutRef, persistLoadoutCache, rollbackOptimisticLoadout, setIdentityPickerQuery, setPickerError, setPickerState, setUpdatingLoadout, showLoadoutUpdateError, syncLoadoutState, updatingLoadout, user.accessToken, user.entitlementsToken, user.id, user.region]
  );
  // handleEquipWeapon: equip skin/chroma cho súng: optimistic → PUT v3 → confirm theo gun.
  const handleEquipWeapon = React.useCallback(
      async (weapon: EquippedWeapon, option: OwnedSkinOption) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const buildNextLoadout = (source: PlayerLoadoutResponse) => {
          let weaponFound = false;
          const guns = (source.Guns || []).map((gun) => {
            if (gun.ID !== weapon.weaponId) {
              return gun;
            }

            weaponFound = true;
            return {
              ...gun,
              SkinID: option.skinId,
              SkinLevelID: option.skinLevelId,
              ChromaID: option.chromaId,
            };
          });

          return weaponFound ? { ...source, Guns: guns } : null;
        };

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const nextLoadout = buildNextLoadout(currentLoadout);
        if (!nextLoadout) {
          setPickerError(t("equip_page.error_loading"));
          return;
        }

        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip skin request", {
              weaponId: weapon.weaponId,
              weaponName: weapon.weaponName,
              fromSkinId: weapon.skinId,
              toSkinId: option.skinId,
              toSkinLevelId: option.skinLevelId,
              toChromaId: option.chromaId,
            });
          }

          const response = await updatePlayerLoadoutV3First(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            Guns: (response.Guns?.length ? response.Guns : nextLoadout.Guns).map(
                (gun) =>
                    gun.ID === weapon.weaponId
                        ? {
                          ...gun,
                          SkinID: option.skinId,
                          SkinLevelID: option.skinLevelId,
                          ChromaID: option.chromaId,
                        }
                        : gun
            ),
          };

          if (__DEV__) {
            const updatedGun = (putResponse.Guns || []).find(
                (gun) => gun.ID === weapon.weaponId
            );
            console.log("[profile] equip skin put response", {
              weaponId: weapon.weaponId,
              responseSkinId: updatedGun?.SkinID,
              responseSkinLevelId: updatedGun?.SkinLevelID,
              responseChromaId: updatedGun?.ChromaID,
            });
          }

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse, true);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) => {
                const latestGun = (latestLoadout.Guns || []).find(
                    (gun) => gun.ID === weapon.weaponId
                );

                return Boolean(
                    latestGun &&
                    latestGun.SkinID === option.skinId &&
                    latestGun.SkinLevelID === option.skinLevelId &&
                    latestGun.ChromaID === option.chromaId
                );
              }
          );
        } catch (err) {
          if (__DEV__) console.error(sanitizeErrorForLog(err));
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [applyOptimisticLoadout, confirmLoadoutUpdate, handleDismissPicker, hasAuth, loadoutSnapshot, loadoutSnapshotRef, pendingLoadoutRef, persistLoadoutCache, rollbackOptimisticLoadout, setPickerError, setUpdatingLoadout, showLoadoutUpdateError, syncLoadoutState, t, updatingLoadout, user.accessToken, user.entitlementsToken, user.id, user.region]
  );
  // handleEquipCollectionSkin: tap card collection → equip nhanh hoặc mở picker.
  const handleEquipCollectionSkin = React.useCallback(
      (item: OwnedWeaponCollectionItem) => {
        const equippedWeapon = loadoutDetails.find(
            (weapon) => weapon.weaponId === item.weaponId
        );
        if (!equippedWeapon) {
          return;
        }

        if (updatingLoadout) {
          handleOpenWeaponPicker(equippedWeapon);
          return;
        }

        const options = buildOwnedSkinOptions(equippedWeapon);
        const option = options.find(
            (candidate) => candidate.skinId === item.skinId
        );

        if (!option || option.selected) {
          handleOpenWeaponPicker(equippedWeapon);
          return;
        }

        setPickerLoading(false);
        setPickerError(null);
        setActiveWeaponChroma(null);
        setPickerState({
          type: "weapon",
          weapon: equippedWeapon,
          options,
        });
        void handleEquipWeapon(equippedWeapon, option);
      },
      [buildOwnedSkinOptions, handleEquipWeapon, handleOpenWeaponPicker, loadoutDetails, setActiveWeaponChroma, setPickerError, setPickerLoading, setPickerState, updatingLoadout]
  );
  // handleEquipSpray: equip spray theo slot (path legacy updatePlayerLoadout).
  const handleEquipSpray = React.useCallback(
      async (spray: EquippedSpray, option: OwnedSprayOption) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const nextLoadout: PlayerLoadoutResponse = {
          ...currentLoadout,
          Sprays: (currentLoadout.Sprays || []).map((item) =>
              item.EquipSlotID === spray.slot
                  ? {
                    ...item,
                    SprayID: option.sprayId,
                    SprayLevelID: option.sprayLevelId,
                  }
                  : item
          ),
        };
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip spray request", {
              slot: spray.slot,
              fromSprayId: spray.id,
              toSprayId: option.sprayId,
              toSprayLevelId: option.sprayLevelId,
            });
          }

          // Path legacy: chỉ chạy khi v3 không khả dụng và Riot vẫn trả slot
          // Sprays cũ.
          const response = await updatePlayerLoadout(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            Sprays: (response.Sprays?.length
                    ? response.Sprays
                    : nextLoadout.Sprays
            ).map((item) =>
                item.EquipSlotID === spray.slot
                    ? {
                      ...item,
                      SprayID: option.sprayId,
                      SprayLevelID: option.sprayLevelId,
                    }
                    : item
            ),
          };

          if (__DEV__) {
            const updatedSpray = (putResponse.Sprays || []).find(
                (item) => item.EquipSlotID === spray.slot
            );
            console.log("[profile] equip spray put response", {
              slot: spray.slot,
              responseSprayId: updatedSpray?.SprayID,
              responseSprayLevelId: updatedSpray?.SprayLevelID,
            });
          }

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse, true);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) =>
                  latestLoadout.Sprays?.some(
                      (item) =>
                          item.EquipSlotID === spray.slot &&
                          item.SprayID === option.sprayId &&
                          sameOptionalId(item.SprayLevelID, option.sprayLevelId)
                  ) ?? false
          );
        } catch (err) {
          if (__DEV__) console.error(sanitizeErrorForLog(err));
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [applyOptimisticLoadout, confirmLoadoutUpdate, handleDismissPicker, hasAuth, loadoutSnapshot, loadoutSnapshotRef, pendingLoadoutRef, persistLoadoutCache, rollbackOptimisticLoadout, setPickerError, setUpdatingLoadout, showLoadoutUpdateError, syncLoadoutState, updatingLoadout, user.accessToken, user.entitlementsToken, user.id, user.region]
  );
  // handleEquipExpression: equip graffiti/flex vào slot ActiveExpressions (PUT v3).
  const handleEquipExpression = React.useCallback(
      async (
          expression: EquippedExpression,
          option: OwnedExpressionOption
      ) => {
        if (!hasAuth || !loadoutSnapshot || updatingLoadout) {
          return;
        }

        const currentLoadout = loadoutSnapshotRef.current ?? loadoutSnapshot;
        const activeExpressions = currentLoadout.ActiveExpressions ?? [];
        if (!activeExpressions[expression.slotIndex]) {
          setPickerError(t("equip_page.error_loading"));
          return;
        }

        const nextExpressions = [...activeExpressions];
        nextExpressions[expression.slotIndex] = {
          TypeID:
              option.kind === "flex" ? VItemTypes.Flex : VItemTypes.Spray,
          AssetID: option.assetId,
        };
        const nextLoadout: PlayerLoadoutResponse = {
          ...currentLoadout,
          ActiveExpressions: nextExpressions,
        };
        const pendingUpdate = applyOptimisticLoadout(nextLoadout);
        setUpdatingLoadout(true);
        setPickerError(null);
        handleDismissPicker();

        try {
          if (__DEV__) {
            console.log("[profile] equip expression request", {
              slotIndex: expression.slotIndex,
              fromKind: expression.kind,
              fromAssetId: expression.id,
              toKind: option.kind,
              toAssetId: option.assetId,
            });
          }

          const response = await updatePlayerLoadoutV3(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              nextLoadout
          );
          const responseExpressions = response.ActiveExpressions?.length
              ? [...response.ActiveExpressions]
              : [...nextExpressions];
          responseExpressions[expression.slotIndex] =
              nextExpressions[expression.slotIndex];
          const putResponse: PlayerLoadoutResponse = {
            ...nextLoadout,
            ...response,
            ActiveExpressions: responseExpressions,
          };

          pendingUpdate.loadout = putResponse;
          pendingUpdate.updatedAt = Date.now();
          if (pendingLoadoutRef.current === pendingUpdate) {
            syncLoadoutState(putResponse);
            persistLoadoutCache(putResponse, true);
          }
          void confirmLoadoutUpdate(
              putResponse,
              pendingUpdate,
              (latestLoadout) => {
                const latestExpression =
                    latestLoadout.ActiveExpressions?.[expression.slotIndex];
                return Boolean(
                    latestExpression &&
                    latestExpression.TypeID.toLowerCase() ===
                    nextExpressions[expression.slotIndex].TypeID.toLowerCase() &&
                    latestExpression.AssetID === option.assetId
                );
              }
          );
        } catch (err) {
          if (__DEV__) console.error(sanitizeErrorForLog(err));
          rollbackOptimisticLoadout(currentLoadout, pendingUpdate);
          showLoadoutUpdateError();
        } finally {
          setUpdatingLoadout(false);
        }
      },
      [applyOptimisticLoadout, confirmLoadoutUpdate, handleDismissPicker, hasAuth, loadoutSnapshot, loadoutSnapshotRef, pendingLoadoutRef, persistLoadoutCache, rollbackOptimisticLoadout, setPickerError, setUpdatingLoadout, showLoadoutUpdateError, syncLoadoutState, t, updatingLoadout, user.accessToken, user.entitlementsToken, user.id, user.region]
  );
  return { handleEquipIdentity, handleEquipWeapon, handleEquipCollectionSkin, handleEquipSpray, handleEquipExpression };
}
