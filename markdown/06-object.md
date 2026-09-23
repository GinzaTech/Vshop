# 06 — Sơ đồ đối tượng: chọn Act đã ghi sau baseline

Snapshot giả định tại một thời điểm; mọi ID đều giả. Dùng flowchart để biểu
diễn instance và reference, không thay đổi state thật.

```mermaid
flowchart LR
    U["activeUser : User<br/>id = demo-player<br/>region = ap"]
    M["matchStore : MatchState<br/>authKey = ap|demo-player"]
    P["profileCache : ProfileWarmCache<br/>authKey = ap|demo-player"]
    B["baseline : MatchRecordingBaseline<br/>startedAt = t0<br/>startSeasonId = demo-start"]
    C["currentStats : SeasonPerformanceStats<br/>seasonId = demo-current<br/>recordingStartedAt = t0"]
    H["recordedStats : SeasonPerformanceStats<br/>seasonId = demo-after-t0<br/>dataCompleteness = rank-only<br/>recordingStartedAt = t0<br/>wins = 6; losses = 3; draws = 1"]
    V["profileView : UI state<br/>selectedSeasonId = demo-after-t0"]
    R["row : MatchHistoryRecord<br/>MatchID = demo-match<br/>stats.result = draw"]
    U -->|accountKey trùng| M
    U -->|accountKey trùng| P
    U -->|accountKey trùng| B
    M -->|seasonStats| C
    B -->|policy identity| M
    M -->|seasonStatsById.demo-after-t0| H
    M -->|seasonMatchesById.demo-after-t0| R
    V -->|đang trình bày| H
    V -->|bảng trận đúng Act| R
```

Chọn Act đã hoàn tất sau mốc không được thay `seasonStats` của Act hiện tại.
Act trước `t0` không có trong selector dù row archive legacy vẫn còn. Với ví dụ trên,
win rate = 6 / (6 + 3 + 1) = 60%; huỷ/chưa rõ không vào mẫu số. Snapshot
`rank-only` giữ được thắng/thua nhưng K/D, ADR, ACS, HS và KAST phải hiển thị
`--` vì Riot không còn match detail tương ứng.

Nguồn: [MatchState](../features/matches/store-types.ts),
[dữ liệu mùa Profile](../features/profile/profile-season-data.ts),
[season summary](../features/matches/season-summary.ts),
[MMR fallback](../features/matches/season-mmr-summary.ts),
[recording baseline](../services/matches/match-recording-core.ts).
