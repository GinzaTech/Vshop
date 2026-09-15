import type { MatchHistoryRecord } from "~/types/match-ui";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { getAccountSessionKey as getMatchAuthKey } from "~/utils/saved-accounts";
import { getCompetitiveUpdates, playerMatchHistory } from "~/utils/valorant-api";
import { loadAssets, loadAgent } from "~/utils/valorant-assets";
import { getNetworkProfile } from "~/utils/network";
import { archiveObservedMatches } from "~/services/matches/match-archive";
import { buildMatchHistoryRecord, compactRankUpdate, createMatchAssetCatalog, enrichMatchHistoryAssets } from "~/utils/match-ui";
import { MATCH_HISTORY_LIMIT, INITIAL_FETCH_TOTAL, MATCH_CACHE_TTL_MS, DELTA_FETCH_LIMIT, CELLULAR_INITIAL_DETAILS, WIFI_INITIAL_DETAILS } from "./cache-policy";
import { hydrateMatchBatch } from "./hydrate-batch";
import type { MatchState } from "./store-types";
import type { MatchActionContext } from "./request-runtime";

const archiveObservedMatchesSafely = async (
  authKey: string,
  matches: readonly MatchHistoryRecord[]
) => {
  try {
    await archiveObservedMatches(authKey, matches);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[matchStore] archive write failed",
        sanitizeErrorForLog(error)
      );
    }
  }
};

export function createHistoryActions({
  setState: set, getState: get, runtime,
}: MatchActionContext): Pick<MatchState, "hydrateNextMatches" | "fetchMatches"> {
  return {
    hydrateNextMatches: async (user, count) => {
      // Validation + kiểm tra auth key khớp với session hiện tại
      const authKey = getMatchAuthKey(user);
      if (
        authKey === "guest" ||
        !user.accessToken ||
        !user.entitlementsToken ||
        !user.region ||
        !user.id ||
        get().authKey !== authKey ||
        get().loading
      ) {
        return;
      }
      const scope = runtime.begin(user);
      if (!scope) return;
      // Deduplication: nếu đang hydrate thì trả về promise hiện tại
      if (runtime.hydrationInFlight?.key === scope.key) {
        return runtime.hydrationInFlight.promise;
      }

      const request = (async () => {
        // Kiểm tra kết nối mạng
        const network = await getNetworkProfile().catch((error: unknown) => {
          if (__DEV__) console.warn("[matchStore] network profile unavailable", sanitizeErrorForLog(error));
          return null;
        });
        if (!network?.isConnected) return;
        // Re-check authKey SAU await: trong lúc chờ network profile, một
        // fetchMatches của user khác có thể đã reset store. Nếu không check,
        // cờ `hydrating: true` set bên dưới sẽ dính vào session mới và
        // không bao giờ được request này reset (finally sẽ skip do authKey
        // không khớp) → footer "đang tải" kẹt vô hạn.
        if (!scope.isCurrent()) return;

        // Xác định batch size theo network type (nhỏ để load từng trận)
        const batchSize = count ?? (network.isCellular ? 1 : 2);
        // Lấy các match chưa có stats
        let pending = get()
          .matches.filter((match) => match.stats === undefined)
          .slice(0, batchSize);

        // Nếu không còn match chưa hydrate, kiểm tra còn trang nào không
        if (pending.length === 0) {
          const state = get();
          if (
            state.historyEndIndex >= state.totalMatches ||
            state.totalMatches === 0
          ) {
            return;
          }
        }

        set({ hydrating: true });
        try {
          // Nếu không còn match pending, tải thêm trang match history từ server
          if (pending.length === 0) {
            const state = get();
            const startIndex = state.historyEndIndex;
            const endIndex = Math.min(
              startIndex + MATCH_HISTORY_LIMIT,
              state.totalMatches
            );
            const [page, competitiveUpdates] = await Promise.all([
              playerMatchHistory(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                { startIndex, endIndex }
              ),
              getCompetitiveUpdates(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                {
                  startIndex: 0,
                  endIndex: Math.max(0, endIndex - 1),
                  queue: "competitive",
                }
              ).catch(() => null),
            ]);
            if (!scope.isCurrent()) return;

            const knownIds = new Set(
              get().matches.map((match) => match.MatchID)
            );
            const updateByMatch = new Map(
              (competitiveUpdates?.Matches ?? []).map((entry) => [
                entry.MatchID,
                compactRankUpdate(entry),
              ])
            );
            // Lọc bỏ các match đã có trong danh sách (tránh trùng lặp)
            const nextMatches: MatchHistoryRecord[] = (
              page.History ?? []
            ).flatMap((match) =>
              knownIds.has(match.MatchID)
                ? []
                : [
                    {
                      MatchID: match.MatchID,
                      GameStartTime: match.GameStartTime,
                      QueueID: match.QueueID,
                      rankUpdate: updateByMatch.get(match.MatchID) ?? null,
                    },
                  ]
            );
            // Tính toán end index mới và tổng số trận
            const reportedEndIndex = Number(page.EndIndex);
            const nextEndIndex = Number.isFinite(reportedEndIndex)
              ? Math.max(startIndex, reportedEndIndex)
              : startIndex + (page.History?.length ?? 0);
            const reportedTotal = Number(page.Total);

            // Cập nhật store: thêm match mới, sắp xếp theo thời gian giảm dần
            set((current) => ({
              matches: [...current.matches, ...nextMatches].sort(
                (left, right) => right.GameStartTime - left.GameStartTime
              ),
              historyEndIndex:
                nextEndIndex > startIndex
                  ? nextEndIndex
                  : current.totalMatches,
              totalMatches: Number.isFinite(reportedTotal)
                ? Math.max(current.totalMatches, reportedTotal)
                : current.totalMatches,
            }));
            // Lấy batch cần hydrate từ các match vừa tải
            pending = nextMatches.slice(0, batchSize);
          }

          // Không còn match nào để hydrate -> thoát
          if (pending.length === 0) return;

          // Hydrate (làm giàu) các match pending — fetch detail + build record
          const hydrated = await hydrateMatchBatch(
            pending,
            user,
            network.requestConcurrency,
            (matchId) => scope.isCurrent() ? get().fetchMatchDetails(user, matchId) : Promise.resolve(null)
          );
          // Kiểm tra auth key còn hợp lệ trước khi cập nhật
          if (!scope.isCurrent()) return;

          // Thay thế các match cũ bằng phiên bản đã hydrate
          const hydratedById = new Map(
            hydrated.map((match) => [match.MatchID, match])
          );
          set((state) => ({
            matches: state.matches.map(
              (match) => hydratedById.get(match.MatchID) || match
            ),
          }));
          void archiveObservedMatchesSafely(authKey, hydrated);
        } catch (error) {
          if (__DEV__) {
            console.warn("Failed to load more match history", sanitizeErrorForLog(error));
          }
        } finally {
          // Reset hydrating nếu auth key vẫn hợp lệ
          if (scope.isCurrent()) set({ hydrating: false });
        }
      })().finally(() => {
        if (runtime.hydrationInFlight?.promise === request) runtime.hydrationInFlight = null;
      });

      runtime.hydrationInFlight = { key: scope.key, promise: request };
      return request;
    },

    fetchMatches: async (user, force = false) => {
      // Validate input — thiếu thông tin user thì thoát (không coi là thành công)
      if (
        !user.accessToken ||
        !user.entitlementsToken ||
        !user.id ||
        !user.region
      ) {
        return false;
      }

      // Nếu cache còn hạn và không force thì bỏ qua
      const scope = runtime.begin(user);
      if (!scope) return false;

      // Restored sessions do not pass through buildAuthenticatedUser, so the
      // in-memory asset catalog starts empty even when match records are cached.
      // Load it before the TTL early return and repair cached visual metadata.
      try {
        await Promise.all([loadAssets(), loadAgent()]);
        if (scope.isCurrent() && get().matches.length > 0) {
          const currentMatches = get().matches;
          const enrichedMatches = enrichMatchHistoryAssets(currentMatches);
          if (
            enrichedMatches.some(
              (record, index) => record !== currentMatches[index]
            )
          ) {
            set({ matches: enrichedMatches });
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[matchStore] asset metadata unavailable", sanitizeErrorForLog(error));
        }
      }

      if (!scope.isCurrent()) return false;
      const state = get();
      if (!force && state.lastUpdated > 0 && Date.now() - state.lastUpdated < MATCH_CACHE_TTL_MS) {
        return true;
      }

      // --- DELTA SYNC: cache stale nhưng đã có data → chỉ fetch trận mới ---
      if (!force && state.matches.length > 0) {
        if (runtime.matchesInFlight?.key === scope.key) return runtime.matchesInFlight.promise;

        const deltaRequest = (async (): Promise<boolean> => {
          try {
            const [deltaPage, competitiveUpdates] = await Promise.all([
              playerMatchHistory(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                { startIndex: 0, endIndex: DELTA_FETCH_LIMIT - 1 }
              ),
              getCompetitiveUpdates(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                {
                  startIndex: 0,
                  endIndex: DELTA_FETCH_LIMIT - 1,
                  queue: "competitive",
                }
              ).catch(() => null),
            ]);
            if (!scope.isCurrent()) {
              return false;
            }
            if (!deltaPage?.History) {
              set({ lastUpdated: Date.now() });
              return true;
            }

            const updateByMatch = new Map(
              (competitiveUpdates?.Matches ?? []).map((entry) => [
                entry.MatchID,
                compactRankUpdate(entry),
              ])
            );
            if (updateByMatch.size > 0) {
              set((current) => ({
                matches: current.matches.map((match) => {
                  const rankUpdate = updateByMatch.get(match.MatchID);
                  return rankUpdate
                    ? { ...match, rankUpdate }
                    : match;
                }),
              }));
            }

            const currentMatches = get().matches;
            const knownIds = new Set(
              currentMatches.map((m) => m.MatchID)
            );
            // RETRY SET: match từng hydrate THẤT BẠI (stats: null) cần được
            // thử lại ở chu kỳ delta này, nếu không chúng sẽ kẹt card
            // "unavailable" vĩnh viễn (knownIds chặn mọi lần fetch lại).
            const failedIds = new Set(
              currentMatches
                .filter((m) => m.stats === null)
                .map((m) => m.MatchID)
            );
            const newRawMatches = deltaPage.History.filter(
              (m) => !knownIds.has(m.MatchID) || failedIds.has(m.MatchID)
            );

            if (newRawMatches.length === 0) {
              // Không có trận mới → chỉ update timestamp
              set({ lastUpdated: Date.now() });
              return true;
            }

            // Hydrate từng trận mới (1 lần/viết, không batch)
            const catalog = createMatchAssetCatalog();
            const hydratedForArchive: MatchHistoryRecord[] = [];
            for (const raw of newRawMatches) {
              const details = await get().fetchMatchDetails(user, raw.MatchID);
              if (!scope.isCurrent()) return false;
              const record = buildMatchHistoryRecord(
                {
                  MatchID: raw.MatchID,
                  GameStartTime: raw.GameStartTime,
                  QueueID: raw.QueueID,
                  rankUpdate: updateByMatch.get(raw.MatchID) ?? null,
                },
                details,
                user.id,
                catalog
              );
              hydratedForArchive.push(record);
              // RETRY match đã tồn tại → REPLACE thay vì append (tránh
              // trùng lặp trong danh sách). Match mới → append + sort.
              set((current) => {
                const exists = current.matches.some(
                  (m) => m.MatchID === record.MatchID
                );
                const matches = exists
                  ? current.matches.map((m) =>
                      m.MatchID === record.MatchID ? record : m
                    )
                  : [...current.matches, record].sort(
                      (a, b) => b.GameStartTime - a.GameStartTime
                    );
                return {
                  matches,
                  lastUpdated: Date.now(),
                  totalMatches: Math.max(
                    current.totalMatches,
                    Number(deltaPage.Total) || current.totalMatches
                  ),
                };
              });
            }
            void archiveObservedMatchesSafely(
              getMatchAuthKey(user),
              hydratedForArchive
            );
            if (__DEV__) {
              console.log(`[matchStore] delta sync: +${newRawMatches.length} new matches`);
            }
            return true;
          } catch (error) {
            if (__DEV__) console.warn("[matchStore] delta sync failed", sanitizeErrorForLog(error));
            // FIX (H6a): KHÔNG bump lastUpdated khi fail — nếu stamp "fresh"
            // thì TTL 30 phút sẽ chặn mọi retry trong khi chẳng có dữ liệu
            // mới nào được tải về. Bỏ stamp → chu kỳ delta kế tiếp được thử.
            return false;
          }
        })().finally(() => {
          if (runtime.matchesInFlight?.promise === deltaRequest) runtime.matchesInFlight = null;
        });

        runtime.matchesInFlight = { key: scope.key, kind: "delta", promise: deltaRequest };
        return deltaRequest;
      }

      // Deduplication: nếu đang fetch thì trả về promise hiện tại
      const running = runtime.matchesInFlight;
      if (running?.key === scope.key) {
        if (!force) return running.promise;
        // FIX (H7): force=true (pull-to-refresh) trước đây bị nuốt bởi
        // request đang chạy — return promise của delta khiến full re-fetch
        // không bao giờ chạy. Giờ: nếu đang chạy là DELTA (fetch nhỏ) thì
        // đợi nó xong rồi rơi xuống chạy full fetch mới; nếu đang là FULL
        // fetch (dữ liệu vừa từ server) thì join là đủ.
        if (running.kind === "delta") {
          await running.promise.catch(() => undefined);
          if (!scope.isCurrent()) return false;
          if (runtime.matchesInFlight?.key === scope.key && runtime.matchesInFlight.kind === "full") return runtime.matchesInFlight.promise;
          // rơi xuống bên dưới để khởi tạo full fetch
        } else {
          return running.promise;
        }
      }

      const request = (async (): Promise<boolean> => {
        set({ loading: true, error: null });
        // Hàm wrapper an toàn cho playerMatchHistory (tránh crash khi lỗi)
        const fetchHistorySafe = async (params?: {
          startIndex?: number;
          endIndex?: number;
          queue?: string;
        }): Promise<MatchHistoryResponse | null> => {
          try {
            return await playerMatchHistory(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              params
            );
          } catch (error) {
            if (__DEV__) console.warn("playerMatchHistory failed", sanitizeErrorForLog(error));
            return null;
          }
        };

        try {
          // Fetch 2 pages song song để lấy 30 trận (Riot API giới hạn 20/request)
          const [page1, page2, competitiveUpdates] = await Promise.all([
            fetchHistorySafe({ startIndex: 0, endIndex: MATCH_HISTORY_LIMIT - 1 }),
            fetchHistorySafe({ startIndex: MATCH_HISTORY_LIMIT, endIndex: INITIAL_FETCH_TOTAL - 1 }),
            getCompetitiveUpdates(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              {
                startIndex: 0,
                endIndex: INITIAL_FETCH_TOTAL - 1,
                queue: "competitive",
              }
            ).catch(() => null),
          ]);

          // Merge 2 trang history
          const mergedHistory = [
            ...(page1?.History ?? []),
            ...(page2?.History ?? []),
          ];
          const historyData = page1
            ? {
                History: mergedHistory,
                Total: page1.Total,
                EndIndex: Math.max(
                  Number(page1.EndIndex),
                  Number(page2?.EndIndex ?? 0)
                ),
              }
            : null;

          // Kiểm tra auth key sau khi fetch — session đã đổi, kết quả vô nghĩa
          if (!scope.isCurrent()) return false;
          if (!historyData) {
            set({ error: "Could not load match data." });
            return false;
          }
          if (!historyData?.History?.length) {
            // Không có match nào -> reset store. Đây là trạng thái HỢP LỆ
            // (tài khoản chưa chơi trận nào) → trả true.
            set({
              matches: [],
              loading: false,
              lastUpdated: Date.now(),
              totalMatches: 0,
              historyEndIndex: 0,
            });
            return true;
          }

          // Chỉ lấy số lượng match trong giới hạn
          const historyList = historyData.History.slice(
            0,
            INITIAL_FETCH_TOTAL
          );
          // Ghép rank update vào match tương ứng (nếu có)
          const updateByMatch = new Map(
            (competitiveUpdates?.Matches ?? []).map((entry) => [
              entry.MatchID,
              entry,
            ])
          );
          // Tạo base matches (chưa có stats/chi tiết)
          const baseMatches: MatchHistoryRecord[] = historyList.map(
            (match) => ({
              MatchID: match.MatchID,
              GameStartTime: match.GameStartTime,
              QueueID: match.QueueID,
              rankUpdate: compactRankUpdate(updateByMatch.get(match.MatchID)),
            })
          );
          // Cập nhật store với các base matches
          const reportedTotal = Number(historyData.Total);
          const reportedEndIndex = Number(historyData.EndIndex);
          set({
            matches: baseMatches,
            lastUpdated: Date.now(),
            totalMatches: Number.isFinite(reportedTotal)
              ? Math.max(baseMatches.length, reportedTotal)
              : baseMatches.length,
            historyEndIndex: Number.isFinite(reportedEndIndex)
              ? Math.max(baseMatches.length, reportedEndIndex)
              : baseMatches.length,
          });

          // Hydrate lô match đầu tiên (chi tiết + build record) dựa trên network type
          const network = await getNetworkProfile();
          if (!network.isConnected || !scope.isCurrent()) return false;
          const initialCount = network.isCellular
            ? CELLULAR_INITIAL_DETAILS
            : WIFI_INITIAL_DETAILS;
          const hydrated = await hydrateMatchBatch(
            baseMatches.slice(0, initialCount),
            user,
            network.requestConcurrency,
            (matchId) => scope.isCurrent() ? get().fetchMatchDetails(user, matchId) : Promise.resolve(null)
          );
          if (!scope.isCurrent()) return false;

          // Thay thế base matches bằng phiên bản đã hydrate
          const hydratedById = new Map(
            hydrated.map((match) => [match.MatchID, match])
          );
          set({
            matches: baseMatches.map(
              (match) => hydratedById.get(match.MatchID) || match
            ),
          });
          void archiveObservedMatchesSafely(
            getMatchAuthKey(user),
            hydrated
          );
          return true;
        } catch (error) {
          if (__DEV__) console.error("Failed to fetch matches globally", sanitizeErrorForLog(error));
          if (scope.isCurrent()) {
            set({ error: "Could not load match data." });
          }
          return false;
        } finally {
          // Reset loading + giải phóng in-flight tracker
          if (scope.isCurrent()) set({ loading: false });
        }
      })().finally(() => {
        if (runtime.matchesInFlight?.promise === request) runtime.matchesInFlight = null;
      });

      // Track request in-flight để deduplicate
      runtime.matchesInFlight = { key: scope.key, kind: "full", promise: request };
      return request;
    },
  };
}
