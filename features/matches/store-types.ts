import type { StoreApi } from "zustand";
import type { MatchDetailsData, MatchHistoryRecord, SeasonPerformanceStats } from "~/types/match-ui";
import type { defaultUser } from "~/utils/valorant-api";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";

export interface MatchState {
  resetMatchCache: () => void;
  authKey: string;
  matches: MatchHistoryRecord[];
  detailsById: Record<string, MatchDetailsData>;
  loading: boolean;
  hydrating: boolean;
  error: string | null;
  lastUpdated: number;
  /** Tổng số trận trên server */
  totalMatches: number;
  /** Index cuối cùng đã tải (dùng để phân trang) */
  historyEndIndex: number;
  /** Mốc local bắt đầu ghi Act cho authKey hiện tại (0 = chưa migrate). */
  recordingStartedAt: number;
  /** Act đang active khi tạo mốc; null cho tới khi Riot content resolve. */
  recordingStartSeasonId: string | null;
  /** Thống kê hiệu suất act competitive đang chạy (null = chưa tính/không có). */
  seasonStats: SeasonPerformanceStats | null;
  /** Thống kê đã tải theo Act; seasonStats phía trên vẫn luôn là Act hiện tại. */
  seasonStatsById: Record<string, SeasonPerformanceStats>;
  /** Match đã hydrate theo Act để bảng Đặc vụ/Bản đồ đổi đúng cùng mùa. */
  seasonMatchesById: Record<string, MatchHistoryRecord[]>;
  /** Toàn bộ Act đã bắt đầu, mới nhất trước. */
  seasonOptions: LeaderboardSeasonOption[];
  /** Đang crawl/tính season stats (spinner riêng cho khu vực này). */
  seasonStatsLoading: boolean;
  /**
   * Tải match history. Trả về true nếu dữ liệu dùng được (fetch OK, cache còn
   * fresh, hoặc danh sách rỗng hợp lệ); false nếu fetch thất bại để caller
   * (vd syncAllData) không stamp "đã sync" lên lần fetch lỗi.
   */
  fetchMatches: (user: typeof defaultUser, force?: boolean) => Promise<boolean>;
  fetchSeasonStats: (
    user: typeof defaultUser,
    force?: boolean,
    seasonId?: string
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
  /**
   * Ghi đè MỘT PHẦN dữ liệu detail (vd: playerIdentities resolve xong) vào
   * memory cache — QA qua LRU đúng chuẩn (fix M7).
   * Nếu entry gốc đã bị LRU evict thì BỎ patch (không tạo entry rác thiếu
   * players/teams gây crash downstream); nếu entry tồn tại thì merge + bump
   * vị trí LRU.
   * @param matchId - ID trận cần merge
   * @param patch - Trường dữ liệu cần ghi đè
   */
  mergeMatchDetails: (
    matchId: string,
    patch: Partial<MatchDetailsData>
  ) => void;
}

// --- Kiểu dữ liệu được persist (lưu xuống storage) ---
// Chỉ lưu các trường cần thiết: authKey, matches, lastUpdated, totalMatches, historyEndIndex
export type PersistedMatchState = Pick<
  MatchState,
  | "authKey"
  | "matches"
  | "lastUpdated"
  | "totalMatches"
  | "historyEndIndex"
  | "recordingStartedAt"
  | "recordingStartSeasonId"
  | "seasonStats"
  | "seasonStatsById"
  | "seasonMatchesById"
  | "seasonOptions"
>;


export type MatchCacheSnapshot = Pick<MatchState,
  "authKey" | "matches" | "detailsById" | "error" | "lastUpdated" |
  "totalMatches" | "historyEndIndex" | "seasonStats" | "seasonStatsById" |
  "seasonMatchesById" | "seasonOptions" | "recordingStartedAt" |
  "recordingStartSeasonId"
>;
export type MatchStoreAccess = Pick<StoreApi<MatchState>, "setState" | "getState">;

export function emptyMatchCache(): MatchCacheSnapshot {
  return { authKey: "guest", matches: [], detailsById: {}, error: null,
    lastUpdated: 0, totalMatches: 0, historyEndIndex: 0,
    recordingStartedAt: 0, recordingStartSeasonId: null, seasonStats: null,
    seasonStatsById: {}, seasonMatchesById: {}, seasonOptions: [] };
}
