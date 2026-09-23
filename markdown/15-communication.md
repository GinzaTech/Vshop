# 15 — Sơ đồ liên lạc (Communication)

Tập trung vào **ai gửi thông điệp cho ai**; số thứ tự biểu diễn tiến trình.
Khác với Sequence, vị trí dọc không mang ý nghĩa thời gian.

```mermaid
flowchart LR
    U[Người dùng]
    V[Profile / bộ chọn Act]
    S[Match store]
    R[Request runtime]
    B[Recording baseline]
    H[Updates, history và detail services]
    M[MMR theo mùa]
    O[Outcome + season summary]
    C[(seasonStatsById / seasonMatchesById)]
    D[PlayerInfoView]
    U -->|1. Chọn seasonId| V
    V -->|2. fetchSeasonStats user, force, seasonId| S
    S -->|2.1 Kiểm tra live user và generation| R
    R -->|2.2 Scope hợp lệ| S
    S -->|2.3 Ensure timestamp và bind Act đầu| B
    B -->|2.4 Mốc và option được phép| S
    S -->|3. Tìm Act sau mốc trong updates / history| H
    H -->|3.1 Match DTO còn được Riot lưu| S
    S -->|3.2 Future Act không còn detail| M
    M -->|3.3 Tổng trận và thắng theo seasonId| S
    S -->|4. Chuẩn hoá outcome hoặc rank-only summary| O
    O -->|4.1 Stats và sample coverage| S
    S -->|5. Ghi nếu scope còn đúng| C
    C -->|6. Snapshot của Act đã chọn| D
    D -->|7. Card / bảng đúng mùa| U
```

Cache fresh có thể bỏ qua bước 3. Có phân biệt force và request hiện có;
response cũ không được ghi đè lựa chọn mới. Khi Riot không còn match detail
của Act mở sau baseline, MMR chỉ cung cấp tổng trận/thắng-thua; các metric combat phải để
`--`, không suy diễn thành 0. Kết quả huỷ/chưa rõ không được chuyển thành thua
và không được tính vào mẫu số win rate. Start Act bị clamp tới timestamp và
không đi qua MMR full-Act.

Nguồn: [season actions](../features/matches/season-actions.ts),
[outcome](../utils/match-result.ts), [summary](../features/matches/season-summary.ts),
[MMR fallback](../features/matches/season-mmr-summary.ts),
[recording baseline](../services/matches/match-recording-core.ts),
[dashboard](../components/profile/PlayerInfoView.tsx).
