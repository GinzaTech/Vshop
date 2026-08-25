export type MatchTeam = "A" | "B";
export type MatchSide = "attack" | "defense";
export type MatchResult = "win" | "loss" | "draw";

export type MatchPlayerIdentity = {
  subject?: string;
  Subject?: string;
  gameName?: string;
  GameName?: string;
  tagLine?: string;
  TagLine?: string;
};

export type MatchDetailsData = MatchDetailsResponse & {
  playerIdentities?: MatchPlayerIdentity[];
  PlayerIdentities?: MatchPlayerIdentity[];
};

export type RankUpdate = {
  TierAfterUpdate?: number;
  RankedRatingEarned?: number;
  RankedRatingAfterUpdate?: number;
  RankedRatingBeforeUpdate?: number;
  RankedRatingPerformanceBonus?: number;
  AFKPenalty?: number;
  CompetitiveMovement?: string;
};

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

export type MatchHistoryRecord = {
  MatchID: string;
  GameStartTime: number;
  QueueID: string;
  rankUpdate?: RankUpdate | null;
  stats?: MatchHistoryStats | null;
};

export type SeasonPerformanceStats = {
  calculationVersion: number;
  seasonId: string;
  seasonName: string;
  matchCount: number;
  wins: number;
  losses: number;
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
  updatedAt: number;
};

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

export type DailyMatchSummary = {
  dateKey: string;
  dateLabel: string;
  matchCount: number;
  averageKD?: number;
  averageADR?: number;
  averageACS?: number;
};

export type MatchHistoryGroup = {
  dateKey: string;
  summary: DailyMatchSummary;
  matches: MatchHistoryItem[];
};

export type MatchPlayerRef = {
  playerId: string;
  playerName: string;
  team: MatchTeam;
  agentName: string;
  agentIconUrl?: string;
  isCurrentUser: boolean;
};

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

export type SidePerformance = {
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
};

export type PlayerSideStats = {
  defense: SidePerformance;
  attack: SidePerformance;
};

export type OpponentBreakdown = {
  opponentPlayerId: string;
  opponentAgentName: string;
  opponentAgentIconUrl?: string;
  killsAgainst: number;
  deathsAgainst: number;
  damageDealt: number;
  damageTaken: number;
};

export type WeaponPerformance = {
  weaponId: string;
  weaponName: string;
  weaponImageUrl?: string;
  kills: number;
  damage: number;
};

export type RoundEventType =
  | "kill"
  | "plant"
  | "defuse"
  | "ability"
  | "round_end";

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

export type RoundOutcome =
  | "elimination"
  | "spike_detonated"
  | "spike_defused"
  | "time_expired"
  | "surrender"
  | "unknown";

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

export type PlayerMatchPerformance = {
  summary: PlayerPerformanceSummary;
  sideStats: PlayerSideStats;
  opponents: OpponentBreakdown[];
  weapons: WeaponPerformance[];
};

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
    winningTeam: MatchTeam;
  };
  players: ScoreboardPlayer[];
  playerRefs: MatchPlayerRef[];
  currentPlayerId: string;
  economy: EconomyPoint[];
  rounds: RoundDetail[];
  playerPerformance: Record<string, PlayerMatchPerformance>;
};

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

export type SortDirection = "asc" | "desc" | null;

export type ScoreboardSortState = {
  column: ScoreboardColumn | null;
  direction: SortDirection;
};

export type MatchAgentAsset = {
  uuid: string;
  displayName: string;
  displayIcon?: string;
  displayIconSmall?: string;
  bustPortrait?: string;
  fullPortrait?: string;
  fullPortraitV2?: string;
};

export type MatchMapAsset = {
  uuid?: string;
  mapUrl?: string;
  displayName?: string;
  splash?: string;
  listViewIcon?: string;
};

export type MatchTierAsset = {
  tier?: number;
  tierName?: string;
  smallIcon?: string;
  largeIcon?: string;
  rankTriangleDownIcon?: string;
};

export type MatchTierSetAsset = {
  tiers?: MatchTierAsset[];
};

export type ValorantWeaponAsset = {
  uuid: string;
  displayName: string;
  displayIcon?: string;
  category?: string;
};

export type MatchAssetCatalog = {
  agentsById: ReadonlyMap<string, MatchAgentAsset>;
  mapsByUrl: ReadonlyMap<string, MatchMapAsset>;
  tiersByNumber: ReadonlyMap<number, MatchTierAsset>;
  weaponsById: ReadonlyMap<string, ValorantWeaponAsset>;
};
