// ===== match-ui.ts – Kiểu dữ liệu UI cho màn hình trận đấu & lịch sử =====
// Nhóm: enum hướng đối chiếu (team/side/kết quả), bản ghi lịch sử,
// thống kê season, viewModel chi tiết trận và catalog asset phục vụ render.

/** MatchTeam – Đội trong trận: A (đội mình) hoặc B (đội đối thủ). */
export type MatchTeam = "A" | "B";
/** MatchSide – Bên chơi trong round: tấn công (attack) hoặc phòng ngự (defense). */
export type MatchSide = "attack" | "defense";
/** MatchResult – Kết quả trận từ góc nhìn người dùng: thắng/thua/hòa. */
export type MatchResult = "win" | "loss" | "draw" | "cancelled" | "unknown";

/**
 * MatchPlayerIdentity – Định danh người chơi với 2 biến thể key:
 * camelCase (từ match details) và PascalCase (từ pregame/current game).
 */
export type MatchPlayerIdentity = {
  subject?: string;
  Subject?: string;
  gameName?: string;
  GameName?: string;
  tagLine?: string;
  TagLine?: string;
};

/** MatchDetailsData – MatchDetailsResponse mở rộng thêm danh sách identity dễ tra cứu. */
export type MatchDetailsData = MatchDetailsResponse & {
  playerIdentities?: MatchPlayerIdentity[];
  PlayerIdentities?: MatchPlayerIdentity[];
};

/** RankUpdate – Biến động rank sau 1 trận (tier/RR trước–sau, penalty, AFK). */
export type RankUpdate = {
  TierAfterUpdate?: number;
  RankedRatingEarned?: number;
  RankedRatingAfterUpdate?: number;
  RankedRatingBeforeUpdate?: number;
  RankedRatingPerformanceBonus?: number;
  AFKPenalty?: number;
  CompetitiveMovement?: string;
};

/**
 * MatchHistoryStats – Thống kê tổng hợp 1 trận cho màn lịch sử:
 * KDA, ACS/ADR, headshot, agent/map/rank, RR và kết quả round.
 */
export type MatchHistoryStats = {
  kda: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  acs: number;
  adr: number;
  kd: number;
  kdRatio: string;
  headshotPercent: number | null;
  headshotPct: string | null;
  placement: number;
  roundsPlayed: number;
  won: boolean;
  /** Explicit result; absent only in records created before result normalization. */
  result?: MatchResult;
  roundsWon: number;
  roundsLost: number;
  agentIcon: string | null;
  agentId: string | null;
  agentName: string;
  agentPortrait: string | null;
  mapId: string | null;
  mapName: string;
  mapImage: string | null;
  gameMode: string;
  /** Act chứa trận; optional để tương thích cache được tạo trước schema này. */
  seasonId?: string | null;
  rankTier: number | null;
  rankName: string | null;
  rankIcon: string | null;
  rrEarned: number | null;
  rrAfter: number | null;
  rrBefore: number | null;
  rrPerformanceBonus: number | null;
  rrAfkPenalty: number | null;
  competitiveMovement: string | null;
};

/** MatchHistoryRecord – Một bản ghi trong match history Riot (MatchID + stats tuỳ chọn). */
export type MatchHistoryRecord = {
  MatchID: string;
  GameStartTime: number;
  QueueID: string;
  rankUpdate?: RankUpdate | null;
  stats?: MatchHistoryStats | null;
};

/**
 * SeasonPerformanceStats – Thống kê tích luỹ theo season (act): số trận,
 * tổng kill/death/score/damage, KAST, headshot, KD/ACS/ADR/winrate trung bình.
 * calculationVersion dùng để vô hiệu cache khi công thức tính đổi.
 */
export type SeasonPerformanceStats = {
  calculationVersion: number;
  dataCompleteness?: "full" | "partial" | "rank-only";
  seasonId: string;
  seasonName: string;
  matchCount: number;
  wins: number;
  losses: number;
  draws?: number;
  cancelled?: number;
  unknown?: number;
  kills: number;
  deaths: number;
  score: number;
  damage: number;
  roundsPlayed: number;
  kastRounds: number;
  kastRoundsPlayed: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  headshotPercent: number | null;
  kd: number | null;
  acs: number | null;
  adr: number | null;
  kast: number | null;
  winRate: number | null;
  /** Local recording policy identity; missing only on legacy/full-Act caches. */
  recordingStartedAt?: number;
  updatedAt: number;
};

/** MatchHistoryItem – Item đã chuẩn hoá cho UI lịch sử trận (đã merge agent/map/rank). */
export type MatchHistoryItem = {
  id: string;
  startedAt: string;
  result: MatchResult;
  teamScore: number;
  opponentScore: number;
  mode: string;
  mapName: string;
  mapImageUrl?: string;
  agent: {
    id: string;
    name: string;
    iconUrl?: string;
  };
  rank?: {
    tier: number;
    name: string;
    iconUrl?: string;
  };
  placement: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  headshotPercent?: number;
  adr: number;
  acs: number;
  trs?: number;
  trsTierIconUrl?: string;
  rrAfter?: number;
  rrChange?: number;
};

/** DailyMatchSummary – Tóm tắt trận theo ngày (số trận, trung bình KD/ADR/ACS). */
export type DailyMatchSummary = {
  dateKey: string;
  dateLabel: string;
  matchCount: number;
  averageKD?: number;
  averageADR?: number;
  averageACS?: number;
};

/** MatchHistoryGroup – Nhóm lịch sử theo ngày: summary + danh sách trận. */
export type MatchHistoryGroup = {
  dateKey: string;
  summary: DailyMatchSummary;
  matches: MatchHistoryItem[];
};

/** MatchPlayerRef – Tham chiếu gọn một người chơi (dùng cho danh sách phụ). */
export type MatchPlayerRef = {
  playerId: string;
  playerName: string;
  team: MatchTeam;
  agentName: string;
  agentIconUrl?: string;
  isCurrentUser: boolean;
};

/** PlayerPerformanceSummary – Tổng kết hiệu suất 1 người chơi trong trận. */
export type PlayerPerformanceSummary = {
  playerId: string;
  playerName: string;
  agentName: string;
  agentFullImageUrl?: string;
  rankName: string;
  rankIconUrl?: string;
  averageScore: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  adr: number;
};

/** SidePerformance – Số liệu KDA thuần cho một bên (attack/defense). */
export type SidePerformance = {
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
};

/** PlayerSideStats – Hiệu suất chia theo hai bên chơi của cùng một người. */
export type PlayerSideStats = {
  defense: SidePerformance;
  attack: SidePerformance;
};

/** OpponentBreakdown – Đối đầu 1-1 với từng đối thủ: kill/death + damage trao đổi. */
export type OpponentBreakdown = {
  opponentPlayerId: string;
  opponentAgentName: string;
  opponentAgentIconUrl?: string;
  killsAgainst: number;
  deathsAgainst: number;
  damageDealt: number;
  damageTaken: number;
};

/** WeaponPerformance – Hiệu suất theo vũ khí: số kill và tổng damage gây ra. */
export type WeaponPerformance = {
  weaponId: string;
  weaponName: string;
  weaponImageUrl?: string;
  kills: number;
  damage: number;
};

/** RoundEventType – Loại sự kiện trong round: kill/plant/defuse/kỹ năng/kết thúc. */
export type RoundEventType =
  | "kill"
  | "plant"
  | "defuse"
  | "ability"
  | "round_end";

/** RoundEvent – Một sự kiện trên timeline round (ai giết ai, bằng vũ khí nào...). */
export type RoundEvent = {
  id: string;
  timestampSeconds: number;
  type: RoundEventType;
  actorPlayerId?: string;
  targetPlayerId?: string;
  assistantPlayerIds?: string[];
  weaponId?: string;
  weaponName?: string;
  weaponImageUrl?: string;
  distanceMeters?: number;
  headshot?: boolean;
};

/** RoundOutcome – Cách một round kết thúc (tiêu diệt, nổ/gỡ spike, hết giờ, hàng). */
export type RoundOutcome =
  | "elimination"
  | "spike_detonated"
  | "spike_defused"
  | "time_expired"
  | "surrender"
  | "unknown";

/**
 * RoundDetail – Toàn bộ dữ liệu một round: đội thắng, bên chơi của team A,
 * kết thúc, thời lượng, kinh tế hai đội và các sự kiện theo timeline.
 */
export type RoundDetail = {
  roundNumber: number;
  winningTeam: MatchTeam;
  sideForTeamA: MatchSide;
  outcome: RoundOutcome;
  durationSeconds: number;
  teamAEconomy: number;
  teamBEconomy: number;
  teamAAverageLoadout?: number;
  teamBAverageLoadout?: number;
  teamAAverageCredits?: number;
  teamBAverageCredits?: number;
  events: RoundEvent[];
};

/** EconomyPoint – Điểm kinh tế theo round: loadout, tiêu xài, chênh lệch và kết quả. */
export type EconomyPoint = {
  roundNumber: number;
  teamAEconomy: number;
  teamBEconomy: number;
  teamASpent: number;
  teamBSpent: number;
  difference: number;
  winningTeam: MatchTeam;
  outcome: RoundOutcome;
};

/** ScoreboardPlayer – Một hàng scoreboard: agent, rank, KDA/ACS/ADR/DDA/KAST... */
export type ScoreboardPlayer = {
  playerId: string;
  playerName: string;
  team: MatchTeam;
  agent: {
    name: string;
    iconUrl?: string;
  };
  rank?: {
    name: string;
    iconUrl?: string;
  };
  trs?: number;
  trsIconUrl?: string;
  acs: number;
  kills: number;
  deaths: number;
  assists: number;
  plusMinus: number;
  kd: number;
  adr: number;
  dda?: number;
  kast?: number;
  headshotPercent?: number;
  firstKills?: number;
  firstDeaths?: number;
  multiKills?: number;
  economyRating?: number;
  isCurrentUser?: boolean;
};

/** PlayerMatchPerformance – Gói phân tích người chơi: summary + sideStats + đối đầu + vũ khí. */
export type PlayerMatchPerformance = {
  summary: PlayerPerformanceSummary;
  sideStats: PlayerSideStats;
  opponents: OpponentBreakdown[];
  weapons: WeaponPerformance[];
};

/**
 * MatchDetailViewModel – ViewModel hoàn chỉnh cho màn chi tiết trận:
 * thông tin trận, scoreboard, danh sách người chơi, kinh tế, rounds
 * và performance theo từng người chơi (key = playerId).
 */
export type MatchDetailViewModel = {
  match: {
    id: string;
    mode: string;
    mapName: string;
    mapImageUrl?: string;
    startedAt: string;
    durationSeconds: number;
    teamAScore: number;
    teamBScore: number;
    winningTeam: MatchTeam | null;
    /** Result from currentPlayerId's perspective; optional for legacy mock data. */
    result?: MatchResult;
  };
  players: ScoreboardPlayer[];
  playerRefs: MatchPlayerRef[];
  currentPlayerId: string;
  economy: EconomyPoint[];
  rounds: RoundDetail[];
  playerPerformance: Record<string, PlayerMatchPerformance>;
};

/** ScoreboardColumn – Cột có thể hiển thị/sắp xếp trên scoreboard. */
export type ScoreboardColumn =
  | "acs"
  | "kills"
  | "deaths"
  | "assists"
  | "plusMinus"
  | "kd"
  | "adr"
  | "dda"
  | "kast"
  | "headshotPercent"
  | "firstKills"
  | "firstDeaths"
  | "multiKills"
  | "economyRating"
  | "rank"
  | "trs";

/** SortDirection – Hướng sắp xếp: tăng/giảm hoặc null (chưa chọn cột). */
export type SortDirection = "asc" | "desc" | null;

/** ScoreboardSortState – Trạng thái sort hiện tại của bảng scoreboard. */
export type ScoreboardSortState = {
  column: ScoreboardColumn | null;
  direction: SortDirection;
};

/** MatchAgentAsset – Asset agent (icon, chân dung) dùng để render nhanh. */
export type MatchAgentAsset = {
  uuid: string;
  displayName: string;
  displayIcon?: string;
  displayIconSmall?: string;
  bustPortrait?: string;
  fullPortrait?: string;
  fullPortraitV2?: string;
};

/** MatchMapAsset – Asset map (splash, listViewIcon) tra theo mapUrl. */
export type MatchMapAsset = {
  uuid?: string;
  mapUrl?: string;
  displayName?: string;
  splash?: string;
  listViewIcon?: string;
};

/** MatchTierAsset – Asset một bậc rank (tên, icon nhỏ/lớn, tam giác rank). */
export type MatchTierAsset = {
  tier?: number;
  tierName?: string;
  smallIcon?: string;
  largeIcon?: string;
  rankTriangleDownIcon?: string;
};

/** MatchTierSetAsset – Một bộ (set) các bậc rank theo season. */
export type MatchTierSetAsset = {
  tiers?: MatchTierAsset[];
};

/** ValorantWeaponAsset – Vũ khí rút gọn dùng cho catalog tra cứu theo uuid. */
export type ValorantWeaponAsset = {
  uuid: string;
  displayName: string;
  displayIcon?: string;
  category?: string;
};

/**
 * MatchAssetCatalog – Catalog asset đã index sẵn theo key tra cứu:
 * agent theo uuid, map theo mapUrl, rank theo số tier, vũ khí theo uuid.
 */
export type MatchAssetCatalog = {
  agentsById: ReadonlyMap<string, MatchAgentAsset>;
  mapsByUrl: ReadonlyMap<string, MatchMapAsset>;
  tiersByNumber: ReadonlyMap<number, MatchTierAsset>;
  weaponsById: ReadonlyMap<string, ValorantWeaponAsset>;
};
