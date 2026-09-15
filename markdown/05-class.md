# 05 — Sơ đồ lớp/interface

Mô hình rút gọn các contract thật. Zustand store và module function không
được hiểu là class có constructor hay inheritance tại runtime.

```mermaid
classDiagram
    class AppStorage {
        <<interface>>
        +getItem(key)
        +setItem(key, value)
        +removeItem(key)
    }
    class AccountState {
        <<store>>
        +SavedAccount[] accounts
        +string activeAccountId
        +saveAccount(user)
        +activateAccount(id)
        +clearAccounts()
    }
    class MatchState {
        <<store>>
        +string authKey
        +MatchHistoryRecord[] matches
        +fetchMatches(user, force)
        +fetchMatchDetails(user, id, force)
        +fetchSeasonStats(user, force, seasonId)
        +resetMatchCache()
    }
    class ProfileCacheState {
        <<store>>
        +Map cacheByAuth
        +setProfileCache(cache)
        +resetProfileCache()
    }
    class ProfileWarmCache {
        <<interface>>
        +string authKey
        +number updatedAt
        +object componentUpdatedAt
        +object loadoutSnapshot
        +object competitiveRank
    }
    class AccountSessionService {
        <<service>>
        +switchSavedAccount(id)
        +renewSavedAccountSession(user)
        +signOutRiotAccount()
    }
    class MatchRequestRuntime {
        +begin(user)
        +invalidate()
        +reset()
        +addDetail(cache, id, detail)
    }
    class RiotApiClient {
        <<service>>
        +request(config)
    }
    class MatchArchiveRepository {
        <<repository>>
        +archiveObservedMatches(accountKey, matches)
        +loadMatchSeasonArchive(accountKey, seasonId)
        +saveMatchSeasonArchive(input)
    }
    class MatchArchiveDriver {
        <<interface>>
        +read(accountKey, seasonId)
        +write(accountKey, seasonId, payload)
    }
    class SeasonPerformanceStats {
        <<interface>>
        +string seasonId
        +string dataCompleteness
        +number matchCount
        +number wins
        +number losses
        +number draws
        +number cancelled
        +number unknown
    }
    AccountState ..> AppStorage : secure adapter
    ProfileCacheState ..> AppStorage : cache adapter
    MatchState ..> AppStorage : persisted subset
    ProfileCacheState o-- ProfileWarmCache
    MatchState *-- MatchRequestRuntime
    MatchState ..> RiotApiClient : qua domain actions
    MatchState ..> MatchArchiveRepository : hydrate và merge theo Act
    MatchState o-- SeasonPerformanceStats
    MatchArchiveRepository o-- SeasonPerformanceStats : snapshot optional
    MatchArchiveRepository *-- MatchArchiveDriver
    AccountSessionService ..> AccountState
    AccountSessionService ..> MatchState : snapshot/reset
    AccountSessionService ..> ProfileCacheState : snapshot/reset
```

`Map` trong hình là mô tả logic: `cacheByAuth` thực tế là `Record<string, ...>`.
Method signature đã lược bỏ return type/option để sơ đồ đọc được; TypeScript
là nguồn contract chính xác.

Nguồn: [storage interface](../utils/storage-migration.ts), [AccountState](../hooks/useAccountStore.ts),
[MatchState](../features/matches/store-types.ts), [Profile store](../hooks/useProfileCacheStore.ts),
[request runtime](../features/matches/request-runtime.ts),
[archive repository](../services/matches/match-archive-core.ts).
