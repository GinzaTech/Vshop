// ---------------------------------------------------------------------------
// Storefront
// ---------------------------------------------------------------------------
type StorefrontResponse = {
  FeaturedBundle: {
    Bundle: BundleSchema;
    Bundles: BundleSchema[];
    BundleRemainingDurationInSeconds: number;
  };
  SkinsPanelLayout: {
    SingleItemOffers: string[];
    SingleItemStoreOffers: OfferSchema[];
    SingleItemOffersRemainingDurationInSeconds: number;
  };
  UpgradeCurrencyStore: {
    UpgradeCurrencyOffers: {
      OfferID: string;
      StorefrontItemID: string;
      Offer: OfferSchema;
      DiscountedPercent: number;
    }[];
  };
  AccessoryStore: {
    AccessoryStoreOffers: {
      Offer: OfferSchema;
      ContractID: string;
    }[];
    AccessoryStoreRemainingDurationInSeconds: number;
    StorefrontID: string;
  };
  BonusStore?: {
    BonusStoreOffers: {
      BonusOfferID: string;
      Offer: OfferSchema;
      DiscountPercent: number;
      DiscountCosts: Record<string, number>;
      IsSeen: boolean;
    }[];
    BonusStoreRemainingDurationInSeconds: number;
  };
};

type BundleSchema = {
  ID: string;
  DataAssetID: string;
  CurrencyID: string;
  Items: {
    Item: { ItemTypeID: string; ItemID: string; Amount: number };
    BasePrice: number;
    CurrencyID: string;
    DiscountPercent: number;
    DiscountedPrice: number;
    IsPromoItem: boolean;
  }[];
  ItemOffers: {
    BundleItemOfferID: string;
    Offer: OfferSchema;
    DiscountPercent: number;
    DiscountedCost: Record<string, number>;
  }[] | null;
  TotalBaseCost: Record<string, number> | null;
  TotalDiscountedCost: Record<string, number> | null;
  TotalDiscountPercent: number;
  DurationRemainingInSeconds: number;
  WholesaleOnly: boolean;
};

type OfferSchema = {
  OfferID: string;
  IsDirectPurchase: boolean;
  StartDate: string;
  Cost: Record<string, number>;
  Rewards: { ItemTypeID: string; ItemID: string; Quantity: number }[];
};

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
type WalletResponse = {
  Balances: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------
type EntitlementResponse = {
  entitlements_token: string;
};

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------
type PricesResponse = {
  Offers: {
    OfferID: string;
    IsDirectPurchase: boolean;
    StartDate: string;
    Cost: Record<string, number>;
    Rewards: { ItemTypeID: string; ItemID: string; Quantity: number }[];
  }[];
};

// ---------------------------------------------------------------------------
// Name Service
// ---------------------------------------------------------------------------
type NameServiceResponse = {
  DisplayName: string;
  Subject: string;
  GameName: string;
  TagLine: string;
}[];

// ---------------------------------------------------------------------------
// Account XP
// ---------------------------------------------------------------------------
type AccountXPResponse = {
  Version: number;
  Subject: string;
  Progress: { Level: number; XP: number };
  History: {
    ID: string;
    MatchStart: string;
    StartProgress: { Level: number; XP: number };
    EndProgress: { Level: number; XP: number };
    XPDelta: number;
    XPSources: { ID: "time-played" | "match-win" | "first-win-of-the-day"; Amount: number }[];
    XPMultipliers: unknown[];
  }[];
  LastTimeGrantedFirstWin: string;
  NextTimeFirstWinAvailable: string;
};

// ---------------------------------------------------------------------------
// Player Loadout
// ---------------------------------------------------------------------------
interface PlayerLoadoutResponse {
  Subject: string;
  Version: number;
  Guns: {
    ID: string;
    CharmInstanceID?: string;
    CharmID?: string;
    CharmLevelID?: string;
    SkinID: string;
    SkinLevelID: string;
    ChromaID: string;
    Attachments: unknown[];
  }[];
  Sprays: {
    EquipSlotID: string;
    SprayID: string;
    SprayLevelID: string | null;
  }[];
  Identity: {
    PlayerCardID: string;
    PlayerTitleID: string;
    AccountLevel: number;
    PreferredLevelBorderID: string;
    HideAccountLevel: boolean;
  };
  Incognito: boolean;
}

// ---------------------------------------------------------------------------
// Pre-Game Player
// ---------------------------------------------------------------------------
interface PreGamePlayerResponse {
  Subject: string;
  MatchID: string;
  Version: number;
}

// ---------------------------------------------------------------------------
// Lock Character
// ---------------------------------------------------------------------------
interface LockCharacterResponse {
  ID: string;
  Version: number;
  Teams: {
    TeamID: "Blue" | "Red" | string;
    Players: {
      Subject: string;
      CharacterID: string;
      CharacterSelectionState: "" | "selected" | "locked";
      PregamePlayerState: "joined";
      CompetitiveTier: number;
      PlayerIdentity: {
        Subject: string;
        PlayerCardID: string;
        PlayerTitleID: string;
        AccountLevel: number;
        PreferredLevelBorderID: string | "";
        Incognito: boolean;
        HideAccountLevel: boolean;
      };
      SeasonalBadgeInfo: {
        SeasonID: string | "";
        NumberOfWins: number;
        WinsByTier: null;
        Rank: number;
        LeaderboardRank: number;
      };
      IsCaptain: boolean;
    }[];
  }[];
  AllyTeam: any;
  EnemyTeam: any;
  ObserverSubjects: unknown[];
  MatchCoaches: unknown[];
  EnemyTeamSize: number;
  EnemyTeamLockCount: number;
  PregameState: "character_select_active" | "provisioned";
  LastUpdated: string;
  MapID: string;
  MapSelectPool: unknown[];
  BannedMapIDs: unknown[];
  CastedVotes?: unknown;
  MapSelectSteps: unknown[];
  MapSelectStep: number;
  Team1: "Blue" | "Red" | string;
  GamePodID: string;
  Mode: string;
  VoiceSessionID: string;
  MUCName: string;
  TeamMatchToken: string;
  QueueID: string | "";
  ProvisioningFlowID: "Matchmaking" | "CustomGame";
  IsRanked: boolean;
  PhaseTimeRemainingNS: number;
  StepTimeRemainingNS: number;
  altModesFlagADA: boolean;
  TournamentMetadata: null;
  RosterMetadata: null;
}

// ---------------------------------------------------------------------------
// Match History
// ---------------------------------------------------------------------------
type MatchHistoryResponse = {
  Subject: string;
  BeginIndex: number;
  EndIndex: number;
  Total: number;
  History: {
    MatchID: string;
    GameStartTime: string;
    QueueID: string;
  }[];
};

// ---------------------------------------------------------------------------
// Match Details
// ---------------------------------------------------------------------------
type MatchDetailsResponse = {
  matchInfo: {
    matchId: string;
    mapId: string;
    gamePodId: string;
    gameLoopZone: string;
    gameServerAddress: string;
    gameVersion: string;
    gameLengthMillis: number | null;
    gameStartMillis: number;
    provisioningFlowID: "Matchmaking" | "CustomGame";
    isCompleted: boolean;
    customGameName: string;
    forcePostProcessing: boolean;
    queueID: string;
    gameMode: string;
    isRanked: boolean;
    isMatchSampled: boolean;
    seasonId: string;
    completionState: "Surrendered" | "Completed" | "VoteDraw" | "";
    platformType: string;
    premierMatchInfo: Record<string, unknown>;
    partyRRPenalties?: Record<string, number>;
    shouldMatchDisablePenalties: boolean;
  };
  players: {
    subject: string;
    gameName: string;
    tagLine: string;
    platformInfo: { platformType: string; platformOS: string; platformOSVersion: string; platformChipset: string };
    teamId: string;
    partyId: string;
    characterId: string;
    stats: {
      score: number;
      roundsPlayed: number;
      kills: number;
      deaths: number;
      assists: number;
      playtimeMillis: number;
      abilityCasts?: { grenadeCasts: number; ability1Casts: number; ability2Casts: number; ultimateCasts: number } | null;
    } | null;
    roundDamage: { round: number; receiver: string; damage: number }[] | null;
    competitiveTier: number;
    isObserver: boolean;
    playerCard: string;
    playerTitle: string;
    preferredLevelBorder?: string;
    accountLevel: number;
    sessionPlaytimeMinutes?: number | null;
    xpModifications?: { Value: number; ID: string }[];
    behaviorFactors?: {
      afkRounds: number;
      collisions?: number;
      commsRatingRecovery: number;
      damageParticipationOutgoing: number;
      friendlyFireIncoming?: number;
      friendlyFireOutgoing?: number;
      mouseMovement?: number;
      stayedInSpawnRounds?: number;
    };
    newPlayerExperienceDetails?: Record<string, unknown>;
  }[];
  bots: unknown[];
  coaches: { subject: string; teamId: "Blue" | "Red" }[];
  teams: {
    teamId: string;
    won: boolean;
    roundsPlayed: number;
    roundsWon: number;
    numPoints: number;
  }[] | null;
  roundResults: {
    roundNum: number;
    roundResult: string;
    roundCeremony: string;
    winningTeam: string;
    bombPlanter?: string;
    bombDefuser?: string;
    plantRoundTime?: number;
    plantPlayerLocations: { subject: string; viewRadians: number; location: { x: number; y: number } }[] | null;
    plantLocation: { x: number; y: number };
    plantSite: string;
    defuseRoundTime?: number;
    defusePlayerLocations: { subject: string; viewRadians: number; location: { x: number; y: number } }[] | null;
    defuseLocation: { x: number; y: number };
    playerStats: {
      subject: string;
      kills: {
        gameTime: number;
        roundTime: number;
        killer: string;
        victim: string;
        victimLocation: { x: number; y: number };
        assistants: string[];
        playerLocations: { subject: string; viewRadians: number; location: { x: number; y: number } }[];
        finishingDamage: { damageType: string; damageItem: string; isSecondaryFireMode: boolean };
      }[];
      damage: { receiver: string; damage: number; legshots: number; bodyshots: number; headshots: number }[];
      score: number;
      economy: { loadoutValue: number; weapon: string; armor: string; remaining: number; spent: number };
      ability: { grenadeEffects: null; ability1Effects: null; ability2Effects: null; ultimateEffects: null };
      wasAfk: boolean;
      wasPenalized: boolean;
      stayedInSpawn: boolean;
    }[];
    roundResultCode: string;
    playerEconomies: { subject: string; loadoutValue: number; weapon: string; armor: string; remaining: number; spent: number }[] | null;
    playerScores: { subject: string; score: number }[] | null;
  }[] | null;
  kills: ({
    round: number;
    gameTime: number;
    roundTime: number;
    killer: string;
    victim: string;
    victimLocation: { x: number; y: number };
    assistants: string[];
    playerLocations: { subject: string; viewRadians: number; location: { x: number; y: number } }[];
    finishingDamage: { damageType: string; damageItem: string; isSecondaryFireMode: boolean };
  })[] | null;
};

// ---------------------------------------------------------------------------
// Competitive Updates
// ---------------------------------------------------------------------------
type CompetitiveUpdatesResponse = {
  Version: number;
  Subject: string;
  Matches: {
    MatchID: string;
    MapID: string;
    SeasonID: string;
    MatchStartTime: string;
    TierAfterUpdate: number;
    TierBeforeUpdate: number;
    RankedRatingAfterUpdate: number;
    RankedRatingBeforeUpdate: number;
    RankedRatingEarned: number;
    RankedRatingPerformanceBonus: number;
    CompetitiveMovement: string;
    AFKPenalty: number;
  }[];
};

// ---------------------------------------------------------------------------
// Competitive MMR
// ---------------------------------------------------------------------------
type CompetitiveMMRResponse = {
  Version: number;
  Subject: string;
  NewPlayerExperienceFinished: boolean;
  QueueSkills?: Record<string, {
    TotalGamesNeededForRating: number;
    TotalGamesNeededForLeaderboard: number;
    CurrentSeasonGamesNeededForRating: number;
    SeasonalInfoBySeasonID?: Record<string, {
      SeasonID: string;
      NumberOfWins: number;
      NumberOfWinsWithPlacements: number;
      NumberOfGames: number;
      Rank: number;
      CapstoneWins: number;
      LeaderboardRank: number;
      CompetitiveTier: number;
      RankedRating: number;
      WinsByTier: Record<string, number> | null;
      GamesNeededForRating: number;
      TotalWinsNeededForRank: number;
    }>;
  }>;
  LatestCompetitiveUpdate?: {
    MatchID: string;
    MapID: string;
    SeasonID: string;
    MatchStartTime: string;
    TierAfterUpdate: number;
    TierBeforeUpdate: number;
    RankedRatingAfterUpdate: number;
    RankedRatingBeforeUpdate: number;
    RankedRatingEarned: number;
    RankedRatingPerformanceBonus: number;
    CompetitiveMovement: string;
    AFKPenalty: number;
  };
  IsLeaderboardAnonymized: boolean;
  IsActRankBadgeHidden: boolean;
};

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------
type ContractsResponse = {
  Version: number;
  Subject: string;
  Contracts: {
    ContractDefinitionID: string;
    ContractProgression: {
      TotalProgressionEarned: number;
      TotalProgressionEarnedVersion: number;
      HighestRewardedLevel: Record<string, { Amount: number; Version: number }>;
    };
    ProgressionLevelReached: number;
    ProgressionTowardsNextLevel: number;
  }[];
  ProcessedMatches: {
    ID: string;
    StartTime: string;
    XPGrants: {
      GamePlayed: number;
      GameWon: number;
      RoundPlayed: number;
      RoundWon: number;
      Missions: Record<string, unknown>;
      Modifier: { Value: number; BaseMultiplierValue: number; Modifiers: { Value: number; Name: string; BaseOnly: boolean }[] };
      NumAFKRounds: number;
    } | null;
    RewardGrants: Record<string, unknown> | null;
    MissionDeltas: Record<string, { ID: string; Objectives: Record<string, number>; ObjectiveDeltas: Record<string, { ID: string; ProgressBefore: number; ProgressAfter: number }> }> | null;
    ContractDeltas: Record<string, { ID: string; TotalXPBefore: number; TotalXPAfter: number }> | null;
    CouldProgressMissions: boolean;
  }[];
  ActiveSpecialContract: string;
  Missions: {
    ID: string;
    Objectives: Record<string, number>;
    Complete: boolean;
    ExpirationTime: string;
  }[];
  MissionMetadata: {
    NPECompleted: boolean;
    WeeklyCheckpoint: string;
    WeeklyRefillTime: string;
  };
};

// ---------------------------------------------------------------------------
// Fetch Content
// ---------------------------------------------------------------------------
type ContentResponse = {
  DisabledIDs: unknown[];
  Seasons: { ID: string; Name: string; Type: "episode" | "act"; StartTime: string; EndTime: string; IsActive: boolean }[];
  Events: { ID: string; Name: string; StartTime: string; EndTime: string; IsActive: boolean }[];
};

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
type LeaderboardResponse = {
  Deployment: string;
  QueueID: string;
  SeasonID: string;
  Players: {
    PlayerCardID: string;
    TitleID: string;
    IsBanned: boolean;
    IsAnonymized: boolean;
    puuid: string;
    gameName: string;
    tagLine: string;
    leaderboardRank: number;
    rankedRating: number;
    numberOfWins: number;
    competitiveTier: number;
  }[];
  totalPlayers: number;
  immortalStartingPage: number;
  immortalStartingIndex: number;
  topTierRRThreshold: number;
  tierDetails: Record<string, { rankedRatingThreshold: number; startingPage: number; startingIndex: number }>;
  startIndex: number;
  query: string;
};

// ---------------------------------------------------------------------------
// Item Upgrades
// ---------------------------------------------------------------------------
type ItemUpgradesResponse = {
  Definitions: {
    ID: string;
    Item: { ItemTypeID: string; ItemID: string };
    RequiredEntitlement: { ItemTypeID: string; ItemID: string };
    ProgressionSchedule: {
      Name: string;
      ProgressionCurrencyID: string;
      ProgressionDeltaPerLevel: number[] | null;
    };
    RewardSchedule: {
      ID: string;
      Name: string;
      Prerequisites: null;
      RewardsPerLevel: {
        EntitlementRewards: { ItemTypeID: string; ItemID: string; Amount: number }[];
        WalletRewards: null;
        CounterRewards: null;
      }[] | null;
    };
    Sidegrades: {
      SidegradeID: string;
      Options: {
        OptionID: string;
        Cost: { WalletCosts: { CurrencyID: string; AmountToDeduct: number }[] };
        Rewards: { ItemTypeID: string; ItemID: string; Amount: number }[];
      }[];
      Prerequisites: { RequiredEntitlements: { ItemTypeID: string; ItemID: string }[] };
    }[] | null;
  }[];
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
type ConfigResponse = {
  LastApplication: string;
  Collapsed: Record<string, string | boolean | number>;
};

// ---------------------------------------------------------------------------
// Penalties
// ---------------------------------------------------------------------------
type PenaltiesResponse = {
  Subject: string;
  Penalties: unknown[];
  Version: number;
};

// ---------------------------------------------------------------------------
// Friends (local)
// ---------------------------------------------------------------------------
type FriendsResponse = {
  friends: {
    activePlatform: string | null;
    displayGroup: string;
    game_name: string;
    game_tag: string;
    group: string;
    last_online_ts: string | null;
    name: string;
    note: string;
    pid: string;
    puuid: string;
    region: string;
  }[];
};

// ---------------------------------------------------------------------------
// Presence (local)
// ---------------------------------------------------------------------------
type PresenceResponse = {
  presences: {
    actor: unknown | null;
    basic: string;
    details: unknown | null;
    game_name: string;
    game_tag: string;
    location: unknown | null;
    msg: unknown | null;
    name: string;
    patchline: unknown | null;
    pid: string;
    platform: unknown | null;
    private: string | null;
    privateJwt: unknown | null;
    product: "valorant" | "league_of_legends";
    puuid: string;
    region: string;
    resource: string;
    state: "mobile" | "dnd" | "away" | "chat";
    summary: string;
    time: string;
  }[];
};

// ---------------------------------------------------------------------------
// Valorant Presence (decoded from base64 private field)
// ---------------------------------------------------------------------------
type ValorantPresence = {
  isValid: boolean;
  sessionLoopState: string;
  partyOwnerSessionLoopState: string;
  customGameName: string;
  customGameTeam: string;
  partyOwnerMatchMap: string;
  partyOwnerMatchCurrentTeam: string;
  partyOwnerMatchScoreAllyTeam: number;
  partyOwnerMatchScoreEnemyTeam: number;
  partyOwnerProvisioningFlow: string;
  matchMap: string;
  partyId: string;
  isPartyOwner: boolean;
  partyState: string;
  partyAccessibility: "OPEN" | "CLOSED";
  maxPartySize: number;
  queueId: string;
  partyLFM: boolean;
  partyClientVersion: string;
  partySize: number;
  tournamentId: string;
  rosterId: string;
  partyVersion: string;
  queueEntryTime: string;
  playerCardId: string;
  playerTitleId: string;
  preferredLevelBorderId: string;
  accountLevel: number;
  competitiveTier: number;
  leaderboardPosition: number;
  isIdle: boolean;
};

// ---------------------------------------------------------------------------
// Sessions (local)
// ---------------------------------------------------------------------------
type SessionsResponse = Record<string, {
  exitCode: number;
  exitReason: null;
  isInternal: boolean;
  launchConfiguration: { arguments: string[]; executable: string; locale: string | null; voiceLocale: null; workingDirectory: string };
  patchlineFullName: "VALORANT" | "riot_client";
  patchlineId: "" | "live" | "pbe";
  phase: string;
  productId: "valorant" | "riot_client";
  version: string;
}>;

// ---------------------------------------------------------------------------
// Auth / Player Info
// ---------------------------------------------------------------------------
type PlayerInfoResponse = {
  country: string;
  sub: string;
  email_verified: boolean;
  player_plocale: unknown | null;
  country_at: string | null;
  pw: { cng_at: string; reset: boolean; must_reset: boolean };
  phone_number_verified: boolean;
  account_verified: boolean;
  ppid: unknown | null;
  federated_identity_providers: string[];
  player_locale: string | null;
  acct: { type: number; state: string; adm: boolean; game_name: string; tag_line: string; created_at: string };
  age: number;
  jti: string;
  affinity: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Riot Geo
// ---------------------------------------------------------------------------
type RiotGeoResponse = {
  token: string;
  affinities: { pbe: string; live: string };
};

// ---------------------------------------------------------------------------
// PAS Token
// ---------------------------------------------------------------------------
type PASTokenResponse = string;

// ---------------------------------------------------------------------------
// Riot Client Config
// ---------------------------------------------------------------------------
type RiotClientConfigResponse = {
  "chat.affinities"?: Record<string, string>;
  "chat.affinity_domains"?: Record<string, string>;
  "chat.port"?: number;
} & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Pre-Game Loadouts
// ---------------------------------------------------------------------------
type PregameLoadoutsResponse = {
  Loadouts: {
    Subject: string;
    Version: number;
    Guns: {
      ID: string;
      CharmInstanceID?: string;
      CharmID?: string;
      CharmLevelID?: string;
      SkinID: string;
      SkinLevelID: string;
      ChromaID: string;
      Attachments: unknown[];
    }[];
    Sprays: { EquipSlotID: string; SprayID: string; SprayLevelID: string | null }[];
    Identity: { PlayerCardID: string; PlayerTitleID: string; AccountLevel: number; PreferredLevelBorderID: string; HideAccountLevel: boolean };
    Incognito: boolean;
  }[];
  LoadoutsValid: boolean;
};

// ---------------------------------------------------------------------------
// Current Game Loadouts
// ---------------------------------------------------------------------------
type CurrentGameLoadoutsResponse = {
  Loadouts: {
    CharacterID: string;
    Loadout: {
      Subject: string;
      Version: number;
      Guns: {
        ID: string;
        CharmInstanceID?: string;
        CharmID?: string;
        CharmLevelID?: string;
        SkinID: string;
        SkinLevelID: string;
        ChromaID: string;
        Attachments: unknown[];
      }[];
      Sprays: { EquipSlotID: string; SprayID: string; SprayLevelID: string | null }[];
      Identity: { PlayerCardID: string; PlayerTitleID: string; AccountLevel: number; PreferredLevelBorderID: string; HideAccountLevel: boolean };
      Incognito: boolean;
    };
  }[];
};

// ---------------------------------------------------------------------------
// Party
// ---------------------------------------------------------------------------
type PartyResponse = {
  ID: string;
  MUCName: string;
  VoiceRoomID: string;
  Version: number;
  ClientVersion: string;
  Members: {
    Subject: string;
    CompetitiveTier: number;
    PlayerIdentity: {
      Subject: string;
      PlayerCardID: string;
      PlayerTitleID: string;
      AccountLevel: number;
      PreferredLevelBorderID: string;
      Incognito: boolean;
      HideAccountLevel: boolean;
    };
    SeasonalBadgeInfo: null;
    IsOwner?: boolean;
    QueueEligibleRemainingAccountLevels: number;
    Pings: { Ping: number; GamePodID: string }[];
    IsReady: boolean;
    IsModerator: boolean;
    UseBroadcastHUD: boolean;
    PlatformType: string;
  }[];
  State: string;
  PreviousState: string;
  StateTransitionReason: string;
  Accessibility: "OPEN" | "CLOSED";
  CustomGameData: Record<string, unknown>;
  MatchmakingData: { QueueID: string; PreferredGamePods: string[]; SkillDisparityRRPenalty: number };
  Invites: null;
  Requests: unknown[];
  QueueEntryTime: string;
  ErrorNotification: { ErrorType: string; ErroredPlayers: unknown[] | null };
  RestrictedSeconds: number;
  EligibleQueues: string[];
  QueueIneligibilities: string[];
  CheatData: { GamePodOverride: string; ForcePostGameProcessing: boolean };
  XPBonuses: unknown[];
  InviteCode: string;
};

type PartyChatTokenResponse = {
  Token: string;
  Room: string;
};

// ---------------------------------------------------------------------------
// Current Game Match
// ---------------------------------------------------------------------------
type CurrentGameMatchResponse = {
  MatchID: string;
  Version: number;
  State: string;
  MapID: string;
  ModeID: string;
  ProvisioningFlowID: string;
  GamePodID: string;
  AllMUCs: string[];
  TeamMUCs: { Team: string; Members: string[] }[];
  TeamVoiceIDs: { TeamID: string; VoiceID: string }[];
  MatchCurrentLoop: { Loop: string; PhaseDurationSecs: number; PhaseTimeRemainingNS: number };
  Players: {
    Subject: string;
    TeamID: string;
    CharacterID: string;
    PlayerIdentity: {
      Subject: string;
      PlayerCardID: string;
      PlayerTitleID: string;
      AccountLevel: number;
      PreferredLevelBorderID: string;
      Incognito: boolean;
      HideAccountLevel: boolean;
    };
    SeasonalBadgeInfo: {
      SeasonID: string;
      NumberOfWins: number;
      WinsByTier: null;
      Rank: number;
      LeaderboardRank: number;
    };
    IsCoach: boolean;
    IsAssociated: boolean;
  }[];
  AllyTeam: { TeamID: string; Players: string[] };
  EnemyTeam: { TeamID: string; Players: string[] };
  ObserverSubjects: string[];
  MatchCoaches: unknown[];
  TeamSize: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Owned Items
// ---------------------------------------------------------------------------
type OwnedItemsResponse = {
  Subject?: string;
  ItemTypeID?: string;
  Entitlements?: { TypeID?: string; ItemID: string; InstanceID?: string }[];
  EntitlementsByTypes?: {
    ItemTypeID: string;
    Entitlements: { TypeID: string; ItemID: string; InstanceID?: string }[];
  }[];
};

// ---------------------------------------------------------------------------
// Auth Request / MFA
// ---------------------------------------------------------------------------
type AuthSuccessResponse = {
  type: "success";
  success: { login_token: string; redirect_url: string; is_console_link_session: boolean; auth_method: string; puuid: string };
  country: string;
  platform: string;
};

type AuthMultifactorResponse = {
  type: "multifactor";
  multifactor: { method: string; methods: string[]; email: string; mode: string; auth_method: string };
  country: string;
  platform: string;
  error?: string;
};
