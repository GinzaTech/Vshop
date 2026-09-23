import type { MatchDetailsData } from "~/types/match-ui";
import type { defaultUser } from "~/utils/valorant-api";
import { getAccountSessionKey } from "~/utils/saved-accounts";
import { getSessionGeneration } from "~/utils/session-operations";
import { useUserStore } from "~/hooks/useUserStore";
import { MAX_DETAIL_CACHE_ENTRIES } from "./cache-policy";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";
import { emptyMatchCache, type MatchStoreAccess } from "./store-types";

type MatchUser = typeof defaultUser;
export type MatchRequestScope = { key: string; isCurrent: () => boolean };
export type MatchRequestRuntime = ReturnType<typeof createMatchRequestRuntime>;
export type MatchActionContext = MatchStoreAccess & { runtime: MatchRequestRuntime };
const idle = { loading: false, hydrating: false, seasonStatsLoading: false };
export const idleMatchRequests = () => ({ ...idle });

/** Request ownership is ephemeral: credentials never enter Zustand or persistence. */
export function createMatchRequestRuntime({ setState, getState }: MatchStoreAccess) {
  let generation = 0;
  let sessionGeneration = getSessionGeneration();
  let credentials: Pick<MatchUser, "accessToken" | "entitlementsToken"> | null = null;
  let detailOrder: string[] = [];
  const runtime = {
    matchesInFlight: null as { key: string; kind: "delta" | "full"; promise: Promise<boolean> } | null,
    hydrationInFlight: null as { key: string; promise: Promise<void> } | null,
    seasonStatsInFlight: new Map<string, Promise<void>>(),
    seasonOptionsInFlight: new Map<
      string,
      Promise<LeaderboardSeasonOption[] | null>
    >(),
    seasonStatsLoadingKeys: new Set<string>(),
    seasonStatsFailures: new Map<string, number>(),
    detailsInFlight: new Map<string, Promise<MatchDetailsData | null>>(),
    invalidate() {
      generation += 1;
      sessionGeneration = getSessionGeneration();
      credentials = null;
      detailOrder = [];
      runtime.matchesInFlight = null;
      runtime.hydrationInFlight = null;
      runtime.seasonStatsInFlight.clear();
      runtime.seasonOptionsInFlight.clear();
      runtime.seasonStatsLoadingKeys.clear();
      runtime.seasonStatsFailures.clear();
      runtime.detailsInFlight.clear();
    },
    reset() {
      runtime.invalidate();
      setState({ ...emptyMatchCache(), ...idleMatchRequests() });
    },
    begin(user: MatchUser): MatchRequestScope | null {
      const authKey = getAccountSessionKey(user);
      if (authKey === "guest" || !user.accessToken || !user.entitlementsToken) return null;
      const { accessToken, entitlementsToken } = user;
      const isLiveUser = () => {
        const active = useUserStore.getState().user;
        return getAccountSessionKey(active) === authKey &&
          active.accessToken === accessToken && active.entitlementsToken === entitlementsToken;
      };
      if (!isLiveUser()) return null;
      const activeGeneration = getSessionGeneration();
      const accountChanged = getState().authKey !== authKey;
      const credentialsChanged = credentials !== null && (
        credentials.accessToken !== user.accessToken ||
        credentials.entitlementsToken !== user.entitlementsToken
      );
      if (accountChanged || credentialsChanged || sessionGeneration !== activeGeneration) {
        runtime.invalidate();
        setState({ ...(accountChanged ? emptyMatchCache() : {}), authKey, ...idleMatchRequests() });
      }
      credentials = { accessToken: user.accessToken, entitlementsToken: user.entitlementsToken };
      const requestGeneration = generation;
      return {
        key: `${authKey}|${requestGeneration}`,
        isCurrent: () => generation === requestGeneration && getState().authKey === authKey &&
          activeGeneration === getSessionGeneration() && isLiveUser(),
      };
    },
    addDetail(detailsById: Record<string, MatchDetailsData>, matchId: string, details: MatchDetailsData) {
      // Recover ordering after restoring a snapshot without restoring running tasks.
      const existingOrder = [...detailOrder.filter((id) => id in detailsById),
        ...Object.keys(detailsById).filter((id) => !detailOrder.includes(id))];
      detailOrder = [...existingOrder.filter((id) => id !== matchId), matchId].slice(-MAX_DETAIL_CACHE_ENTRIES);
      const next = { ...detailsById, [matchId]: details };
      return Object.fromEntries(detailOrder.map((id) => [id, next[id]]));
    },
  };
  return runtime;
}
