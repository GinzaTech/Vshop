# 15 — Sơ đồ liên lạc (Communication)

Tập trung vào **ai gửi thông điệp cho ai**; số thứ tự biểu diễn tiến trình.
Khác với Sequence, vị trí dọc không mang ý nghĩa thời gian.

```mermaid
flowchart LR
    U[Người dùng]
    V[Profile / bộ chọn Act]
    S[Match store]
    R[Request runtime]
    H[History và detail services]
    O[Outcome + season summary]
    C[(seasonStatsById / seasonMatchesById)]
    D[PlayerStatsDashboard]
    U -->|1. Chọn seasonId| V
    V -->|2. fetchSeasonStats user, force, seasonId| S
    S -->|2.1 Kiểm tra live user và generation| R
    R -->|2.2 Scope hợp lệ| S
    S -->|3. Lấy history và hydrate detail theo Act| H
    H -->|3.1 Match DTO| S
    S -->|4. Chuẩn hoá outcome và tổng hợp| O
    O -->|4.1 Stats và sample coverage| S
    S -->|5. Ghi nếu scope còn đúng| C
    C -->|6. Snapshot của Act đã chọn| D
    D -->|7. Card / bảng đúng mùa| U
```

Cache fresh có thể bỏ qua bước 3. Có phân biệt force và request hiện có;
response cũ không được ghi đè lựa chọn mới. Kết quả huỷ/chưa rõ không được
chuyển thành thua, và không được tính vào mẫu số win rate.

Nguồn: [season actions](../features/matches/season-actions.ts),
[outcome](../utils/match-result.ts), [summary](../features/matches/season-summary.ts),
[dashboard](../components/profile/PlayerStatsDashboard.tsx).
