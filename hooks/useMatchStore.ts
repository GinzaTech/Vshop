import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  MatchDetailsData,
  MatchHistoryRecord,
  SeasonPerformanceStats,
} from "~/types/match-ui";
import {
  defaultUser,
  getCompetitiveUpdates,
  getContent,
  matchDetails,
  playerMatchHistory,
} from "~/utils/valorant-api";
import {
  buildMatchHistoryRecord,
  compactRankUpdate,
  createMatchAssetCatalog,
} from "~/utils/match-ui";
import { getNetworkProfile, mapWithConcurrency } from "~/utils/network";
import { appStorage } from "~/utils/storage";

// --- Hằng số cấu hình ---
const MATCH_CACHE_TTL_MS = 30 * 60 * 1000;       // TTL cache match (30 phút — giảm API calls)
const MATCH_HISTORY_LIMIT = 20;                    // Giới hạn Riot API: 20 trận/request
const INITIAL_FETCH_TOTAL = 30;                    // Tổng số trận tải lần đầu (2 requests)
const DELTA_FETCH_LIMIT = 5;                       // Số trận kiểm tra khi delta sync (chỉ lấy mới)
const MATCH_STORE_VERSION = 5;                     // Tăng version → migrate (thêm thống kê theo mùa)
const MAX_DETAIL_CACHE_ENTRIES = 10;               // Memory cache only (không persist)
const CELLULAR_INITIAL_DETAILS = 15;               // Hydrate 15/30 trận đầu trên 4G
const WIFI_INITIAL_DETAILS = 30;                   // Hydrate hết 30 trận trên WiFi
const MATCH_DETAIL_RETRY_DELAY_MS = 600;           // Delay giữa các lần retry khi fetch detail lỗi
const SEASON_STATS_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const SEASON_UPDATES_PAGE_SIZE = 20;
const SEASON_STATS_CALCULATION_VERSION = 7;
const SEASON_DETAIL_REQUEST_DELAY_MS = 1_000;
const KAST_TRADE_WINDOW_MS = 5_000;

// --- Helper: delay promise ---
const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

// --- Tạo auth key từ thông tin user (dùng để phân biệt session) ---
const getMatchAuthKey = (user: typeof defaultUser) =>
  user.region && user.id ? `${user.region}|${user.id}` : "guest";

type ActiveCompetitiveSeason = {
  id: string;
  name: string;
  startTimeMs: number;
  endTimeMs: number;
};

const resolveActiveCompetitiveSeason = (
  seasons: {
    ID: string;
    Name: string;
    Type: "episode" | "act";
    StartTime: string;
    EndTime: string;
    IsActive: boolean;
  }[]
): ActiveCompetitiveSeason | null => {
  const now = Date.now();
  const activeAct =
    seasons.find((season) => season.Type === "act" && season.IsActive) ??
    seasons.find((season) => {
      if (season.Type !== "act") return false;
      const start = Date.parse(season.StartTime);
      const end = Date.parse(season.EndTime);
      return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
    });

  if (!activeAct?.ID) return null;
  return {
    id: activeAct.ID,
    name: activeAct.Name,
    startTimeMs: Date.parse(activeAct.StartTime) || 0,
    endTimeMs: Date.parse(activeAct.EndTime) || 0,
  };
};

const summarizeSeasonMatches = (
  detailsList: (MatchDetailsData | null)[],
  userId: string,
  season: ActiveCompetitiveSeason
): SeasonPerformanceStats => {
  const totals = {
    matchCount: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    score: 0,
    damage: 0,
    roundsPlayed: 0,
    kastRounds: 0,
    kastRoundsPlayed: 0,
    headshots: 0,
    bodyshots: 0,
    legshots: 0,
  };
  const perMatch = {
    kdSum: 0,
    kdCount: 0,
    acsSum: 0,
    acsCount: 0,
    adrSum: 0,
    adrCount: 0,
    headshotPercentSum: 0,
    headshotPercentCount: 0,
  };

  detailsList.forEach((details) => {
    if (
      !details ||
      String(details.matchInfo?.seasonId).toLowerCase() !== season.id.toLowerCase() ||
      String(details.matchInfo?.queueID).toLowerCase() !== "competitive"
    ) {
      return;
    }

    const player = details.players?.find((entry) => entry.subject === userId);
    if (!player?.stats) return;

    const matchKills = Number(player.stats.kills) || 0;
    const matchDeaths = Number(player.stats.deaths) || 0;
    const matchScore = Number(player.stats.score) || 0;
    const matchRoundsPlayed = Number(player.stats.roundsPlayed) || 0;
    let matchDamage = 0;
    let matchHeadshots = 0;
    let matchBodyshots = 0;
    let matchLegshots = 0;

    const playerTeam = details.teams?.find(
      (team) =>
        String(team.teamId).toLowerCase() === String(player.teamId).toLowerCase()
    );
    if (playerTeam?.won) {
      totals.wins += 1;
    } else if (playerTeam) {
      const playerTeamId = String(player.teamId).toLowerCase();
      const opponentRoundsWon = (details.teams ?? []).reduce(
        (highestRoundsWon, team) =>
          String(team.teamId).toLowerCase() === playerTeamId
            ? highestRoundsWon
            : Math.max(highestRoundsWon, Number(team.roundsWon) || 0),
        0
      );
      if (opponentRoundsWon > (Number(playerTeam.roundsWon) || 0)) {
        totals.losses += 1;
      }
    }

    const teammateIds = new Set(
      (details.players ?? []).flatMap((entry) =>
        String(entry.teamId).toLowerCase() ===
        String(player.teamId).toLowerCase()
          ? [entry.subject]
          : []
      )
    );

    (details.roundResults ?? []).forEach((round) => {
      const playerStats = round.playerStats?.find(
        (entry) => entry.subject === userId
      );
      if (!playerStats) return;

      playerStats?.damage?.forEach((damage) => {
        matchDamage += Number(damage.damage) || 0;
        matchHeadshots += Number(damage.headshots) || 0;
        matchBodyshots += Number(damage.bodyshots) || 0;
        matchLegshots += Number(damage.legshots) || 0;
      });

      const roundKills = (round.playerStats ?? []).flatMap(
        (entry) => entry.kills ?? []
      );
      const deathEvent = roundKills.find((kill) => kill.victim === userId);
      const hasKill = (playerStats.kills?.length ?? 0) > 0;
      const roundAssistantIds = new Set(
        roundKills.flatMap((kill) => kill.assistants ?? [])
      );
      const hasAssist = roundAssistantIds.has(userId);
      const survived = !deathEvent;
      const wasTraded = Boolean(
        deathEvent &&
          roundKills.some((kill) => {
            const tradeDelay =
              (Number(kill.roundTime) || 0) -
              (Number(deathEvent.roundTime) || 0);
            return (
              kill.victim === deathEvent.killer &&
              teammateIds.has(kill.killer) &&
              tradeDelay >= 0 &&
              tradeDelay <= KAST_TRADE_WINDOW_MS
            );
          })
      );

      totals.kastRoundsPlayed += 1;
      if (hasKill || hasAssist || survived || wasTraded) {
        totals.kastRounds += 1;
      }
    });

    totals.matchCount += 1;
    totals.kills += matchKills;
    totals.deaths += matchDeaths;
    totals.score += matchScore;
    totals.damage += matchDamage;
    totals.roundsPlayed += matchRoundsPlayed;
    totals.headshots += matchHeadshots;
    totals.bodyshots += matchBodyshots;
    totals.legshots += matchLegshots;

    if (matchDeaths > 0) {
      perMatch.kdSum += matchKills / matchDeaths;
      perMatch.kdCount += 1;
    }
    if (matchRoundsPlayed > 0) {
      perMatch.acsSum += matchScore / matchRoundsPlayed;
      perMatch.acsCount += 1;
      perMatch.adrSum += matchDamage / matchRoundsPlayed;
      perMatch.adrCount += 1;
    }
    const matchHits = matchHeadshots + matchBodyshots + matchLegshots;
    if (matchHits > 0) {
      perMatch.headshotPercentSum += (matchHeadshots / matchHits) * 100;
      perMatch.headshotPercentCount += 1;
    }
  });

  const result = {
    calculationVersion: SEASON_STATS_CALCULATION_VERSION,
    seasonId: season.id,
    seasonName: season.name,
    ...totals,
    headshotPercent:
      perMatch.headshotPercentCount > 0
        ? perMatch.headshotPercentSum / perMatch.headshotPercentCount
        : null,
    kd:
      totals.kills > 0 || totals.deaths > 0
        ? totals.kills / Math.max(1, totals.deaths)
        : null,
    acs:
      totals.roundsPlayed > 0 ? totals.score / totals.roundsPlayed : null,
    adr:
      totals.roundsPlayed > 0 ? totals.damage / totals.roundsPlayed : null,
    kast:
      totals.kastRoundsPlayed > 0
        ? (totals.kastRounds / totals.kastRoundsPlayed) * 100
        : null,
    winRate:
      totals.matchCount > 0 ? (totals.wins / totals.matchCount) * 100 : null,
    updatedAt: Date.now(),
  };
  if (__DEV__) {
    console.log("[season-stats] per-match-average check", {
      kd:
        perMatch.kdCount > 0 ? perMatch.kdSum / perMatch.kdCount : null,
      acs:
        perMatch.acsCount > 0 ? perMatch.acsSum / perMatch.acsCount : null,
      adr:
        perMatch.adrCount > 0 ? perMatch.adrSum / perMatch.adrCount : null,
      headshotPercent:
        perMatch.headshotPercentCount > 0
          ? perMatch.headshotPercentSum / perMatch.headshotPercentCount
          : null,
    });
  }
  return result;
};

// --- Biến module-level để tránh request trùng lặp ---
/** Đang fetch danh sách matches */
let matchesInFlight: { key: string; promise: Promise<void> } | null = null;
/** Đang hydrate thêm matches */
let hydrationInFlight: { key: string; promise: Promise<void> } | null = null;
let seasonStatsInFlight: { key: string; promise: Promise<void> } | null = null;
/** Map chứa các request fetch detail đang bay — tránh fetch cùng matchId nhiều lần */
const detailsInFlight = new Map<
  string,
  Promise<MatchDetailsData | null>
>();
/** Thứ tự LRU của detail cache (dùng để xóa entry cũ nhất khi đầy) */
let detailCacheOrder: string[] = [];

// --- Định nghĩa store quản lý lịch sử trận đấu (Match) ---
// authKey: khóa xác thực session (dạng "region|id" hoặc "guest")
// matches: danh sách các trận đã tải (có thể chưa hydrate đầy đủ stats)
// detailsById: cache chi tiết trận đấu (matchId -> MatchDetailsData)
// loading: đang fetch danh sách matches
// hydrating: đang hydrate (làm giàu) dữ liệu cho các match
// error: thông báo lỗi nếu có
// lastUpdated: thời gian cập nhật cuối cùng
// totalMatches: tổng số trận trên server
// historyEndIndex: index cuối cùng đã tải (dùng cho phân trang)
// fetchMatches(user, force?): tải danh sách match history + competitive updates + hydrate lô đầu
// hydrateNextMatches(user, count?): tải thêm trang match và hydrate chúng
// fetchMatchDetails(user, matchId, force?): fetch chi tiết một trận cụ thể
interface MatchState {
  authKey: string;
  matches: MatchHistoryRecord[];
  detailsById: Record<string, MatchDetailsData>;
  loading: boolean;
  hydrating: boolean;
  error: string | null;
  lastUpdated: number;
  totalMatches: number;
  historyEndIndex: number;
  seasonStats: SeasonPerformanceStats | null;
  seasonStatsLoading: boolean;
  fetchMatches: (user: typeof defaultUser, force?: boolean) => Promise<void>;
  fetchSeasonStats: (
    user: typeof defaultUser,
    force?: boolean
  ) => Promise<void>;
  hydrateNextMatches: (
    user: typeof defaultUser,
    count?: number
  ) => Promise<void>;
  fetchMatchDetails: (
    user: typeof defaultUser,
    matchId: string,
    force?: boolean
  ) => Promise<MatchDetailsData | null>;
}

// --- Kiểu dữ liệu được persist (lưu xuống storage) ---
// Chỉ lưu các trường cần thiết: authKey, matches, lastUpdated, totalMatches, historyEndIndex
type PersistedMatchState = Pick<
  MatchState,
  | "authKey"
  | "matches"
  | "lastUpdated"
  | "totalMatches"
  | "historyEndIndex"
  | "seasonStats"
>;

/**
 * Hydrate một lô match: fetch detail cho từng match và build record hoàn chỉnh.
 * @param matches - danh sách match cần hydrate
 * @param user - thông tin user (dùng để fetch detail)
 * @param concurrency - số lượng request đồng thời tối đa
 * @param fetchDetails - hàm fetch detail cho một matchId
 * @returns Promise<MatchHistoryRecord[]> danh sách match đã được hydrate
 */
async function hydrateMatchBatch(
  matches: MatchHistoryRecord[],
  user: typeof defaultUser,
  concurrency: number,
  fetchDetails: (matchId: string) => Promise<MatchDetailsData | null>
) {
  const catalog = createMatchAssetCatalog();
  return mapWithConcurrency(matches, concurrency, async (match) => {
    const details = await fetchDetails(match.MatchID);
    return buildMatchHistoryRecord(match, details, user.id, catalog);
  });
}

/**
 * Thêm chi tiết trận đấu vào memory cache, quản lý LRU (xóa entry cũ nhất khi vượt quá MAX_DETAIL_CACHE_ENTRIES).
 * @param detailsById - object cache hiện tại
 * @param matchId - ID trận cần thêm
 * @param details - dữ liệu chi tiết trận
 * @returns object cache mới sau khi thêm / xóa entry cũ
 */
function addDetailToMemoryCache(
  detailsById: Record<string, MatchDetailsData>,
  matchId: string,
  details: MatchDetailsData
) {
  // Đưa matchId lên cuối (mới nhất)
  detailCacheOrder = detailCacheOrder.filter((id) => id !== matchId);
  detailCacheOrder.push(matchId);

  const nextDetails = { ...detailsById, [matchId]: details };
  // Xóa entry cũ nhất cho đến khi cache nằm trong giới hạn
  while (detailCacheOrder.length > MAX_DETAIL_CACHE_ENTRIES) {
    const oldestId = detailCacheOrder.shift();
    if (oldestId) delete nextDetails[oldestId];
  }
  return nextDetails;
}

// --- Tạo Zustand store với persist middleware ---
// Lưu: authKey, matches, lastUpdated, totalMatches, historyEndIndex
// Version: MATCH_STORE_VERSION (dùng để migrate khi schema thay đổi)
export const useMatchStore = create<MatchState>()(
  persist(
    (set, get) => ({
      /** Khóa xác thực session hiện tại — "guest" nếu chưa đăng nhập */
      authKey: "guest",
      /** Danh sách match history (có thể thiếu stats nếu chưa hydrate) */
      matches: [],
      /** Cache chi tiết trận đấu trong memory (matchId -> details) */
      detailsById: {},
      /** Đang tải danh sách matches từ server */
      loading: false,
      /** Đang hydrate (làm giàu dữ liệu) các match */
      hydrating: false,
      /** Thông báo lỗi nếu có */
      error: null,
      /** Thời gian (ms) cập nhật cuối cùng */
      lastUpdated: 0,
      /** Tổng số trận trên server */
      totalMatches: 0,
      /** Index cuối cùng đã tải (dùng để phân trang) */
      historyEndIndex: 0,
      seasonStats: null,
      seasonStatsLoading: false,

      /**
       * Fetch chi tiết một trận đấu (có cache + deduplication + retry).
       * @param user - thông tin user
       * @param matchId - ID trận cần fetch
       * @param force - true để bỏ qua cache
       * @returns Promise<MatchDetailsData | null>
       */
      fetchMatchDetails: async (user, matchId, force = false) => {
        // Validate input — thiếu token hoặc matchId thì trả về null
        if (
          !user.accessToken ||
          !user.entitlementsToken ||
          !user.region ||
          !matchId
        ) {
          return null;
        }

        // Nếu đã có trong cache và không force thì trả về cache
        const cached = get().detailsById[matchId];
        if (cached && !force) return cached;

        // Deduplication: nếu đang có request cho matchId này thì trả về promise đó
        const authKey = getMatchAuthKey(user);
        const detailKey = `${authKey}|${matchId}`;
        const existingPromise = detailsInFlight.get(detailKey);
        if (existingPromise) return existingPromise;

        // Tạo request fetch detail với retry tối đa 2 lần (nếu lỗi server >= 500)
        const request = (async () => {
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              const details = await matchDetails(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                matchId
              );
              // Chỉ lưu vào cache nếu auth key còn hợp lệ
              const currentAuthKey = get().authKey;
              if (currentAuthKey === "guest" || currentAuthKey === authKey) {
                set((state) => ({
                  authKey,
                  detailsById: addDetailToMemoryCache(
                    state.detailsById,
                    matchId,
                    details
                  ),
                }));
              }
              return details;
            } catch (error) {
              // Retry nếu lần đầu và lỗi >= 500 hoặc không xác định
              const status = Number(
                (error as { response?: { status?: number } })?.response?.status
              );
              if (__DEV__) {
                console.warn("[match-details] request failed", {
                  matchId,
                  attempt: attempt + 1,
                  status: Number.isFinite(status) ? status : null,
                  code: (error as { code?: string })?.code ?? null,
                  message:
                    error instanceof Error ? error.message : String(error),
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
          detailsInFlight.delete(detailKey);
        });
        detailsInFlight.set(detailKey, trackedRequest);
        return trackedRequest;
      },

      /**
       * Hydrate các match tiếp theo: tải thêm match history và làm giàu stats.
       * @param user - thông tin user
       * @param count - số lượng match cần hydrate (mặc định: 4 nếu cellular, 8 nếu wifi)
       */
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
        // Deduplication: nếu đang hydrate thì trả về promise hiện tại
        if (hydrationInFlight?.key === authKey) {
          return hydrationInFlight.promise;
        }

        const request = (async () => {
          // Kiểm tra kết nối mạng
          const network = await getNetworkProfile();
          if (!network.isConnected) return;

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
              const page = await playerMatchHistory(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                {
                  startIndex,
                  endIndex: Math.min(
                    startIndex + MATCH_HISTORY_LIMIT,
                    state.totalMatches
                  ),
                }
              );
              if (get().authKey !== authKey) return;

              const knownIds = new Set(
                get().matches.map((match) => match.MatchID)
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
              (matchId) => get().fetchMatchDetails(user, matchId)
            );
            // Kiểm tra auth key còn hợp lệ trước khi cập nhật
            if (get().authKey !== authKey) return;

            // Thay thế các match cũ bằng phiên bản đã hydrate
            const hydratedById = new Map(
              hydrated.map((match) => [match.MatchID, match])
            );
            set((state) => ({
              matches: state.matches.map(
                (match) => hydratedById.get(match.MatchID) || match
              ),
            }));
          } catch (error) {
            if (__DEV__) {
              console.warn("Failed to load more match history", error);
            }
          } finally {
            // Reset hydrating nếu auth key vẫn hợp lệ
            if (get().authKey === authKey) set({ hydrating: false });
          }
        })().finally(() => {
          if (hydrationInFlight?.key === authKey) hydrationInFlight = null;
        });

        hydrationInFlight = { key: authKey, promise: request };
        return request;
      },

      fetchSeasonStats: async (user, force = false) => {
        if (
          !user.accessToken ||
          !user.entitlementsToken ||
          !user.id ||
          !user.region
        ) {
          return;
        }

        const authKey = getMatchAuthKey(user);
        const state = get();
        const cachedStats =
          state.authKey === authKey ? state.seasonStats : null;
        if (
          !force &&
          cachedStats &&
          cachedStats.calculationVersion === SEASON_STATS_CALCULATION_VERSION &&
          Date.now() - cachedStats.updatedAt < SEASON_STATS_CACHE_TTL_MS
        ) {
          return;
        }
        if (seasonStatsInFlight?.key === authKey) {
          return seasonStatsInFlight.promise;
        }

        if (state.authKey !== authKey) {
          detailCacheOrder = [];
          set({
            authKey,
            matches: [],
            detailsById: {},
            error: null,
            lastUpdated: 0,
            totalMatches: 0,
            historyEndIndex: 0,
            hydrating: false,
            seasonStats: null,
            seasonStatsLoading: true,
          });
        } else {
          set({ seasonStatsLoading: true });
        }

        const request = (async () => {
          try {
            const content = await getContent(
              user.accessToken,
              user.entitlementsToken,
              user.region
            );
            if (get().authKey !== authKey) return;

            const season = resolveActiveCompetitiveSeason(content?.Seasons ?? []);
            if (!season) {
              throw new Error("Could not resolve the active competitive act.");
            }

            const seasonMatchIds: string[] = [];
            let startIndex = 0;
            let pageCount = 0;

            // Match history is retention-limited and can omit older matches from
            // the current Act. Competitive updates keeps the Act's complete
            // match ID list, so use it as the source of truth for season stats.
            while (pageCount < 30) {
              const page = await getCompetitiveUpdates(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                {
                  startIndex,
                  endIndex: startIndex + SEASON_UPDATES_PAGE_SIZE,
                  queue: "competitive",
                }
              );
              if (get().authKey !== authKey) return;
              if (!page) {
                throw new Error("Could not load competitive updates.");
              }

              const updates = page.Matches ?? [];
              updates.forEach((match) => {
                if (
                  String(match.SeasonID).toLowerCase() ===
                    season.id.toLowerCase() &&
                  match.MatchID
                ) {
                  seasonMatchIds.push(match.MatchID);
                }
              });

              const reachedPreviousSeason = updates.some(
                (match) =>
                  match.SeasonID &&
                  String(match.SeasonID).toLowerCase() !==
                    season.id.toLowerCase()
              );
              if (
                updates.length === 0 ||
                updates.length < SEASON_UPDATES_PAGE_SIZE ||
                reachedPreviousSeason
              ) {
                break;
              }
              startIndex += updates.length;
              pageCount += 1;
            }

            const uniqueMatchIds = Array.from(new Set(seasonMatchIds));
            if (uniqueMatchIds.length === 0) {
              throw new Error("No competitive matches found for the active Act.");
            }
            const network = await getNetworkProfile();
            if (!network.isConnected || get().authKey !== authKey) return;
            const detailsList = await mapWithConcurrency(
              uniqueMatchIds,
              1,
              async (matchId) => {
                for (let attempt = 0; attempt < 4; attempt += 1) {
                  const details = await get().fetchMatchDetails(
                    user,
                    matchId,
                    attempt > 0
                  );
                  if (details) {
                    await wait(SEASON_DETAIL_REQUEST_DELAY_MS);
                    return details;
                  }
                  await wait(2_000 * (attempt + 1));
                }
                return null;
              }
            );
            if (get().authKey !== authKey) return;
            const missingDetails = detailsList.reduce(
              (count, details) => count + (details ? 0 : 1),
              0
            );
            if (missingDetails > 0) {
              throw new Error(
                `Season stats are missing ${missingDetails}/${uniqueMatchIds.length} match details.`
              );
            }

            const seasonStats = summarizeSeasonMatches(
              detailsList,
              user.id,
              season
            );
            if (__DEV__) {
              console.log("[season-stats] computed", seasonStats);
            }
            set({ seasonStats });
          } catch (error) {
            if (__DEV__) {
              console.warn("[season-stats] fetch failed", error);
            }
          } finally {
            if (get().authKey === authKey) {
              set({ seasonStatsLoading: false });
            }
          }
        })().finally(() => {
          if (seasonStatsInFlight?.key === authKey) {
            seasonStatsInFlight = null;
          }
        });

        seasonStatsInFlight = { key: authKey, promise: request };
        return request;
      },

      /**
       * Tải danh sách match history (kèm competitive updates) và hydrate lô đầu tiên.
       * Nếu đã có cache và chưa hết TTL thì bỏ qua (trừ khi force = true).
       * @param user - thông tin user
       * @param force - true để bỏ qua cache
       */
      fetchMatches: async (user, force = false) => {
        // Validate input — thiếu thông tin user thì thoát
        if (
          !user.accessToken ||
          !user.entitlementsToken ||
          !user.id ||
          !user.region
        ) {
          return;
        }

        // Nếu cache còn hạn và không force thì bỏ qua
        const authKey = getMatchAuthKey(user);
        const state = get();
        const isSameSession = state.authKey === authKey;
        if (
          !force &&
          isSameSession &&
          state.lastUpdated > 0 &&
          Date.now() - state.lastUpdated < MATCH_CACHE_TTL_MS
        ) {
          return;
        }

        // Nếu đổi user, reset toàn bộ store
        if (!isSameSession) {
          detailCacheOrder = [];
          set({
            authKey,
            matches: [],
            detailsById: {},
            error: null,
            lastUpdated: 0,
            totalMatches: 0,
            historyEndIndex: 0,
            hydrating: false,
            seasonStats: null,
            seasonStatsLoading: false,
          });
        }

        // --- DELTA SYNC: cache stale nhưng đã có data → chỉ fetch trận mới ---
        if (!force && isSameSession && state.matches.length > 0) {
          if (matchesInFlight?.key === authKey) return matchesInFlight.promise;

          const deltaRequest = (async () => {
            try {
              const deltaPage = await playerMatchHistory(
                user.accessToken,
                user.entitlementsToken,
                user.region,
                user.id,
                { startIndex: 0, endIndex: DELTA_FETCH_LIMIT - 1 }
              );
              if (get().authKey !== authKey || !deltaPage?.History) {
                set({ lastUpdated: Date.now() });
                return;
              }

              const knownIds = new Set(get().matches.map((m) => m.MatchID));
              const newRawMatches = deltaPage.History.filter(
                (m) => !knownIds.has(m.MatchID)
              );

              if (newRawMatches.length === 0) {
                // Không có trận mới → chỉ update timestamp
                set({ lastUpdated: Date.now() });
                return;
              }

              // Hydrate từng trận mới (1 lần/viết, không batch)
              const catalog = createMatchAssetCatalog();
              for (const raw of newRawMatches) {
                const details = await get().fetchMatchDetails(user, raw.MatchID);
                if (get().authKey !== authKey) return;
                const record = buildMatchHistoryRecord(
                  {
                    MatchID: raw.MatchID,
                    GameStartTime: raw.GameStartTime,
                    QueueID: raw.QueueID,
                  },
                  details,
                  user.id,
                  catalog
                );
                set((current) => ({
                  matches: [...current.matches, record].sort(
                    (a, b) => b.GameStartTime - a.GameStartTime
                  ),
                  lastUpdated: Date.now(),
                  totalMatches: Math.max(
                    current.totalMatches,
                    Number(deltaPage.Total) || current.totalMatches
                  ),
                }));
              }
              if (__DEV__) {
                console.log(`[matchStore] delta sync: +${newRawMatches.length} new matches`);
              }
            } catch (error) {
              if (__DEV__) console.warn("[matchStore] delta sync failed", error);
              set({ lastUpdated: Date.now() });
            } finally {
              if (matchesInFlight?.key === authKey) matchesInFlight = null;
            }
          })();

          matchesInFlight = { key: authKey, promise: deltaRequest };
          return deltaRequest;
        }
        // Deduplication: nếu đang fetch thì trả về promise hiện tại
        if (matchesInFlight?.key === authKey) {
          return matchesInFlight.promise;
        }

        const request = (async () => {
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
              if (__DEV__) console.warn("playerMatchHistory failed", params, error);
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

            // Kiểm tra auth key sau khi fetch
            if (get().authKey !== authKey) return;
            if (!historyData) {
              set({ error: "Could not load match data." });
              return;
            }
            if (!historyData?.History?.length) {
              // Không có match nào -> reset store
              set({
                matches: [],
                loading: false,
                lastUpdated: Date.now(),
                totalMatches: 0,
                historyEndIndex: 0,
              });
              return;
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
            if (!network.isConnected || get().authKey !== authKey) return;
            const initialCount = network.isCellular
              ? CELLULAR_INITIAL_DETAILS
              : WIFI_INITIAL_DETAILS;
            const hydrated = await hydrateMatchBatch(
              baseMatches.slice(0, initialCount),
              user,
              network.requestConcurrency,
              (matchId) => get().fetchMatchDetails(user, matchId)
            );
            if (get().authKey !== authKey) return;

            // Thay thế base matches bằng phiên bản đã hydrate
            const hydratedById = new Map(
              hydrated.map((match) => [match.MatchID, match])
            );
            set({
              matches: baseMatches.map(
                (match) => hydratedById.get(match.MatchID) || match
              ),
            });
          } catch (error) {
            if (__DEV__) console.error("Failed to fetch matches globally", error);
            if (get().authKey === authKey) {
              set({ error: "Could not load match data." });
            }
          } finally {
            // Reset loading + giải phóng in-flight tracker
            if (get().authKey === authKey) set({ loading: false });
            if (matchesInFlight?.key === authKey) matchesInFlight = null;
          }
        })();

        // Track request in-flight để deduplicate
        matchesInFlight = { key: authKey, promise: request };
        return request;
      },
    }),
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
        };
        return migrated as unknown as MatchState;
      },
      /**
       * Chỉ lưu các trường cần thiết xuống storage (bỏ detailsById, loading state, etc.)
       */
      partialize: (state) => ({
        authKey: state.authKey,
        matches: state.matches,
        lastUpdated: state.lastUpdated,
        totalMatches: state.totalMatches,
        historyEndIndex: state.historyEndIndex,
        seasonStats: state.seasonStats,
      }),
    }
  )
);
