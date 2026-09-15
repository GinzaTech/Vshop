import { getCompetitiveMMR, getContent, getCompetitiveUpdates, playerMatchHistory } from "~/utils/valorant-api";
import type {
  MatchHistoryRecord,
  SeasonPerformanceStats,
} from "~/types/match-ui";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { buildMatchHistoryRecord, compactRankUpdate, createMatchAssetCatalog } from "~/utils/match-ui";
import { hasPendingProfileSeasonRequest, inspectSeasonUpdatePage, normalizeProfileMatchStartTime, resolveProfileSeason, resolveProfileSeasonTimeWindow, type ProfileSeasonPageInspection } from "~/features/profile/profile-season-data";
import { buildLeaderboardSeasonOptions } from "~/utils/leaderboard-seasons";
import { getNetworkProfile, mapWithConcurrency } from "~/utils/network";
import {
  chooseMatchArchiveStats,
  loadMatchSeasonArchive,
  mergeMatchArchiveRecords,
  saveMatchSeasonArchive,
  type MatchArchiveSyncStatus,
  type MatchSeasonArchive,
  type SaveMatchSeasonArchiveInput,
} from "~/services/matches/match-archive";
import { MAX_SEASON_UPDATES_PAGES, SEASON_STATS_CACHE_TTL_MS, SEASON_STATS_FAILURE_TTL_MS, SEASON_STATS_CALCULATION_VERSION, SEASON_UPDATES_PAGE_SIZE, SEASON_DETAIL_REQUEST_DELAY_MS, wait } from "./cache-policy";
import { summarizeSeasonMatches, type CompetitiveSeason } from "./season-summary";
import { buildMmrSeasonPerformanceStats } from "./season-mmr-summary";
import type { MatchState } from "./store-types";
import type { MatchActionContext } from "./request-runtime";

const archiveStatusForStats = (
  stats: SeasonPerformanceStats
): MatchArchiveSyncStatus => {
  if (stats.dataCompleteness === "rank-only") return "rank-only";
  if (stats.dataCompleteness === "partial") return "partial";
  return "complete";
};

const loadArchivedSeasonSafely = async (
  accountKey: string,
  seasonId: string
): Promise<MatchSeasonArchive | null> => {
  try {
    return await loadMatchSeasonArchive(accountKey, seasonId);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[season-stats] archive read failed",
        sanitizeErrorForLog(error)
      );
    }
    return null;
  }
};

const saveArchivedSeasonSafely = async (
  input: SaveMatchSeasonArchiveInput
): Promise<MatchSeasonArchive | null> => {
  try {
    return await saveMatchSeasonArchive(input);
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[season-stats] archive write failed",
        sanitizeErrorForLog(error)
      );
    }
    return null;
  }
};

const resolvePublishedSeasonSnapshot = (
  state: MatchState,
  seasonId: string,
  incomingStats: SeasonPerformanceStats,
  incomingMatches: readonly MatchHistoryRecord[]
) => {
  const currentStats =
    state.seasonStatsById[seasonId] ??
    (state.seasonStats?.seasonId.toLocaleLowerCase("en-US") ===
    seasonId.toLocaleLowerCase("en-US")
      ? state.seasonStats
      : null);
  const compatibleCurrentStats =
    currentStats?.calculationVersion === SEASON_STATS_CALCULATION_VERSION
      ? currentStats
      : null;
  return {
    matches: mergeMatchArchiveRecords(
      state.seasonMatchesById[seasonId] ?? [],
      incomingMatches
    ),
    stats:
      chooseMatchArchiveStats(compatibleCurrentStats, incomingStats) ??
      incomingStats,
  };
};

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

          const archivedSeason = force
            ? null
            : await loadArchivedSeasonSafely(authKey, selectedOption.id);
          if (!scope.isCurrent()) return;
          const archivedStats =
            archivedSeason?.stats?.calculationVersion ===
            SEASON_STATS_CALCULATION_VERSION
              ? archivedSeason.stats
              : null;
          if (archivedSeason) {
            set((state) => ({
              ...(selectedOption.isActive && archivedStats
                ? { seasonStats: archivedStats }
                : {}),
              seasonMatchesById:
                archivedSeason.matches.length > 0
                  ? {
                      ...state.seasonMatchesById,
                      [selectedOption.id]: archivedSeason.matches,
                    }
                  : state.seasonMatchesById,
              seasonStatsById: archivedStats
                ? {
                    ...state.seasonStatsById,
                    [selectedOption.id]: archivedStats,
                  }
                : state.seasonStatsById,
            }));
            if (
              !force &&
              !selectedOption.isActive &&
              archivedStats &&
              archivedSeason.syncStatus === "complete" &&
              (archivedStats.matchCount === 0 ||
                archivedSeason.matches.length > 0)
            ) {
              runtime.seasonStatsFailures.delete(resolvedRequestKey);
              return;
            }
          }

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
            if (!archivedSeason) {
              void saveArchivedSeasonSafely({
                accountKey: authKey,
                matches:
                  currentState.seasonMatchesById[selectedOption.id] ?? [],
                seasonId: selectedOption.id,
                seasonName: selectedOption.name,
                stats: cachedStats,
                syncStatus: archiveStatusForStats(cachedStats),
                updatedAt: cachedStats.updatedAt,
              });
            }
            set((state) => ({
              seasonStatsById: {
                ...state.seasonStatsById,
                [selectedOption.id]: cachedStats,
              },
            }));
            return;
          }

          const seasonWindow = resolveProfileSeasonTimeWindow(
            seasonOptions,
            selectedOption.id
          );
          const season: CompetitiveSeason = {
            id: selectedOption.id,
            name: selectedOption.name,
            startTimeMs:
              seasonWindow?.startTimeMs ??
              (Date.parse(selectedOption.startTime) || 0),
            endTimeMs: seasonWindow?.endTimeMs ?? Infinity,
          };
          const loadMmrSeasonStats = async () => {
            const mmrResult = await getCompetitiveMMR(
              user.accessToken,
              user.entitlementsToken,
              user.region,
              user.id,
              { force }
            );
            if (!scope.isCurrent()) return null;
            return buildMmrSeasonPerformanceStats(mmrResult, season);
          };

          const seasonUpdates: CompetitiveUpdatesResponse["Matches"] = [];
          let startIndex = 0;
          let pageCount = 0;
          let hasSeenTarget = false;
          let crawlCompleted = false;

          // Luồng updates có thứ tự mới → cũ. Với Act lịch sử, tiếp tục qua
          // các Act mới hơn rồi dừng ngay khi đã đi sang Act cũ hơn mục tiêu.
          while (pageCount < MAX_SEASON_UPDATES_PAGES) {
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
              crawlCompleted = true;
              break;
            }
            startIndex += updates.length;
            pageCount += 1;
          }

          if (!crawlCompleted) {
            throw new Error(
              `Competitive update crawl exceeded ${MAX_SEASON_UPDATES_PAGES} pages.`
            );
          }

          const updateByMatch = new Map(
            seasonUpdates.map((update) => [update.MatchID, update])
          );
          const matchStartById = new Map<string, string | number>(
            seasonUpdates.map((update) => [update.MatchID, update.MatchStartTime])
          );

          // Competitive Updates có thể chỉ giữ Act hiện tại. Khi Act đích vắng
          // mặt, dùng match-history đầy đủ theo cửa sổ thời gian rồi xác nhận
          // seasonId lần cuối từ MatchDetails trước khi tổng hợp.
          if (matchStartById.size === 0 && seasonWindow) {
            let historyStartIndex = 0;
            let historyPageCount = 0;
            let historyCompleted = false;
            let historyReportedTotal = 0;

            while (historyPageCount < MAX_SEASON_UPDATES_PAGES) {
              const historyPage = await playerMatchHistory(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                {
                  startIndex: historyStartIndex,
                  endIndex:
                    historyStartIndex + SEASON_UPDATES_PAGE_SIZE - 1,
                }
              );
              if (!scope.isCurrent()) return;

              const history = historyPage.History ?? [];
              const normalizedHistory = history.map((record) => ({
                record,
                startTimeMs: normalizeProfileMatchStartTime(record.GameStartTime),
              }));
              normalizedHistory.forEach(({ record, startTimeMs }) => {
                if (
                  record.MatchID &&
                  record.QueueID.toLocaleLowerCase("en-US") === "competitive" &&
                  startTimeMs >= seasonWindow.startTimeMs &&
                  startTimeMs < seasonWindow.endTimeMs
                ) {
                  matchStartById.set(record.MatchID, record.GameStartTime);
                }
              });

              const passedSelectedSeason = normalizedHistory.some(
                ({ startTimeMs }) =>
                  startTimeMs > 0 && startTimeMs < seasonWindow.startTimeMs
              );
              const total = Number(historyPage.Total);
              const reportedEndIndex = Number(historyPage.EndIndex);
              const nextHistoryStartIndex = Math.max(
                historyStartIndex + history.length,
                Number.isFinite(reportedEndIndex)
                  ? reportedEndIndex
                  : historyStartIndex + SEASON_UPDATES_PAGE_SIZE
              );
              historyReportedTotal = Number.isFinite(total)
                ? Math.max(historyReportedTotal, total)
                : historyReportedTotal;
              const serverExhausted =
                (Number.isFinite(total) && nextHistoryStartIndex >= total) ||
                (!Number.isFinite(total) &&
                  history.length < SEASON_UPDATES_PAGE_SIZE);
              if (passedSelectedSeason || serverExhausted) {
                historyCompleted = true;
                break;
              }

              if (nextHistoryStartIndex <= historyStartIndex) {
                throw new Error("Competitive history pagination did not advance.");
              }
              historyStartIndex = nextHistoryStartIndex;
              historyPageCount += 1;
            }

            if (!historyCompleted) {
              throw new Error(
                `Competitive history crawl exceeded ${MAX_SEASON_UPDATES_PAGES} pages.`
              );
            }
            if (__DEV__) {
              console.log("[season-stats] history fallback", {
                candidates: matchStartById.size,
                pages: historyPageCount + 1,
                seasonId: season.id,
                seasonName: season.name,
                total: historyReportedTotal,
              });
            }
          }

          const uniqueMatchIds = Array.from(matchStartById.keys()).filter(Boolean);
          if (uniqueMatchIds.length === 0) {
            const mmrStats = await loadMmrSeasonStats();
            if (!scope.isCurrent()) return;
            const emptyStats =
              mmrStats ?? summarizeSeasonMatches([], user.id, season);
            const published = resolvePublishedSeasonSnapshot(
              get(),
              selectedOption.id,
              emptyStats,
              archivedSeason?.matches ?? []
            );
            runtime.seasonStatsFailures.delete(resolvedRequestKey);
            set((state) => ({
              ...(selectedOption.isActive
                ? { seasonStats: published.stats }
                : {}),
              seasonStatsById: {
                ...state.seasonStatsById,
                [selectedOption.id]: published.stats,
              },
              seasonMatchesById: {
                ...state.seasonMatchesById,
                [selectedOption.id]: published.matches,
              },
            }));
            void saveArchivedSeasonSafely({
              accountKey: authKey,
              matches: published.matches,
              seasonId: selectedOption.id,
              seasonName: selectedOption.name,
              stats: emptyStats,
              syncStatus: mmrStats ? "rank-only" : "complete",
              updatedAt: emptyStats.updatedAt,
            });
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
          const verifiedDetails = fetchedDetails.filter(
            (details) =>
              String(details.matchInfo?.seasonId).toLocaleLowerCase("en-US") ===
                season.id.toLocaleLowerCase("en-US") &&
              String(details.matchInfo?.queueID).toLocaleLowerCase("en-US") ===
                "competitive"
          );
          if (verifiedDetails.length === 0) {
            const mmrStats = await loadMmrSeasonStats();
            if (!scope.isCurrent()) return;
            if (mmrStats) {
              const published = resolvePublishedSeasonSnapshot(
                get(),
                selectedOption.id,
                mmrStats,
                archivedSeason?.matches ?? []
              );
              runtime.seasonStatsFailures.delete(resolvedRequestKey);
              set((state) => ({
                ...(selectedOption.isActive
                  ? { seasonStats: published.stats }
                  : {}),
                seasonStatsById: {
                  ...state.seasonStatsById,
                  [selectedOption.id]: published.stats,
                },
                seasonMatchesById: {
                  ...state.seasonMatchesById,
                  [selectedOption.id]: published.matches,
                },
              }));
              void saveArchivedSeasonSafely({
                accountKey: authKey,
                matches: published.matches,
                seasonId: selectedOption.id,
                seasonName: selectedOption.name,
                stats: mmrStats,
                syncStatus: "rank-only",
                updatedAt: mmrStats.updatedAt,
              });
              return;
            }
            throw new Error(
              `Season stats failed: 0/${uniqueMatchIds.length} verified match details loaded.`
            );
          }
          if (verifiedDetails.length < uniqueMatchIds.length && __DEV__) {
            console.warn(
              `[season-stats] partial data: ${verifiedDetails.length}/${uniqueMatchIds.length} verified match details loaded`
            );
          }

          const summarizedStats = summarizeSeasonMatches(
            verifiedDetails,
            user.id,
            season
          );
          const seasonStats: SeasonPerformanceStats =
            verifiedDetails.length < uniqueMatchIds.length
              ? { ...summarizedStats, dataCompleteness: "partial" }
              : summarizedStats;
          const catalog = createMatchAssetCatalog();
          const seasonMatches = detailsList.flatMap((details, index) => {
            if (!details) return [];
            const matchId = uniqueMatchIds[index];
            const update = updateByMatch.get(matchId);
            const sourceStartTime = matchStartById.get(matchId);
            const normalizedStartTime = normalizeProfileMatchStartTime(
              sourceStartTime ?? details.matchInfo?.gameStartMillis ?? 0
            );
            const gameStartTime =
              normalizedStartTime || details.matchInfo?.gameStartMillis || 0;

            if (
              String(details.matchInfo?.seasonId).toLocaleLowerCase("en-US") !==
                season.id.toLocaleLowerCase("en-US") ||
              String(details.matchInfo?.queueID).toLocaleLowerCase("en-US") !==
                "competitive"
            ) {
              return [];
            }

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
          const published = resolvePublishedSeasonSnapshot(
            get(),
            selectedOption.id,
            seasonStats,
            seasonMatches
          );
          runtime.seasonStatsFailures.delete(resolvedRequestKey);
          set((state) => ({
            ...(selectedOption.isActive
              ? { seasonStats: published.stats }
              : {}),
            seasonStatsById: {
              ...state.seasonStatsById,
              [selectedOption.id]: published.stats,
            },
            seasonMatchesById: {
              ...state.seasonMatchesById,
              [selectedOption.id]: published.matches,
            },
          }));
          void saveArchivedSeasonSafely({
            accountKey: authKey,
            matches: published.matches,
            seasonId: selectedOption.id,
            seasonName: selectedOption.name,
            stats: seasonStats,
            syncStatus:
              verifiedDetails.length < uniqueMatchIds.length
                ? "partial"
                : "complete",
            updatedAt: seasonStats.updatedAt,
          });
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
