import React from "react";
import { playerLoadout, updatePlayerLoadoutV3First } from "~/utils/valorant-api";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import { getSessionGeneration } from "~/utils/session-operations";
import { buildProfileRefreshCache, updateProfileLoadoutCache } from "./profile-refresh-data";
import type { EquippedWeapon, OwnedWeaponCollectionItem, EquippedSpray } from "~/components/GalleryProfile";
import { VItemTypes } from "~/utils/misc";
import { sameOptionalId, type EquippedExpression, type OwnedExpressionOption, type OwnedSkinOption, type OwnedSprayOption } from "./profile-loadout";
import { profileLoadoutRegistry, type LoadoutOwner, type ProfileLoadoutRegistry } from "./profile-loadout-queue-registry";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";
import type { ProfileLoadoutChange, ProfileLoadoutQueue } from "./profile-loadout-queue";
import type { useProfileState } from "./useProfileState";
import type { useProfileSession } from "./useProfileSession";
import type { useProfileFetch } from "./useProfileFetch";
import type { useProfilePickers } from "./useProfilePickers";
import type { useProfileLoadoutData } from "./useProfileLoadoutData";
import type { useProfilePickerOptions } from "./useProfilePickerOptions";

/** An explicitly supplied, isolated transport for deterministic local QA. No auth/store override. */
export type ProfileLoadoutRuntime = {
  registry: ProfileLoadoutRegistry;
  getGeneration: () => number;
  isCurrent: (owner: LoadoutOwner) => boolean;
  read: (owner: LoadoutOwner) => Promise<PlayerLoadoutResponse | null>;
  write: (owner: LoadoutOwner, payload: PlayerLoadoutResponse) => Promise<PlayerLoadoutResponse>;
  onConfirmed?: (server: PlayerLoadoutResponse) => void;
};

type Props = { loadoutRuntime?: ProfileLoadoutRuntime } & Pick<ReturnType<typeof useProfileState>,
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


export function useProfileMutations(props: Props) {
  const { user, hasAuth, authKey, loadoutSnapshot, loadoutSnapshotRef, pendingLoadoutRef,
    loadoutMutationVersionRef, syncLoadoutState, setUpdatingLoadout, setPickerError,
    handleDismissPicker, showLoadoutUpdateError, loadoutDetails, buildOwnedSkinOptions,
    handleOpenWeaponPicker, t, loadoutRuntime } = props;
  const registry = loadoutRuntime?.registry ?? profileLoadoutRegistry;
  const generation = loadoutRuntime ? loadoutRuntime.getGeneration() : getSessionGeneration();
  const context = React.useMemo(() => ({ runtime: loadoutRuntime, owner: { id: user.id, region: user.region,
    accessToken: user.accessToken, entitlementsToken: user.entitlementsToken, generation } satisfies LoadoutOwner }),
  [user.id, user.region, user.accessToken, user.entitlementsToken, generation, loadoutRuntime]);
  const { owner } = context;
  const mounted = React.useRef(false);
  const latestOwner = React.useRef(owner);
  latestOwner.current = owner;
  const ui = React.useRef({ syncLoadoutState, setUpdatingLoadout, showLoadoutUpdateError });
  ui.current = { syncLoadoutState, setUpdatingLoadout, showLoadoutUpdateError };
  const current = React.useCallback(() => {
    if (loadoutRuntime) return loadoutRuntime.getGeneration() === owner.generation && loadoutRuntime.isCurrent(owner);
    const latest = useUserStore.getState().user;
    return getSessionGeneration() === owner.generation && latest.id === owner.id &&
      latest.region === owner.region && latest.accessToken === owner.accessToken &&
      latest.entitlementsToken === owner.entitlementsToken;
  }, [owner, loadoutRuntime]);
  const binding = React.useRef<{ queue: ProfileLoadoutQueue; owner: LoadoutOwner; unsubscribe: () => void } | null>(null);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; binding.current?.unsubscribe(); binding.current = null; };
  }, []);

  const connect = React.useCallback((queue: ProfileLoadoutQueue) => {
    if (binding.current?.queue === queue) return;
    binding.current?.unsubscribe();
    let errorRevision = queue.getSnapshot().errorRevision;
    const publish = () => {
      if (!mounted.current || latestOwner.current !== owner || !current()) return;
      const snapshot = queue.getSnapshot();
      pendingLoadoutRef.current = snapshot.pending ? { loadout: snapshot.display, updatedAt: Date.now() } : null;
      loadoutSnapshotRef.current = snapshot.display;
      ui.current.syncLoadoutState(snapshot.display);
      ui.current.setUpdatingLoadout(snapshot.saving || snapshot.pending);
      if (snapshot.errorRevision > errorRevision) {
        errorRevision = snapshot.errorRevision;
        ui.current.showLoadoutUpdateError();
      }
    };
    binding.current = { queue, owner, unsubscribe: queue.subscribe(publish) };
    publish();
  }, [current, owner, pendingLoadoutRef, loadoutSnapshotRef]);

  const ensureQueue = React.useCallback(() => {
    if (!hasAuth || latestOwner.current !== owner || !current()) return null;
    const initial = loadoutSnapshotRef.current ?? loadoutSnapshot;
    if (!initial || initial.Subject !== owner.id) return null;
    const queue = registry.acquire(owner, {
      initial, isCurrent: current,
      write: (payload) => loadoutRuntime ? loadoutRuntime.write(owner, payload) :
        updatePlayerLoadoutV3First(owner.accessToken, owner.entitlementsToken, owner.region, owner.id, payload, { isCurrent: current }),
      read: () => loadoutRuntime ? loadoutRuntime.read(owner) :
        playerLoadout(owner.accessToken, owner.entitlementsToken, owner.region, owner.id, { force: true, isCurrent: current }),
      onConfirmed: (server) => {
        if (loadoutRuntime) { if (current()) loadoutRuntime.onConfirmed?.(server); return; }
        // Persist only raw server authority, and merge the newest ownership/rank cache.
        const store = useProfileCacheStore.getState();
        const previous = store.cacheByAuth[authKey];
        if (!current()) return;
        const now = Date.now();
        store.setProfileCache(previous ? updateProfileLoadoutCache(previous, server, now) :
          buildProfileRefreshCache({ authKey, previous: null, loadoutSnapshot: server,
            rankOutcome: { status: "failure" }, ownership: [],
            ownedSkinIds: useUserStore.getState().user.ownedSkinIds ?? [], now }));
      },
      onError: () => undefined,
    });
    if (queue) connect(queue);
    return queue;
  }, [hasAuth, current, loadoutSnapshotRef, loadoutSnapshot, owner, authKey, connect, registry, loadoutRuntime]);

  React.useEffect(() => {
    ensureQueue();
    return () => { binding.current?.unsubscribe(); binding.current = null; };
  }, [ensureQueue]);

  const enqueue = React.useCallback((change: ProfileLoadoutChange) => {
    if (!mounted.current || latestOwner.current !== owner || !current()) return Promise.resolve(false);
    const queue = ensureQueue();
    if (!queue) return Promise.resolve(false);
    setPickerError(null);
    handleDismissPicker();
    // Connecting or hydrating a queue is not a new user mutation.
    loadoutMutationVersionRef.current += 1;
    return queue.enqueue(change);
  }, [current, ensureQueue, handleDismissPicker, owner, setPickerError, loadoutMutationVersionRef]);

  const handleEquipIdentity = React.useCallback(async (type: "player-card" | "player-title", optionId: string) => {
    const field = type === "player-card" ? "PlayerCardID" : "PlayerTitleID";
    return enqueue({ key: `identity:${field}`,
      apply: (base) => ({ ...base, Identity: { ...base.Identity, [field]: optionId } }),
      matches: (base) => base.Identity[field] === optionId });
  }, [enqueue]);

  const handleEquipWeapon = React.useCallback(async (weapon: EquippedWeapon, option: OwnedSkinOption) => {
    if (!mounted.current || latestOwner.current !== owner || !current()) return false;
    const queue = ensureQueue();
    if (!queue?.getSnapshot().display.Guns.some((gun) => gun.ID === weapon.weaponId)) {
      setPickerError(t("equip_page.error_loading")); return false;
    }
    return enqueue({ key: `gun:${weapon.weaponId}`,
      apply: (base) => ({ ...base, Guns: base.Guns.map((gun) => gun.ID === weapon.weaponId ?
        { ...gun, SkinID: option.skinId, SkinLevelID: option.skinLevelId, ChromaID: option.chromaId } : gun) }),
      matches: (base) => base.Guns.some((gun) => gun.ID === weapon.weaponId && gun.SkinID === option.skinId &&
        gun.SkinLevelID === option.skinLevelId && gun.ChromaID === option.chromaId) });
  }, [owner, current, ensureQueue, enqueue, setPickerError, t]);

  const handleEquipSpray = React.useCallback(async (spray: EquippedSpray, option: OwnedSprayOption) => {
    if (!mounted.current || latestOwner.current !== owner || !current()) return false;
    const display = ensureQueue()?.getSnapshot().display;
    if (display?.SourceApiVersion !== "v2" || !display.Sprays.some((item) => item.EquipSlotID === spray.slot)) return false;
    return enqueue({ key: `spray:${spray.slot}`,
      apply: (base) => ({ ...base, Sprays: base.Sprays.map((item) => item.EquipSlotID === spray.slot ?
        { ...item, SprayID: option.sprayId, SprayLevelID: option.sprayLevelId } : item) }),
      matches: (base) => base.Sprays.some((item) => item.EquipSlotID === spray.slot &&
        item.SprayID === option.sprayId && sameOptionalId(item.SprayLevelID, option.sprayLevelId)) });
  }, [owner, current, ensureQueue, enqueue]);

  const handleEquipExpression = React.useCallback(async (expression: EquippedExpression, option: OwnedExpressionOption) => {
    if (!mounted.current || latestOwner.current !== owner || !current()) return false;
    const display = ensureQueue()?.getSnapshot().display;
    if (display?.SourceApiVersion === "v2" || !display?.ActiveExpressions?.[expression.slotIndex]) return false;
    const value = { TypeID: option.kind === "flex" ? VItemTypes.Flex : VItemTypes.Spray, AssetID: option.assetId };
    return enqueue({ key: `expression:${expression.slotIndex}`,
      apply: (base) => ({ ...base, ActiveExpressions: (base.ActiveExpressions ?? []).map((item, index) =>
        index === expression.slotIndex ? { ...item, ...value } : item) }),
      matches: (base) => {
        const item = base.ActiveExpressions?.[expression.slotIndex];
        return item?.TypeID.toLowerCase() === value.TypeID.toLowerCase() && item.AssetID === value.AssetID;
      } });
  }, [owner, current, ensureQueue, enqueue]);

  const handleEquipCollectionSkin = React.useCallback((item: OwnedWeaponCollectionItem) => {
    if (!mounted.current || latestOwner.current !== owner || !current()) return;
    const weapon = loadoutDetails.find((entry) => entry.weaponId === item.weaponId);
    if (!weapon) return;
    const option = buildOwnedSkinOptions(weapon).find((entry) => entry.skinId === item.skinId);
    if (!option || option.selected) { handleOpenWeaponPicker(weapon); return; }
    void handleEquipWeapon(weapon, option);
  }, [owner, current, loadoutDetails, buildOwnedSkinOptions, handleOpenWeaponPicker, handleEquipWeapon]);

  return { handleEquipIdentity, handleEquipWeapon, handleEquipCollectionSkin, handleEquipSpray, handleEquipExpression };
}
