# 07 — Sơ đồ tình huống sử dụng

Các chức năng từ góc nhìn người dùng. Biểu diễn use case bằng khối bo tròn;
không thêm vai trò quản trị/backend không có trong dự án.

```mermaid
flowchart LR
    U[Người dùng]
    R[Riot services]
    V[Public Valorant API]
    OS[Hệ điều hành]
    subgraph App[VShop]
        A([Đăng nhập / khôi phục phiên])
        B([Chuyển tài khoản / đăng xuất])
        C([Xem shop và số dư])
        D([Xem Profile và bộ sưu tập])
        E([Chỉnh loadout khi yêu cầu])
        F([Xem lịch sử / chi tiết trận])
        G([Xem Act được VShop ghi kể từ mốc local])
        H([Xem leaderboard / contracts])
        I([Xem Combat và điều khiển party])
        J([Chat với bạn bè])
        K([Theo dõi wishlist / nhận thông báo])
        L([Xuất ảnh bộ sưu tập])
    end
    U --> A
    U --> B
    U --> C
    U --> D
    U --> E
    U --> F
    U --> G
    U --> H
    U --> I
    U --> J
    U --> K
    U --> L
    A --> R
    C --> R
    E --> R
    F --> R
    G --> R
    H --> R
    I --> R
    J --> R
    D --> V
    K --> OS
    L --> OS
```

Điều kiện chung của chức năng Riot: phiên hợp lệ, region và quyền tương ứng.
Wishlist cần người dùng bật thông báo; xuất ảnh cần quyền hệ điều hành.
Xem thống kê và thay loadout là hai use case riêng: việc mở card không được
tự gây mutation tài khoản.
Act trước mốc local bị ẩn. Act hoàn tất sau mốc có thể chỉ còn dữ liệu xếp hạng
`rank-only`; UI phải nói đúng phần dữ liệu còn nguồn thay vì dựng số liệu combat
giả hoặc hứa độ phủ như Tracker. Act chứa mốc không dùng MMR full-Act vì nguồn đó
bao gồm cả trận trước mốc.

Nguồn: [routes](../app), [Profile](../features/profile/ProfileScreen.tsx),
[Combat](../features/combat/CombatSessionScreen.tsx), [wishlist](../utils/wishlist.ts),
[chat service](../utils/chat-service.ts).
