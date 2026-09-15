import {
  PROFILE_LOADOUT_CACHE_VERSION,
  PROFILE_RANK_CACHE_VERSION,
  type CompetitiveRankSummary,
  type ProfileWarmCache,
} from "~/utils/profile-cache";
import { isSessionChangedError } from "~/utils/session-operations";
import type { PlayerLoadoutResponse } from "~/utils/valorant-api";

type RankOutcome = { status: "success"; value: CompetitiveRankSummary | null } | { status: "failure" };
type RefreshResult = {
  authKey: string;
  previous: ProfileWarmCache | null;
  loadoutSnapshot: PlayerLoadoutResponse | null;
  rankOutcome: RankOutcome;
  ownership: readonly PromiseSettledResult<string[]>[];
  ownedSkinIds: readonly string[];
  now: number;
};

const oldestComponent = (times: NonNullable<ProfileWarmCache["componentUpdatedAt"]>) =>
  Math.min(times.loadout, times.rank, ...times.ownership);

/** Preserve the last successful value and age of every failed profile component. */
export function buildProfileRefreshCache({
  authKey, previous, loadoutSnapshot, rankOutcome, ownership, ownedSkinIds, now,
}: RefreshResult): ProfileWarmCache {
  for (const result of ownership) {
    if (result.status === "rejected" && isSessionChangedError(result.reason)) throw result.reason;
  }
  const idsFor = (prior: readonly string[] = [], indices: readonly number[]) =>
    Array.from(new Set([...prior, ...indices.flatMap((index) => {
      const result = ownership[index];
      return result?.status === "fulfilled" ? result.value : [];
    })]));
  const previousTimes = previous?.componentUpdatedAt;
  const componentUpdatedAt = {
    loadout: loadoutSnapshot ? now : previousTimes?.loadout ?? 0,
    rank: rankOutcome.status === "success" ? now : previousTimes?.rank ?? 0,
    ownership: Array.from({ length: 6 }, (_, index) =>
      ownership[index]?.status === "fulfilled" ? now : previousTimes?.ownership[index] ?? 0),
  };
  return {
    authKey,
    loadoutSnapshot: loadoutSnapshot ?? previous?.loadoutSnapshot ?? null,
    loadoutCacheVersion: loadoutSnapshot ? PROFILE_LOADOUT_CACHE_VERSION : previous?.loadoutCacheVersion,
    competitiveRank: rankOutcome.status === "success" ? rankOutcome.value : previous?.competitiveRank ?? null,
    rankCacheVersion: rankOutcome.status === "success" ? PROFILE_RANK_CACHE_VERSION : previous?.rankCacheVersion,
    ownedSkinItemIds: idsFor([...(previous?.ownedSkinItemIds ?? []), ...ownedSkinIds], [0, 1]),
    ownedSprayItemIds: idsFor(previous?.ownedSprayItemIds, [2]),
    ownedFlexItemIds: idsFor(previous?.ownedFlexItemIds, [3]),
    ownedPlayerCardItemIds: idsFor(previous?.ownedPlayerCardItemIds, [4]),
    ownedPlayerTitleItemIds: idsFor(previous?.ownedPlayerTitleItemIds, [5]),
    componentUpdatedAt,
    updatedAt: oldestComponent(componentUpdatedAt),
  };
}

/** An optimistic write changes displayed data; only a confirmed response advances age. */
export function updateProfileLoadoutCache(
  previous: ProfileWarmCache,
  loadoutSnapshot: PlayerLoadoutResponse,
  confirmedAt?: number,
): ProfileWarmCache {
  const times = previous.componentUpdatedAt;
  const componentUpdatedAt = {
    loadout: confirmedAt ?? times?.loadout ?? 0,
    rank: times?.rank ?? 0,
    ownership: Array.from({ length: 6 }, (_, index) => times?.ownership[index] ?? 0),
  };
  return {
    ...previous,
    loadoutSnapshot,
    loadoutCacheVersion: confirmedAt === undefined ? previous.loadoutCacheVersion : PROFILE_LOADOUT_CACHE_VERSION,
    componentUpdatedAt,
    updatedAt: oldestComponent(componentUpdatedAt),
  };
}
