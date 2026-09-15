# 12 — Sơ đồ hoạt động: refresh Profile

Hoạt động song song được gom trong khối fetch; nhánh partial failure không
được xoá dữ liệu đã biết hoặc đánh dấu nguồn lỗi là fresh.

```mermaid
flowchart TD
    A([Người dùng kéo làm mới]) --> B{Có phiên và đúng account?}
    B -- Không --> Z([Bỏ qua])
    B -- Có --> C[Chụp generation và request sequence]
    C --> D[Fetch loadout, ownership, rank song song]
    D --> E{Có SessionChangedError hoặc scope cũ?}
    E -- Có --> Z
    E -- Không --> F[Đọc cache trước đó cùng account]
    F --> G{Loadout thành công?}
    G -- Có --> H[Thay snapshot và timestamp loadout]
    G -- Không --> I[Giữ snapshot và tuổi cũ]
    H --> J{Rank thành công?}
    I --> J
    J -- Có --> K[Thay rank; null hợp lệ nghĩa là chưa rank]
    J -- Không --> L[Giữ rank và version cũ]
    K --> M[Hợp nhất ownership thành công; nguồn lỗi giữ dữ liệu]
    L --> M
    M --> N[Tuổi tổng hợp theo component cũ nhất]
    N --> O{Scope vẫn hiện hành?}
    O -- Không --> Z
    O -- Có --> P[Update UI và persist cache]
    P --> Q[Tắt refreshing của đúng request]
    Q --> R([Hoàn tất])
```

Guard đã thử lần đầu theo mount/auth ngăn partial cache write tự kích hoạt
vòng fetch vô hạn. Người dùng vẫn có thể kéo refresh để thử lại. Mutation
loadout có version riêng để GET chạy trước mutation không ghi đè kết quả mới.
Đổi tab Tổng quan/Chi tiết là state trình bày riêng và không đi qua activity
fetch này; hai panel đã render chỉ đổi opacity/transform trên UI thread.

Nguồn: [Profile fetch](../features/profile/useProfileFetch.ts),
[refresh cache builder](../features/profile/profile-refresh-data.ts),
[warm cache](../utils/profile-cache.ts), [loadout cache](../services/riot/loadout-cache.ts),
[dashboard tab store](../features/profile/useProfileDashboardTabStore.ts).
