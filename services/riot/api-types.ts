// Export interface phản hồi loadout (trang bị) của người chơi từ API Riot
export interface PlayerLoadoutResponse {
  SourceApiVersion?: "v2" | "v3";   // Phiên bản API (v2 cũ hoặc v3 mới)
  Subject: string;                    // UUID của người chơi
  Version: number;                    // Phiên bản loadout
  Guns: {                            // Danh sách vũ khí và skin đã trang bị
    ID: string;                       // UUID vũ khí
    CharmInstanceID?: string;         // UUID instance của charm (nếu có)
    CharmID?: string;                 // UUID charm
    CharmLevelID?: string;            // UUID cấp độ charm
    SkinID: string;                   // UUID skin đã chọn
    SkinLevelID: string;              // UUID cấp độ skin
    ChromaID: string;                 // UUID chroma (màu sắc)
    Attachments: unknown[];           // Các đính kèm khác
  }[];
  Sprays: {                          // Danh sách spray đã trang bị
    EquipSlotID: string;              // ID slot trang bị
    SprayID: string;                  // UUID spray
    SprayLevelID: string | null;      // UUID cấp độ spray hoặc null
  }[];
  ActiveExpressions?: PlayerLoadoutExpression[];  // Biểu cảm đang kích hoạt (v3)
  DynamicOptions?: Record<string, unknown>;        // Tùy chọn động (v3)
  Identity: {                        // Thông tin định danh người chơi
    PlayerCardID: string;             // UUID thẻ người chơi
    PlayerTitleID: string;            // UUID danh hiệu
    AccountLevel: number;             // Cấp độ tài khoản
    PreferredLevelBorderID: string;   // UUID viền cấp độ ưa thích
    HideAccountLevel: boolean;        // Ẩn cấp độ tài khoản?
  };
  Incognito: boolean;                 // Chế độ ẩn danh?
}

// Export interface biểu cảm (expression) của người chơi
export interface PlayerLoadoutExpression {
  TypeID: string;    // Loại biểu cảm
  AssetID: string;   // UUID asset biểu cảm
}

// Export interface phản hồi danh sách item đã sở hữu (entitlements)
export interface OwnedItemsResponse {
  Subject?: string;                    // UUID người chơi
  ItemTypeID?: string;                 // Loại item
  Entitlements?: {                    // Danh sách entitlement (cách cũ)
    TypeID?: string;
    ItemID: string;
    InstanceID?: string;
  }[];
  EntitlementsByTypes?: {             // Danh sách entitlement theo loại (cách mới)
    ItemTypeID: string;
    Entitlements: {
      TypeID: string;
      ItemID: string;
      InstanceID?: string;
    }[];
  }[];
}

export type CompetitiveSeasonInfo = {
  Rank?: number;
  CompetitiveTier?: number;
  RankedRating?: number;
  NumberOfWins?: number;
  NumberOfWinsWithPlacements?: number;
  NumberOfGames?: number;
  NumberOfLosses?: number;
  NumberOfDraws?: number;
  WinsByTier?: Record<string, number> | null;
  SeasonHighestCompetitiveTier?: number;
};

export type CompetitiveQueueSkill = {
  CompetitiveTier?: number;
  HighestCompetitiveTier?: number;
  SeasonalInfoBySeasonID?: Record<string, CompetitiveSeasonInfo>;
};

// Export interface phản hồi thông tin MMR (rank) competitive
export interface CompetitiveMMRResponse {
  Subject?: string;                    // UUID người chơi
  QueueSkills?: Record<string, CompetitiveQueueSkill | undefined> & {
    competitive?: CompetitiveQueueSkill;
  };
  LatestCompetitiveUpdate?: {         // Cập nhật competitive gần nhất
    SeasonID?: string;
    TierAfterUpdate?: number;
    TierBeforeUpdate?: number;
    RankedRatingAfterUpdate?: number;
    MatchStartTime?: number;
  };
}

// Export interface phản hồi session Valorant (thông tin phiên chơi)
export interface ValorantSessionResponse {
  subject?: string;                    // UUID người chơi
  clientVersion?: string;              // Phiên bản Riot client
  clientPlatformInfo?: {               // Thông tin nền tảng
    platformType?: string;
    platformOS?: string;
    platformOSVersion?: string;
    platformChipset?: string;
    platformDevice?: string;
  };
  [key: string]: unknown;                  // Các trường khác
}

// Export interface phản hồi trận đấu đang diễn ra (current game)
export interface CurrentGameMatchResponse {
  MatchID: string;
  Version: number;
  State: string;
  MapID: string;
  ModeID: string;
  ProvisioningFlow: string;
  GamePodID: string;
  AllMUCName: string;
  TeamMUCName: string;
  TeamVoiceID: string;
  TeamMatchToken: string;
  IsReconnectable: boolean;
  MatchmakingData?: {
    QueueID?: string;
  };
  ConnectionDetails?: {
    GameServerHosts: string[];
    GameServerHost: string;
    GameServerPort: number;
    GameClientHash: number;
    PlayerKey: string;
  };
  Players: {
    Subject: string;
    TeamID: string;
    CharacterID: string;
    PlayerIdentity?: {
      Subject: string;
      PlayerCardID: string;
      PlayerTitleID: string;
      AccountLevel: number;
      PreferredLevelBorderID: string;
      Incognito: boolean;
      HideAccountLevel: boolean;
    };
    SeasonalBadgeInfo?: {
      SeasonID: string;
      NumberOfWins: number;
      Rank: number;
      LeaderboardRank: number;
    };
    IsCoach: boolean;
    IsAssociated: boolean;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

// Export interface phản hồi party (nhóm)
export interface PartyResponse {
  ID: string;                          // UUID party
  State?: string;
  MUCName?: string;
  InviteCode?: string;
  CustomGameData?: {
    Settings?: {
      Mode?: string;
    };
    MaxPartySize?: number;
  };
  Members: {                          // Danh sách thành viên
    Subject: string;
    IsReady: boolean;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}
