# 16 — Tổng quan tương tác (UML 2.0)

Các khối `ref` là tương tác con được mô tả ở các sơ đồ khác; hình này không
liệt kê từng HTTP call. Dùng flowchart thay ký pháp UML chuyên dụng.

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[ref: Bootstrap và hydrate]
    B --> C{Phiên dùng được?}
    C -- Không --> D[ref: Interactive login hoặc renew]
    D --> C
    C -- Có --> E[ref: Core sync và cache ownership]
    E --> F[Hiển thị ứng dụng]
    F --> G{Tương tác tiếp theo}
    G -- Chọn Act --> H[ref: Archive, Riot history/MMR và tổng hợp mùa]
    G -- Xem trận --> I[ref: Detail + tên người chơi]
    G -- Refresh Profile --> J[ref: Partial fetch và merge cache]
    G -- Switch account --> K[ref: Snapshot / activate / sync / rollback]
    G -- Đăng xuất --> L[ref: Invalidate + reset + clear storage]
    H --> F
    I --> F
    J --> F
    K --> C
    L --> D
    G -- App background --> M[ref: Dừng screen polling]
    M -->|Foreground| N[ref: Kiểm tra phiên và TTL]
    N --> C
```

Tương tác chọn Act hydrate archive account-scoped trước, sau đó mới gọi nguồn
Riot còn cần thiết. Snapshot hoàn tất tránh crawl lại; request cũ vẫn phải qua
scope/generation trước khi ghi UI hoặc archive.

Tham chiếu: [Flowchart](01-flowchart.md), [Sequence switch](08-sequence.md),
[Activity refresh](12-activity.md), [Communication mùa](15-communication.md).
Quay lại foreground không luôn đồng nghĩa full sync: ưu tiên cache/TTL và
trạng thái session recovery hiện tại.

Nguồn: [AppWarmup](../components/AppWarmup.tsx), [app-sync](../utils/app-sync.ts),
[screen activity](../features/combat/useCombatScreenActivity.ts).
Nguồn mùa: [season actions](../features/matches/season-actions.ts),
[archive](../services/matches/match-archive-core.ts).
