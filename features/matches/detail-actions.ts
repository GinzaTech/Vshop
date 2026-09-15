import type { MatchDetailsData } from "~/types/match-ui";
import { matchDetails } from "~/utils/valorant-api";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { MATCH_DETAIL_RETRY_DELAY_MS, wait } from "./cache-policy";
import type { MatchState } from "./store-types";
import type { MatchActionContext } from "./request-runtime";

export function createDetailActions({
  setState: set, getState: get, runtime,
}: MatchActionContext): Pick<MatchState, "fetchMatchDetails" | "mergeMatchDetails"> {
  return {
    fetchMatchDetails: async (user, matchId, force = false) => {
      // Validate input — thiếu token hoặc matchId thì trả về null
      if (
        !user.accessToken ||
        !user.entitlementsToken ||
        !user.region ||
        !user.id ||
        !matchId
      ) {
        return null;
      }

      const scope = runtime.begin(user);
      if (!scope) return null;

      // Nếu đã có trong cache và không force thì trả về cache
      const cached = get().detailsById[matchId];
      if (cached && !force) return cached;

      // Deduplication: nếu đang có request cho matchId này thì trả về promise đó
      const detailKey = `${scope.key}|${matchId}`;
      const existingPromise = runtime.detailsInFlight.get(detailKey);
      if (existingPromise) return existingPromise;

      // Tạo request fetch detail với retry tối đa 2 lần (nếu lỗi server >= 500)
      const request = (async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (!scope.isCurrent()) return null;
          try {
            const details = await matchDetails(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              matchId
            );
            // Chỉ lưu vào cache nếu auth key còn hợp lệ
            if (!scope.isCurrent()) return null;
            set((state) => ({
              detailsById: runtime.addDetail(
                state.detailsById,
                matchId,
                details
              ),
            }));
            return details;
          } catch (error) {
            if (!scope.isCurrent()) return null;
            // Retry nếu lần đầu và lỗi >= 500 hoặc không xác định
            const status = Number(
              (error as { response?: { status?: number } })?.response?.status
            );
            if (__DEV__) {
              console.warn("[match-details] request failed", {
                attempt: attempt + 1,
                ...sanitizeErrorForLog(error),
              });
            }
            const canRetry =
              attempt === 0 &&
              (!Number.isFinite(status) || status === 429 || status >= 500);
            if (!canRetry) return null;
            await wait(status === 429 ? 12_000 : MATCH_DETAIL_RETRY_DELAY_MS);
          }
        }
        return null;
      })();

      // Track request để tránh trùng lặp — tự xóa khỏi map khi hoàn thành
      const trackedRequest = request.finally(() => {
        if (runtime.detailsInFlight.get(detailKey) === trackedRequest) runtime.detailsInFlight.delete(detailKey);
      });
      runtime.detailsInFlight.set(detailKey, trackedRequest);
      return trackedRequest;
    },

    /**
     * Merge một phần dữ liệu detail vào memory cache QUA LRU (fix M7).
     * Screen (match_details) trước đây setState trực tiếp trên detailsById:
     * - Không bump detailCacheOrder → LRU diverge, entry leak.
     * - Nếu entry đã bị evict, spread `undefined` tạo entry rác chỉ có
     *   playerIdentities → cache-hit sau đó trả object lỗi → crash.
     * Hành vi: entry gốc tồn tại → merge + bump LRU; đã bị evict → bỏ qua.
     */
    mergeMatchDetails: (matchId, patch) => {
      const state = get();
      const existing = state.detailsById[matchId];
      if (!existing) {
        // Entry đã bị LRU evict (hoặc chưa fetch) — patch rời rạc không
        // đủ dữ liệu để dựng detail hợp lệ, bỏ qua an toàn.
        return;
      }
      const merged: MatchDetailsData = { ...existing, ...patch };
      set({
        detailsById: runtime.addDetail(
          state.detailsById,
          matchId,
          merged
        ),
      });
    },

  };
}
