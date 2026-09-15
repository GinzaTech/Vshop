import React from "react";
import { type IdleTask } from "~/utils/idle-task";
import { PlayerLoadoutExpression, PlayerLoadoutResponse } from "~/utils/valorant-api";
import { CompetitiveRankSummary } from "~/utils/profile-cache";
import { PlayerLoadoutGun, PlayerLoadoutSpray, PlayerLoadoutIdentity, WeaponMetadataMap, EquippedWeapon } from "~/components/GalleryProfile";
import { type OwnedSkinOption, type PendingLoadoutUpdate, type PickerState } from "~/features/profile/profile-loadout";
import { PROFILE_DEMO_RANK } from "~/mocks/profile-ui";
import type { useProfileSession } from "./useProfileSession";

type Props = Pick<ReturnType<typeof useProfileSession>, "cachedLoadoutSnapshot" | "cachedProfile" | "user" | "isProfileDemo" | "cachedCompetitiveRank">;

export function useProfileState({ cachedLoadoutSnapshot, cachedProfile, user, isProfileDemo, cachedCompetitiveRank }: Props) {

  const [loading, setLoading] = React.useState(!cachedLoadoutSnapshot);
  const [refreshing, setRefreshing] = React.useState(false);
  const [statsRefreshing, setStatsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pickerError, setPickerError] = React.useState<string | null>(null);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [updatingLoadout, setUpdatingLoadout] = React.useState(false);
  const [rawGuns, setRawGuns] = React.useState<PlayerLoadoutGun[]>(
      cachedLoadoutSnapshot?.Guns ?? []
  );
  const [rawSprays, setRawSprays] = React.useState<PlayerLoadoutSpray[]>(
      cachedLoadoutSnapshot?.Sprays ?? []
  );
  const [rawActiveExpressions, setRawActiveExpressions] = React.useState<
      PlayerLoadoutExpression[]
  >(
      cachedLoadoutSnapshot?.ActiveExpressions ?? []
  );
  const [identity, setIdentity] = React.useState<PlayerLoadoutIdentity | null>(
      cachedLoadoutSnapshot?.Identity ?? null
  );
  const [loadoutSnapshot, setLoadoutSnapshot] =
      React.useState<PlayerLoadoutResponse | null>(cachedLoadoutSnapshot);
  const [ownedSkinItemIds, setOwnedSkinItemIds] = React.useState<string[]>(
      cachedProfile?.ownedSkinItemIds?.length
          ? cachedProfile.ownedSkinItemIds
          : user.ownedSkinIds ?? []
  );
  const [ownedSprayItemIds, setOwnedSprayItemIds] = React.useState<string[]>(
      cachedProfile?.ownedSprayItemIds ?? []
  );
  const [ownedFlexItemIds, setOwnedFlexItemIds] = React.useState<string[]>(
      cachedProfile?.ownedFlexItemIds ?? []
  );
  const [ownedPlayerCardItemIds, setOwnedPlayerCardItemIds] = React.useState<
      string[]
  >(cachedProfile?.ownedPlayerCardItemIds ?? []);
  const [ownedPlayerTitleItemIds, setOwnedPlayerTitleItemIds] = React.useState<
      string[]
  >(cachedProfile?.ownedPlayerTitleItemIds ?? []);
  const [competitiveRank, setCompetitiveRank] =
      React.useState<CompetitiveRankSummary | null>(
        isProfileDemo ? PROFILE_DEMO_RANK : cachedCompetitiveRank
      );
  const [weaponMetadata, setWeaponMetadata] = React.useState<WeaponMetadataMap>({});
  const [searchQuery, setSearchQuery] = React.useState("");               // Search trong collection tab
  const [collectionWeaponFilter, setCollectionWeaponFilter] = React.useState("all");
  const [pickerState, setPickerState] = React.useState<PickerState | null>(null);
  const [identityPickerQuery, setIdentityPickerQuery] = React.useState(""); // Search trong identity picker
  const [activeWeaponChroma, setActiveWeaponChroma] = React.useState<{
    weapon: EquippedWeapon;
    option: OwnedSkinOption;
  } | null>(null);
  const pickerTaskRef = React.useRef<IdleTask | null>(null);
  const loadoutSnapshotRef = React.useRef<PlayerLoadoutResponse | null>(
      cachedLoadoutSnapshot
  );
  const loadoutMutationVersionRef = React.useRef(0);          // Tăng sau mỗi mutation
  const pendingLoadoutRef = React.useRef<PendingLoadoutUpdate | null>(null);
  const initialFetchTaskRef = React.useRef<IdleTask | null>(null);
  const initialFetchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
  );
  const rankRefreshAuthKeyRef = React.useRef<string | null>(null);
  const fetchLoadoutInFlightRef = React.useRef(false);

  // ─── Refs dữ liệu phiên (fix M6): fetchLoadoutData đọc qua ref, không phụ
  // thuộc identity `user` → callback ổn định, effect không re-arm khi setUser nền.
  const sessionUserRef = React.useRef(user);
  React.useEffect(() => { sessionUserRef.current = user; }, [user]);
  const competitiveRankRef = React.useRef(competitiveRank);
  React.useEffect(() => { competitiveRankRef.current = competitiveRank; }, [competitiveRank]);
  const cachedCompetitiveRankRef = React.useRef(cachedCompetitiveRank);
  React.useEffect(() => { cachedCompetitiveRankRef.current = cachedCompetitiveRank; }, [cachedCompetitiveRank]);
  return {
    loading, setLoading, refreshing, setRefreshing, statsRefreshing, setStatsRefreshing, error, setError,
    pickerError, setPickerError, pickerLoading, setPickerLoading, updatingLoadout, setUpdatingLoadout,
    rawGuns, setRawGuns, rawSprays, setRawSprays, rawActiveExpressions, setRawActiveExpressions, identity,
    setIdentity, loadoutSnapshot, setLoadoutSnapshot, ownedSkinItemIds, setOwnedSkinItemIds,
    ownedSprayItemIds, setOwnedSprayItemIds, ownedFlexItemIds, setOwnedFlexItemIds, ownedPlayerCardItemIds,
    setOwnedPlayerCardItemIds, ownedPlayerTitleItemIds, setOwnedPlayerTitleItemIds, competitiveRank,
    setCompetitiveRank, weaponMetadata, setWeaponMetadata, searchQuery, setSearchQuery,
    collectionWeaponFilter, setCollectionWeaponFilter, pickerState, setPickerState, identityPickerQuery,
    setIdentityPickerQuery, activeWeaponChroma, setActiveWeaponChroma, pickerTaskRef, loadoutSnapshotRef,
    loadoutMutationVersionRef, pendingLoadoutRef, initialFetchTaskRef, initialFetchTimeoutRef,
    rankRefreshAuthKeyRef, fetchLoadoutInFlightRef, sessionUserRef, competitiveRankRef,
    cachedCompetitiveRankRef,
  };
}
