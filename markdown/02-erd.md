# 02 — Mô hình quan hệ thực thể (ERD)

Đây là **mô hình logic rút gọn**, không phải DDL. Key `accountKey` được chuẩn
hoá từ region và user ID. Một match có thể xuất hiện trong lịch sử của nhiều
người; store hiện tại chỉ sở hữu cache lịch sử của một account tại một thời điểm.

```mermaid
erDiagram
    ACCOUNT ||--o{ SAVED_ACCOUNT : duoc_luu_tren_thiet_bi
    ACCOUNT ||--o| USER_SESSION : active
    ACCOUNT ||--o| PROFILE_CACHE : co_cache
    ACCOUNT ||--o{ HISTORY_RECORD : xem
    ACCOUNT ||--o{ SEASON_STATS : tong_hop
    ACCOUNT ||--o{ MATCH_SEASON_ARCHIVE : luu_theo_account
    ACCOUNT ||--|| ACT_RECORDING_BASELINE : bat_dau_ghi_tu_moc
    SEASON ||--o{ SEASON_STATS : theo_act
    SEASON ||--o{ MATCH_SEASON_ARCHIVE : khoa_theo_act
    SEASON ||--o{ HISTORY_RECORD : gom
    MATCH_SEASON_ARCHIVE ||--o{ HISTORY_RECORD : payload_tom_tat
    MATCH ||--o{ HISTORY_RECORD : tham_chieu
    MATCH ||--o{ MATCH_PLAYER : co
    ACCOUNT ||--o{ MATCH_PLAYER : tham_gia
    PROFILE_CACHE ||--o| LOADOUT : snapshot
    LOADOUT ||--o{ EQUIPPED_ITEM : trang_bi
    ASSET ||--o{ EQUIPPED_ITEM : metadata
    PROFILE_CACHE }o--o{ ASSET : so_huu
    ACCOUNT {
        string accountKey PK
        string userId
        string region
    }
    SAVED_ACCOUNT {
        string id PK
        string region
        string name
        number lastUsedAt
        object protectedCredentials
    }
    USER_SESSION {
        string id
        string region
        object shops
        object balances
        object progress
    }
    PROFILE_CACHE {
        string authKey PK
        number updatedAt
        object componentUpdatedAt
        object competitiveRank
    }
    LOADOUT {
        string Subject
        array Guns
        array Sprays
        object Identity
    }
    EQUIPPED_ITEM {
        string itemId
        string slot
    }
    ASSET {
        string uuid PK
        string displayName
        string displayIcon
    }
    MATCH {
        string matchId PK
        string mapId
        object matchInfo
    }
    MATCH_PLAYER {
        string subject
        string teamId
        object stats
    }
    HISTORY_RECORD {
        string MatchID
        string SeasonID
        object stats
        string result
    }
    SEASON {
        string id PK
        string name
        number startTime
    }
    SEASON_STATS {
        string seasonId
        number recordingStartedAt
        number wins
        number losses
        number draws
        number cancelled
        number unknown
    }
    MATCH_SEASON_ARCHIVE {
        string accountKey PK
        string seasonId PK
        number schemaVersion
        number updatedAt
        string syncStatus
        string payload
    }
    ACT_RECORDING_BASELINE {
        string accountKey PK
        number schemaVersion
        number startedAt
        string startSeasonId
    }
```

`protectedCredentials` và `result` ở đây là thuộc tính **khái niệm**: credential
nằm trong saved-account/session được bảo vệ, còn result lịch sử thực tế nằm
trong `stats.result`. `EQUIPPED_ITEM` là góc nhìn chuẩn hoá từ mảng loadout,
không phải một bảng đang tồn tại. `ACCOUNT` không có bảng riêng.

Trên native, `MATCH_SEASON_ARCHIVE` tương ứng bảng SQLite
`match_season_archives` với primary key kép `(account_key, season_id)`; `payload`
giữ snapshot JSON đã validate. `HISTORY_RECORD` và `SEASON_STATS` trong hình là
các object nằm trong payload, không phải bảng con SQL. Web/test dùng cùng
repository contract nhưng lưu qua `appStorage`.

`ACT_RECORDING_BASELINE` là metadata `appStorage` nhỏ, bất biến theo account.
`startSeasonId` được bind một lần khi Riot content xác định Act active. Stats và
archive trước `startedAt` không được đọc vào UI; row cũ vẫn được giữ vật lý.

Chat giữ friends/messages trong RAM; wishlist là danh sách asset UUID cục bộ,
không gán một quan hệ sở hữu account giả vì store wishlist không chia theo account.

Nguồn: [SavedAccount](../utils/saved-accounts.ts), [match types](../types/match-ui.ts),
[Profile cache](../utils/profile-cache.ts), [chat store](../utils/chat-store.ts),
[wishlist store](../hooks/useWishlistStore.ts),
[match archive](../services/matches/match-archive-core.ts),
[recording baseline](../services/matches/match-recording-core.ts).
