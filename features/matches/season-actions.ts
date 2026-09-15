import { getContent, getCompetitiveUpdates } from "~/utils/valorant-api";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { buildMatchHistoryRecord, compactRankUpdate, createMatchAssetCatalog } from "~/utils/match-ui";
import { hasPendingProfileSeasonRequest, inspectSeasonUpdatePage, resolveProfileSeason, type ProfileSeasonPageInspection } from "~/features/profile/profile-season-data";
import { buildLeaderboardSeasonOptions } from "~/utils/leaderboard-seasons";
import { getNetworkProfile, mapWithConcurrency } from "~/utils/network";
import { SEASON_STATS_CACHE_TTL_MS, SEASON_STATS_FAILURE_TTL_MS, SEASON_STATS_CALCULATION_VERSION, SEASON_UPDATES_PAGE_SIZE, SEASON_DETAIL_REQUEST_DELAY_MS, wait } from "./cache-policy";
import { summarizeSeasonMatches, type CompetitiveSeason } from "./season-summary";
import type { MatchState } from "./store-types";
import type { MatchActionContext } from "./request-runtime";

export function createSeasonActions({
  setState: set, getState: get, runtime,
}: MatchActionContext): Pick<MatchState, "fetchSeasonStats"> {
  return {
    fetchSeasonStats: async (user, force = false, requestedSeasonId) => {
      if (
        !user.accessToken ||
        !user.entitlementsToken ||
        !user.id ||
        !user.region
      ) {
        return;
      }

      const scope = runtime.begin(user);
      if (!scope) return;
      const authKey = get().authKey;
      const initialState = get();
      const knownSeason = resolveProfileSeason(
        initialState.authKey === authKey ? initialState.seasonOptions : [],
        requestedSeasonId
      );
      const provisionalSeasonKey =
        requestedSeasonId?.trim() || knownSeason?.id || "active";
      const requestKey = `${scope.key}|${provisionalSeasonKey.toLocaleLowerCase("en-US")}`;
      const failureAt = runtime.seasonStatsFailures.get(requestKey);

      if (
        !force &&
        failureAt !== undefined &&
        Date.now() - failureAt < SEASON_STATS_FAILURE_TTL_MS
      ) {
        return;
      }

      const existingRequest = runtime.seasonStatsInFlight.get(requestKey);
      if (existingRequest) return existingRequest;

      runtime.seasonStatsLoadingKeys.add(requestKey);
      set({ seasonStatsLoading: true });

      const request = (async () => {
        let resolvedRequestKey = requestKey;
        try {
          let seasonOptions = get().seasonOptions;
          const requestedId = requestedSeasonId?.trim().toLocaleLowerCase("en-US");
          const knowsRequestedSeason =
            !requestedId ||
            seasonOptions.some(
              (option) =>
                option.id.toLocaleLowerCase("en-US") === requestedId
            );

          if (seasonOptions.length === 0 || !knowsRequestedSeason) {
            const content = await getContent(
              user.accessToken,
              user.entitlementsToken,
              user.region
            );
            if (!scope.isCurrent()) return;
            seasonOptions = buildLeaderboardSeasonOptions(
              content?.Seasons ?? []
            );
            set({ seasonOptions });
          }

          const selectedOption = resolveProfileSeason(
            seasonOptions,
            requestedSeasonId
          );
          if (!selectedOption) {
            throw new Error("Could not resolve a competitive Act.");
          }
          resolvedRequestKey = `${scope.key}|${selectedOption.id.toLocaleLowerCase("en-US")}`;

          const resolvedFailureAt = runtime.seasonStatsFailures.get(resolvedRequestKey);
          if (!force && resolvedFailureAt !== undefined && Date.now() - resolvedFailureAt < SEASON_STATS_FAILURE_TTL_MS) return;
          const currentState = get();
          const cachedStats =
            currentState.seasonStatsById[selectedOption.id] ??
            (currentState.seasonStats?.seasonId.toLocaleLowerCase("en-US") ===
            selectedOption.id.toLocaleLowerCase("en-US")
              ? currentState.seasonStats
              : null);
          if (
            !force &&
            cachedStats &&
            cachedStats.calculationVersion ===
              SEASON_STATS_CALCULATION_VERSION &&
            Date.now() - cachedStats.updatedAt < SEASON_STATS_CACHE_TTL_MS
          ) {
            set((state) => ({
              seasonStatsById: {
                ...state.seasonStatsById,
                [selectedOption.id]: cachedStats,
              },
            }));
            return;
          }

          const season: CompetitiveSeason = {
            id: selectedOption.id,
            name: selectedOption.name,
            startTimeMs: Date.parse(selectedOption.startTime) || 0,
            endTimeMs: 0,
          };

          const seasonUpdates: CompetitiveUpdatesResponse["Matches"] = [];
          let startIndex = 0;
          let pageCount = 0;
          let hasSeenTarget = false;

          // Luồng updates có thứ tự mới → cũ. Với Act lịch sử, tiếp tục qua
          // các Act mới hơn rồi dừng ngay khi đã đi sang Act cũ hơn mục tiêu.
          while (pageCount < 30) {
            const page = await getCompetitiveUpdates(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              {
                startIndex,
                // endIndex là INCLUSIVE (giống các chỗ dùng "- 1" khác trong
                // file) → lấy đúng PAGE_SIZE item, không lệch +1 gây hỏng
                // điều kiện dừng `updates.length < PAGE_SIZE`.
                endIndex: startIndex + SEASON_UPDATES_PAGE_SIZE - 1,
                queue: "competitive",
              }
            );
            if (!scope.isCurrent()) return;
            if (!page) {
              throw new Error("Could not load competitive updates.");
            }

            const updates = page.Matches ?? [];
            const inspection: ProfileSeasonPageInspection<
              CompetitiveUpdatesResponse["Matches"][number]
            > = inspectSeasonUpdatePage(
              updates,
              season.id,
              hasSeenTarget
            );
            seasonUpdates.push(...inspection.targetUpdates);
            hasSeenTarget = inspection.hasSeenTarget;

            if (
              updates.length < SEASON_UPDATES_PAGE_SIZE ||
              inspection.shouldStop
            ) {
              break;
            }
            startIndex += updates.length;
            pageCount += 1;
          }

          const updateByMatch = new Map(
            seasonUpdates.map((update) => [update.MatchID, update])
          );
          const uniqueMatchIds = Array.from(updateByMatch.keys()).filter(Boolean);
          if (uniqueMatchIds.length === 0) {
            const emptyStats = summarizeSeasonMatches([], user.id, season);
            runtime.seasonStatsFailures.delete(resolvedRequestKey);
            set((state) => ({
              ...(selectedOption.isActive ? { seasonStats: emptyStats } : {}),
              seasonStatsById: {
                ...state.seasonStatsById,
                [selectedOption.id]: emptyStats,
              },
              seasonMatchesById: {
                ...state.seasonMatchesById,
                [selectedOption.id]: [],
              },
            }));
            return;
          }
          const network = await getNetworkProfile();
          if (!network.isConnected || !scope.isCurrent()) return;
          const detailsList = await mapWithConcurrency(
            uniqueMatchIds,
            1,
            async (matchId) => {
              for (let attempt = 0; attempt < 4; attempt += 1) {
                if (!scope.isCurrent()) return null;
                const details = await get().fetchMatchDetails(
                  user,
                  matchId,
                  attempt > 0
                );
                if (!scope.isCurrent()) return null;
                if (details) {
                  await wait(SEASON_DETAIL_REQUEST_DELAY_MS);
                  return details;
                }
                await wait(2_000 * (attempt + 1));
              }
              return null;
            }
          );
          if (!scope.isCurrent()) return;
          // Chấp nhận kết quả PARTIAL: crawl cả Act tốn vài phút, nếu chỉ
          // thiếu 1-2 match detail (lỗi transient sau 4 lần retry) thì vứt
          // toàn bộ kết quả là quá lãng phí. Chỉ throw khi KHÔNG có detail
          // nào — khi đó không đủ dữ liệu để tính stats có ý nghĩa.
          const fetchedDetails = detailsList.filter(
            (details): details is NonNullable<typeof details> =>
              Boolean(details)
          );
          if (fetchedDetails.length === 0) {
            throw new Error(
              `Season stats failed: 0/${uniqueMatchIds.length} match details loaded.`
            );
          }
          if (fetchedDetails.length < uniqueMatchIds.length && __DEV__) {
            console.warn(
              `[season-stats] partial data: ${fetchedDetails.length}/${uniqueMatchIds.length} match details loaded`
            );
          }

          const seasonStats = summarizeSeasonMatches(
            fetchedDetails,
            user.id,
            season
          );
          const catalog = createMatchAssetCatalog();
          const seasonMatches = detailsList.flatMap((details, index) => {
            if (!details) return [];
            const matchId = uniqueMatchIds[index];
            const update = updateByMatch.get(matchId);
            const numericStart = Number(update?.MatchStartTime);
            const parsedStart = Date.parse(String(update?.MatchStartTime ?? ""));
            const gameStartTime = Number.isFinite(numericStart)
              ? numericStart
              : Number.isFinite(parsedStart)
                ? parsedStart
                : details.matchInfo?.gameStartMillis ?? 0;

            return [
              buildMatchHistoryRecord(
                {
                  MatchID: matchId,
                  GameStartTime: gameStartTime,
                  QueueID: "competitive",
                  rankUpdate: compactRankUpdate(update),
                },
                details,
                user.id,
                catalog
              ),
            ];
          });
          if (__DEV__) {
            console.log("[season-stats] computed", seasonStats);
          }
          runtime.seasonStatsFailures.delete(resolvedRequestKey);
          set((state) => ({
            ...(selectedOption.isActive ? { seasonStats } : {}),
            seasonStatsById: {
              ...state.seasonStatsById,
              [selectedOption.id]: seasonStats,
            },
            seasonMatchesById: {
              ...state.seasonMatchesById,
              [selectedOption.id]: seasonMatches,
            },
          }));
        } catch (error) {
          if (__DEV__) {
            console.warn("[season-stats] fetch failed", sanitizeErrorForLog(error));
          }
          if (scope.isCurrent()) {
            runtime.seasonStatsFailures.set(requestKey, Date.now());
            runtime.seasonStatsFailures.set(resolvedRequestKey, Date.now());
          }
        } finally {
          runtime.seasonStatsLoadingKeys.delete(requestKey);
          if (scope.isCurrent()) {
            set({
              seasonStatsLoading: hasPendingProfileSeasonRequest(
                runtime.seasonStatsLoadingKeys,
                authKey
              ),
            });
          }
        }
      })().finally(() => {
        if (runtime.seasonStatsInFlight.get(requestKey) === request) runtime.seasonStatsInFlight.delete(requestKey);
      });

      runtime.seasonStatsInFlight.set(requestKey, request);
      return request;
    },

  };
}
