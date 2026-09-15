import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appStorage } from "~/utils/storage";
import { createDetailActions } from "~/features/matches/detail-actions";
import { createHistoryActions } from "~/features/matches/history-actions";
import { createSeasonActions } from "~/features/matches/season-actions";
import { MATCH_STORE_VERSION, MAX_PERSISTED_MATCHES } from "~/features/matches/cache-policy";
import { createMatchRequestRuntime, idleMatchRequests, type MatchRequestRuntime } from "~/features/matches/request-runtime";
import { emptyMatchCache, type MatchState, type MatchCacheSnapshot, type PersistedMatchState } from "~/features/matches/store-types";

export type { MatchCacheSnapshot } from "~/features/matches/store-types";

let runtime: MatchRequestRuntime;

export const useMatchStore = create<MatchState>()(
  persist(
    (set, get) => {
      runtime = createMatchRequestRuntime({ setState: set, getState: get });
      const context = { setState: set, getState: get, runtime };
      return {
        ...emptyMatchCache(), ...idleMatchRequests(),
        resetMatchCache: () => runtime.reset(),
        ...createDetailActions(context),
        ...createHistoryActions(context),
        ...createSeasonActions(context),
      };
    },
    {
      name: "match-history-cache",
      version: MATCH_STORE_VERSION,
      storage: createJSONStorage(() => appStorage),
      /**
       * Migrate dữ liệu cũ sang format mới khi version thay đổi.
       * Nếu version không khớp, các trường matches/lastUpdated/totalMatches/historyEndIndex sẽ reset.
       */
      migrate: (persistedState, persistedVersion) => {
        const persisted = persistedState as Partial<PersistedMatchState>;
        const migrated: PersistedMatchState = {
          authKey: persisted.authKey ?? "guest",
          matches:
            persistedVersion === MATCH_STORE_VERSION
              ? persisted.matches ?? []
              : [],
          lastUpdated:
            persistedVersion === MATCH_STORE_VERSION
              ? persisted.lastUpdated ?? 0
              : 0,
          totalMatches:
            persistedVersion === MATCH_STORE_VERSION
              ? persisted.totalMatches ?? persisted.matches?.length ?? 0
              : 0,
          historyEndIndex:
            persistedVersion === MATCH_STORE_VERSION
              ? persisted.historyEndIndex ?? persisted.matches?.length ?? 0
              : 0,
          seasonStats:
            persistedVersion === MATCH_STORE_VERSION
              ? persisted.seasonStats ?? null
              : null,
          seasonOptions:
            persistedVersion === MATCH_STORE_VERSION
              ? persisted.seasonOptions ?? []
              : [],
        };
        return migrated as unknown as MatchState;
      },
      /**
       * Chỉ lưu các trường cần thiết xuống storage (bỏ detailsById, loading state, etc.)
       * Danh sách matches bị cắt ở MAX_PERSISTED_MATCHES: hydrate "load more"
       * có thể phình vô hạn theo thời gian, bản ghi xuống đĩa cần có trần để
       * giá trị MMKV không phình theo tháng sử dụng. Danh sách trong bộ nhớ
       * vẫn đầy đủ trong session.
       */
      partialize: (state) => ({
        authKey: state.authKey,
        matches: state.matches.slice(0, MAX_PERSISTED_MATCHES),
        lastUpdated: state.lastUpdated,
        totalMatches: state.totalMatches,
        historyEndIndex: state.historyEndIndex,
        seasonStats: state.seasonStats,
        seasonOptions: state.seasonOptions,
      }),

    }
  )
);

/** Data only: pending tasks, credentials and loading flags never survive rollback. */
export function captureMatchCache(): MatchCacheSnapshot {
  const { authKey, matches, detailsById, error, lastUpdated, totalMatches,
    historyEndIndex, seasonStats, seasonStatsById, seasonMatchesById, seasonOptions } = useMatchStore.getState();
  return { authKey, matches, detailsById, error, lastUpdated, totalMatches,
    historyEndIndex, seasonStats, seasonStatsById, seasonMatchesById, seasonOptions };
}

/** Invalidate tasks from both sides of the switch before restoring cached data. */
export function restoreMatchCache(snapshot: MatchCacheSnapshot): void {
  runtime.invalidate();
  useMatchStore.setState({ ...snapshot, ...idleMatchRequests() });
}
