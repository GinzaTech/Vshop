import React from "react";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { fetchCompetitiveRankOutcome } from "~/utils/profile-cache";
import { isSessionChangedError } from "~/utils/session-operations";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { buildProfileRefreshCache, updateProfileLoadoutCache } from "./profile-refresh-data";
import { runWhenIdle } from "~/utils/idle-task";
import { useUserStore } from "~/hooks/useUserStore";
import { getSessionGeneration } from "~/utils/session-operations";
import { extractOwnedItemIds, ownedItems, playerLoadout, PlayerLoadoutResponse } from "~/utils/valorant-api";
import { getSessionAuthKey, hasValidCompetitiveRankCache, isProfileCacheFresh } from "~/utils/profile-cache";
import { WeaponMetadata, WeaponMetadataMap } from "~/components/GalleryProfile";
import { VItemTypes } from "~/utils/misc";
import { getPublicWeapons } from "~/services/valorant/public-api";
import { loadoutsMatch } from "~/features/profile/profile-loadout";
import { PROFILE_DEMO_RANK } from "~/mocks/profile-ui";
import { profileLoadoutRegistry } from "./profile-loadout-queue-registry";
import type { useProfileState } from "./useProfileState";
import type { useProfileSession } from "./useProfileSession";

type Props = Pick<ReturnType<typeof useProfileState>,
  "loadoutSnapshotRef" |
  "setLoadoutSnapshot" |
  "setRawGuns" |
  "setRawSprays" |
  "setRawActiveExpressions" |
  "setIdentity" |
  "setOwnedSkinItemIds" |
  "setOwnedSprayItemIds" |
  "setOwnedFlexItemIds" |
  "setOwnedPlayerCardItemIds" |
  "setOwnedPlayerTitleItemIds" |
  "setCompetitiveRank" |
  "setError" |
  "setLoading" |
  "sessionUserRef" |
  "fetchLoadoutInFlightRef" |
  "loadoutMutationVersionRef" |
  "competitiveRankRef" |
  "cachedCompetitiveRankRef" |
  "pendingLoadoutRef" |
  "setWeaponMetadata" |
  "setPickerState" |
  "setIdentityPickerQuery" |
  "setPickerLoading" |
  "setPickerError" |
  "rankRefreshAuthKeyRef" |
  "initialFetchTaskRef" |
  "initialFetchTimeoutRef" |
  "setRefreshing" |
  "setStatsRefreshing"> &
Pick<ReturnType<typeof useProfileSession>,
  "hasAuth" |
  "cachedLoadoutSnapshot" |
  "cachedProfile" |
  "user" |
  "cachedCompetitiveRank" |
  "setUser" |
  "setProfileCache" |
  "isProfileDemo" |
  "t" |
  "authKey" |
  "fetchMatches" |
  "fetchSeasonStats">;

export function useProfileFetch({
  loadoutSnapshotRef, setLoadoutSnapshot, setRawGuns, setRawSprays, setRawActiveExpressions, setIdentity,
  hasAuth, cachedLoadoutSnapshot, setOwnedSkinItemIds, cachedProfile, user, setOwnedSprayItemIds,
  setOwnedFlexItemIds, setOwnedPlayerCardItemIds, setOwnedPlayerTitleItemIds, setCompetitiveRank,
  cachedCompetitiveRank, setError, setLoading, sessionUserRef, fetchLoadoutInFlightRef,
  loadoutMutationVersionRef, competitiveRankRef, cachedCompetitiveRankRef, pendingLoadoutRef, setUser,
  setProfileCache, setWeaponMetadata, isProfileDemo, setPickerState, setIdentityPickerQuery,
  setPickerLoading, setPickerError, t, rankRefreshAuthKeyRef, authKey, initialFetchTaskRef,
  initialFetchTimeoutRef, setRefreshing, setStatsRefreshing, fetchMatches, fetchSeasonStats,
}: Props) {
  const hydrationGeneration = getSessionGeneration();
  const hydrationOwnerRef = React.useRef({ id: user.id, region: user.region,
    accessToken: user.accessToken, entitlementsToken: user.entitlementsToken,
    generation: hydrationGeneration });

  /**
   * syncLoadoutState — Đồng bộ toàn bộ state loadout từ response API.
   * Cập nhật: loadoutSnapshotRef, loadoutSnapshot, rawGuns, rawSprays,
   * rawActiveExpressions, identity.
   */
  const syncLoadoutState = React.useCallback((response: PlayerLoadoutResponse) => {
    loadoutSnapshotRef.current = response;
    setLoadoutSnapshot(response);
    setRawGuns(response.Guns || []);
    setRawSprays(response.Sprays || []);
    setRawActiveExpressions(response.ActiveExpressions || []);
    setIdentity(response.Identity || null);
  }, [loadoutSnapshotRef, setIdentity, setLoadoutSnapshot, setRawActiveExpressions, setRawGuns, setRawSprays]);

  // ── Effect: Khôi phục dữ liệu từ cache ────────────────────────────────────
  React.useEffect(() => {
    const previousOwner = hydrationOwnerRef.current;
    const nextOwner = { id: user.id, region: user.region, accessToken: user.accessToken,
      entitlementsToken: user.entitlementsToken, generation: hydrationGeneration };
    hydrationOwnerRef.current = nextOwner;
    if (!hasAuth || previousOwner.id !== nextOwner.id || previousOwner.region !== nextOwner.region ||
        previousOwner.accessToken !== nextOwner.accessToken || previousOwner.entitlementsToken !== nextOwner.entitlementsToken ||
        previousOwner.generation !== nextOwner.generation) pendingLoadoutRef.current = null;
    if (!hasAuth || !cachedLoadoutSnapshot) {
      return;
    }

    // Cache hợp lệ → sync loadout snapshot vào toàn bộ state hiển thị.
    const queue = profileLoadoutRegistry.peek({ ...user, generation: getSessionGeneration() });
    queue?.adopt(cachedLoadoutSnapshot);
    const pending = pendingLoadoutRef.current?.loadout;
    // Ownership/rank cache publication can re-run hydration before a legacy
    // pending write has a queue. Keep that display-only choice in its session.
    const pendingDisplay = pending?.Subject === user.id ? pending : null;
    syncLoadoutState(queue?.getSnapshot().display ?? pendingDisplay ?? cachedLoadoutSnapshot);
    // Sync danh sách item đã sở hữu (skin/spray/flex/card/title) + rank.
    setOwnedSkinItemIds(
        cachedProfile.ownedSkinItemIds?.length
            ? cachedProfile.ownedSkinItemIds
            : user.ownedSkinIds ?? []
    );
    setOwnedSprayItemIds(cachedProfile.ownedSprayItemIds ?? []);
    setOwnedFlexItemIds(cachedProfile.ownedFlexItemIds ?? []);
    setOwnedPlayerCardItemIds(cachedProfile.ownedPlayerCardItemIds ?? []);
    setOwnedPlayerTitleItemIds(cachedProfile.ownedPlayerTitleItemIds ?? []);
    setCompetitiveRank(cachedCompetitiveRank);
    setError(null);
    setLoading(false);
  }, [cachedCompetitiveRank, cachedLoadoutSnapshot, cachedProfile, hasAuth, hydrationGeneration, pendingLoadoutRef, setCompetitiveRank, setError, setLoading, setOwnedFlexItemIds, setOwnedPlayerCardItemIds, setOwnedPlayerTitleItemIds, setOwnedSkinItemIds, setOwnedSprayItemIds, syncLoadoutState, user]);

  /**
   * fetchLoadoutData — Fetch profile (loadout + ownership + rank), có
   * optimistic update (ưu tiên pendingLoadout khi đang equip).
   * FIX (M6): dữ liệu phiên đọc qua REF → deps chỉ còn setter ổn định, callback
   * không tái tạo mỗi lần setUser nền. FIX (M8): FORCE (PTR) bypass in-flight.
   *
   * @param showSpinner - Hiển thị spinner loading?
   * @param forceRefresh - Bỏ qua cache kết quả đã resolve?
   */
  const requestSequenceRef = React.useRef(0);
  const attemptedFetchAuthKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => () => { requestSequenceRef.current += 1; }, []);

  const fetchLoadoutData = React.useCallback(
      async (showSpinner = true, forceRefresh = false) => {
        const currentUser = sessionUserRef.current;
        const sessionAuthKey = getSessionAuthKey(currentUser);
        if (!currentUser.accessToken || !currentUser.entitlementsToken || !currentUser.region || !currentUser.id) return;
        if (fetchLoadoutInFlightRef.current && !forceRefresh) return;

        const requestSequence = ++requestSequenceRef.current;
        attemptedFetchAuthKeyRef.current = sessionAuthKey;
        fetchLoadoutInFlightRef.current = true;
        const generation = getSessionGeneration();
        const isCurrentSession = () => {
          const latest = useUserStore.getState().user;
          return generation === getSessionGeneration() &&
            latest.id === currentUser.id && latest.region === currentUser.region &&
            getSessionAuthKey(latest) === sessionAuthKey &&
            latest.accessToken === currentUser.accessToken &&
            latest.entitlementsToken === currentUser.entitlementsToken;
        };
        const isCurrentRequest = () => requestSequence === requestSequenceRef.current && isCurrentSession();

        if (showSpinner) setLoading(true);
        setError(null);
        try {
          if (forceRefresh) {
            const queue = profileLoadoutRegistry.peek({ ...currentUser, generation });
            if (queue?.getSnapshot().uncertain) {
              queue.reconcile();
              await queue.whenIdle();
              if (!isCurrentRequest()) return;
            }
          }
          const mutationVersionAtRequest = loadoutMutationVersionRef.current;
          const queueAtRequest = profileLoadoutRegistry.peek({ ...currentUser, generation });
          const response = await playerLoadout(
              currentUser.accessToken, currentUser.entitlementsToken, currentUser.region, currentUser.id,
              { force: forceRefresh, isCurrent: isCurrentSession }
          ).catch((error: unknown) => {
            if (isSessionChangedError(error)) throw error;
            if (__DEV__) console.warn("[profile] loadout unavailable", sanitizeErrorForLog(error));
            return null;
          });
          if (!isCurrentRequest()) return;
          const responseReceivedAt = Date.now();

          let adoptedResponse = false;
          const resolveLoadoutForDisplay = () => {
            const queue = profileLoadoutRegistry.peek({ ...currentUser, generation });
            if (queue) {
              if (response && loadoutMutationVersionRef.current === mutationVersionAtRequest) {
                // Normal reads may legally return cache. Only a non-invalidated
                // force GET can resolve an ambiguous write or restart its queue.
                adoptedResponse = (queue.getSnapshot().uncertain
                  ? forceRefresh && queue.reconcileFromRead(response)
                  : queue.adopt(response)) || adoptedResponse;
              }
              return queue.getSnapshot().display;
            }
            if (!response || loadoutMutationVersionRef.current !== mutationVersionAtRequest) {
              return loadoutSnapshotRef.current ?? response;
            }
            const pendingLoadout = pendingLoadoutRef.current;
            if (!pendingLoadout) return response;
            if (loadoutsMatch(response, pendingLoadout.loadout)) {
              pendingLoadoutRef.current = null;
              return response;
            }
            return pendingLoadout.loadout;
          };
          const displayLoadout = resolveLoadoutForDisplay();
          if (displayLoadout) syncLoadoutState(displayLoadout);
          if (showSpinner) setLoading(false);

          const [ownership, rankOutcome] = await Promise.all([
            Promise.allSettled([
              VItemTypes.SkinLevel, VItemTypes.SkinChroma, VItemTypes.Spray,
              VItemTypes.Flex, VItemTypes.PlayerCard, VItemTypes.PlayerTitle,
            ].map((itemType) => ownedItems(
                currentUser.accessToken, currentUser.entitlementsToken, currentUser.region, currentUser.id, itemType,
            ).then(extractOwnedItemIds))),
            fetchCompetitiveRankOutcome(currentUser, { force: forceRefresh }),
          ]);
          for (const result of ownership) {
            if (result.status === "rejected" && isSessionChangedError(result.reason)) throw result.reason;
          }
          if (!isCurrentRequest()) return;

          const resolvedLoadout = resolveLoadoutForDisplay();
          const currentUserAfterFetch = useUserStore.getState().user;
          const previous = useProfileCacheStore.getState().cacheByAuth[sessionAuthKey] ?? null;
          const queueSnapshot = profileLoadoutRegistry.peek({ ...currentUser, generation })?.getSnapshot();
          // Initialization can confirm this GET, and an ACK can advance authority
          // while ownership is loading. Neither requires persisting display intent.
          const confirmedLoadout = queueSnapshot ?
            (queueSnapshot.confirmed === response && (!queueAtRequest || adoptedResponse) ||
              response && queueSnapshot.confirmed.Version > response.Version &&
                queueSnapshot.confirmed !== previous?.loadoutSnapshot ?
              queueSnapshot.confirmed : null) : (resolvedLoadout === response ? response : null);
          const merged = buildProfileRefreshCache({
            authKey: sessionAuthKey, previous,
            // A pending optimistic snapshot is not a confirmed server success.
            loadoutSnapshot: confirmedLoadout,
            rankOutcome, ownership, ownedSkinIds: currentUserAfterFetch.ownedSkinIds ?? [], now: Date.now(),
          });
          const nextCache = confirmedLoadout && confirmedLoadout === response ?
            updateProfileLoadoutCache(merged, confirmedLoadout, responseReceivedAt) : merged;
          if (resolvedLoadout) syncLoadoutState(resolvedLoadout);
          setOwnedSkinItemIds(nextCache.ownedSkinItemIds);
          setOwnedSprayItemIds(nextCache.ownedSprayItemIds);
          setOwnedFlexItemIds(nextCache.ownedFlexItemIds);
          setOwnedPlayerCardItemIds(nextCache.ownedPlayerCardItemIds);
          setOwnedPlayerTitleItemIds(nextCache.ownedPlayerTitleItemIds);
          setCompetitiveRank(nextCache.competitiveRank);
          setProfileCache(nextCache);

          const currentOwnedSkinSet = new Set(currentUserAfterFetch.ownedSkinIds ?? []);
          if (nextCache.ownedSkinItemIds.length !== currentOwnedSkinSet.size ||
              nextCache.ownedSkinItemIds.some((id) => !currentOwnedSkinSet.has(id))) {
            setUser({ ...currentUserAfterFetch, ownedSkinIds: nextCache.ownedSkinItemIds });
          }
        } catch (error) {
          if (isSessionChangedError(error)) throw error;
          if (__DEV__) console.warn("[profile] fetchLoadoutData failed", sanitizeErrorForLog(error));
        } finally {
          if (requestSequence === requestSequenceRef.current) {
            fetchLoadoutInFlightRef.current = false;
            if (showSpinner) setLoading(false);
          }
        }
      },
      [fetchLoadoutInFlightRef, loadoutMutationVersionRef, loadoutSnapshotRef, pendingLoadoutRef,
        sessionUserRef, setCompetitiveRank, setError, setLoading, setOwnedFlexItemIds,
        setOwnedPlayerCardItemIds, setOwnedPlayerTitleItemIds, setOwnedSkinItemIds,
        setOwnedSprayItemIds, syncLoadoutState, setProfileCache, setUser]
  );

  // ── Effect: Fetch weapon metadata từ valorant-api.com ──────────────────────
  React.useEffect(() => {
    if (isProfileDemo) return;

    let isMounted = true;

    getPublicWeapons()
        .then((weapons) => {
          if (!isMounted) return;
          const map: WeaponMetadataMap = {};
          weapons.forEach((weapon) => {
            map[weapon.uuid] = weapon as WeaponMetadata;
          });
          setWeaponMetadata(map);
        })
        .catch((err) => {
          if (__DEV__) console.error(sanitizeErrorForLog(err));
        });

    return () => {
      isMounted = false;
    };
  }, [isProfileDemo, setWeaponMetadata]);

  // ── Effect chính: Fetch dữ liệu profile ─────────────────────────────────────
  // - Không auth → reset state + lỗi. - Cache fresh + loadout hợp lệ + bản ghi
  // rank đúng version (kể cả null — chưa xếp hạng, fix H1) → KHÔNG fetch; đây
  // là điều kiện giúp syncAllData preload đúng 1 lần/session.
  // - Cache fresh nhưng chưa từng có bản ghi rank (schema cũ) → fetch đầy đủ
  // đúng 1 lần/authKey (guard bằng ref). Nhánh này fetch FULL, không chỉ rank.
  // - Cache stale → fetch đầy đủ khi JS runtime rảnh (delay 120/260ms).
  // Deps fetchLoadoutData đã ổn định (fix M6) → chỉ re-arm khi thật sự đổi.
  React.useEffect(() => {
    if (isProfileDemo) {
      setCompetitiveRank(PROFILE_DEMO_RANK);
      setError(null);
      setLoading(false);
      return;
    }

    if (!hasAuth) {
      attemptedFetchAuthKeyRef.current = null;
      // Reset toàn bộ state khi không có auth
      setLoadoutSnapshot(null);
      setRawGuns([]);
      setRawSprays([]);
      setRawActiveExpressions([]);
      setIdentity(null);
      setOwnedSkinItemIds([]);
      setOwnedSprayItemIds([]);
      setOwnedFlexItemIds([]);
      setOwnedPlayerCardItemIds([]);
      setOwnedPlayerTitleItemIds([]);
      setCompetitiveRank(null);
      setPickerState(null);
      setIdentityPickerQuery("");
      setPickerLoading(false);
      setPickerError(null);
      setError(t("equip_page.missing_auth"));
      setLoading(!cachedLoadoutSnapshot);
      return;
    }

    const hasRankCache = hasValidCompetitiveRankCache(cachedProfile);
    const hasLoadoutCache = Boolean(cachedLoadoutSnapshot);

    // A partial refresh remains stale by design; it must not schedule itself forever.
    if (attemptedFetchAuthKeyRef.current === authKey) return;

    if (isProfileCacheFresh(cachedProfile) && hasLoadoutCache) {
      if (hasRankCache) {
        rankRefreshAuthKeyRef.current = null;
        return; // Cache hoàn toàn fresh → không cần fetch
      }

      // Cache fresh nhưng thiếu rank → chỉ refresh rank 1 lần
      if (rankRefreshAuthKeyRef.current === authKey) {
        return;
      }

      rankRefreshAuthKeyRef.current = authKey;
    }

    // Hủy task cũ trước khi tạo mới
    initialFetchTaskRef.current?.cancel();
    if (initialFetchTimeoutRef.current) {
      clearTimeout(initialFetchTimeoutRef.current);
      initialFetchTimeoutRef.current = null;
    }

    initialFetchTaskRef.current = runWhenIdle(() => {
      initialFetchTimeoutRef.current = setTimeout(() => {
        initialFetchTimeoutRef.current = null;
        void fetchLoadoutData(!cachedLoadoutSnapshot).catch((error: unknown) => {
          if (!isSessionChangedError(error) && __DEV__) console.warn(sanitizeErrorForLog(error));
        });
      }, cachedLoadoutSnapshot ? 120 : 260);
    });

    return () => {
      initialFetchTaskRef.current?.cancel();
      initialFetchTaskRef.current = null;
      if (initialFetchTimeoutRef.current) {
        clearTimeout(initialFetchTimeoutRef.current);
        initialFetchTimeoutRef.current = null;
      }
    };
  }, [authKey, cachedLoadoutSnapshot, cachedProfile, fetchLoadoutData, hasAuth, initialFetchTaskRef, initialFetchTimeoutRef, isProfileDemo, rankRefreshAuthKeyRef, setCompetitiveRank, setError, setIdentity, setIdentityPickerQuery, setLoading, setLoadoutSnapshot, setOwnedFlexItemIds, setOwnedPlayerCardItemIds, setOwnedPlayerTitleItemIds, setOwnedSkinItemIds, setOwnedSprayItemIds, setPickerError, setPickerLoading, setPickerState, setRawActiveExpressions, setRawGuns, setRawSprays, t]);

  /**
   * handleRefresh — Pull-to-refresh: gọi fetchLoadoutData không spinner.
   */
  const handleRefresh = React.useCallback(async () => {
    if (!hasAuth) return;

    setRefreshing(true);
    try {
      await fetchLoadoutData(false, true);
    } catch (error) {
      if (!isSessionChangedError(error)) throw error;
    } finally {
      setRefreshing(false);
    }
  }, [fetchLoadoutData, hasAuth, setRefreshing]);
  // handleStatsRefresh: pull-to-refresh dashboard → force fetch matches + season stats.
  const handleStatsRefresh = React.useCallback(async (seasonId?: string) => {
    if (isProfileDemo || !hasAuth) return;

    setStatsRefreshing(true);
    try {
      await Promise.all([
        fetchMatches(user, true),
        fetchSeasonStats(user, true, seasonId),
      ]);
    } finally {
      setStatsRefreshing(false);
    }
  }, [fetchMatches, fetchSeasonStats, hasAuth, isProfileDemo, setStatsRefreshing, user]);
  const handleSeasonChange = React.useCallback(
    async (seasonId: string) => {
      if (isProfileDemo || !hasAuth) return;
      await fetchSeasonStats(user, false, seasonId);
    },
    [fetchSeasonStats, hasAuth, isProfileDemo, user]
  );
  return { syncLoadoutState, handleRefresh, handleStatsRefresh, handleSeasonChange };
}
