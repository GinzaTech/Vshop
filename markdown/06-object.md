# 06 — Sơ đồ đối tượng: ví dụ chọn Act cũ

Snapshot giả định tại một thời điểm; mọi ID đều giả. Dùng flowchart để biểu
diễn instance và reference, không thay đổi state thật.

```mermaid
flowchart LR
    U["activeUser : User<br/>id = demo-player<br/>region = ap"]
    M["matchStore : MatchState<br/>authKey = ap|demo-player"]
    P["profileCache : ProfileWarmCache<br/>authKey = ap|demo-player"]
    C["currentStats : SeasonPerformanceStats<br/>seasonId = demo-current"]
    H["historicalStats : SeasonPerformanceStats<br/>seasonId = demo-old<br/>dataCompleteness = rank-only<br/>wins = 6; losses = 3; draws = 1"]
    V["profileView : UI state<br/>selectedSeasonId = demo-old"]
    R["row : MatchHistoryRecord<br/>MatchID = demo-match<br/>stats.result = draw"]
    U -->|accountKey trùng| M
    U -->|accountKey trùng| P
    M -->|seasonStats| C
    M -->|seasonStatsById.demo-old| H
    M -->|seasonMatchesById.demo-old| R
    V -->|đang trình bày| H
    V -->|bảng trận đúng Act| R
```

Chọn Act cũ không được thay `seasonStats` của Act hiện tại. Với ví dụ trên,
win rate = 6 / (6 + 3 + 1) = 60%; huỷ/chưa rõ không vào mẫu số. Snapshot
`rank-only` giữ được thắng/thua nhưng K/D, ADR, ACS, HS và KAST phải hiển thị
`--` vì Riot không còn match detail tương ứng.

Nguồn: [MatchState](../features/matches/store-types.ts),
[dữ liệu mùa Profile](../features/profile/profile-season-data.ts),
[season summary](../features/matches/season-summary.ts),
[MMR fallback](../features/matches/season-mmr-summary.ts).
