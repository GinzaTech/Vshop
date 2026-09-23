# 01 — Sơ đồ khối: khởi động VShop

Luồng quyết định chính của application shell; gom các bước nhỏ thành khối.

```mermaid
flowchart TD
    A([Mở ứng dụng]) --> B[Expo Router và RootLayout]
    B --> B1[Chụp route bootstrap một lần]
    B1 --> C[Hydrate user và saved accounts]
    C --> D{Có region và phiên?}
    D -- Chưa có region --> E[Setup]
    D -- Chưa có phiên --> F[Đăng nhập hoặc reauth]
    D -- Có --> G{Access token còn dùng được?}
    G -- Không --> H[Renew saved session qua hàng đợi cookie]
    G -- Có --> I[syncAllData]
    H -- Thành công --> I
    H -- Cần đăng nhập lại --> F
    I --> I1[Ensure mốc ghi nhận Act bất biến theo account]
    I1 --> J[User, shop, balances, client config, matches, profile]
    J --> K{Phiên còn đúng và dữ liệu dùng được?}
    K -- Có --> L[Persist cache và startup marker]
    L --> M[Hiển thị Profile]
    M --> N[AppWarmup: tác vụ nền theo TTL]
    K -- Request lỗi thời --> O[Bỏ kết quả; phiên mới tiếp quản]
    K -- Lỗi tạm thời / bảo trì --> P{Snapshot hoàn chỉnh đúng account?}
    P -- Có --> Q[Cho xem dữ liệu gần nhất + thời điểm sync]
    Q --> M
    P -- Không --> R[Giữ màn hình lỗi có thể thử lại]
    R --> I
    E --> F
    F -- Xác thực thành công --> M
```

Đăng nhập WebView có luồng dựng user/preload riêng; không coi nó là cùng một
pipeline với mọi lần bootstrap. Startup marker phải hợp lệ và khớp account;
đọc metadata xong phải kiểm tra lại session generation và store hiện tại.
Mốc 72 giờ chỉ phân biệt cache fresh; khi Riot bảo trì, snapshot hoàn chỉnh cũ
hơn vẫn có thể được người dùng chọn thủ công và luôn hiển thị thời điểm sync.
Lỗi 401 hoặc Name Service 403 đi qua renew/reauth, không gắn nhãn bảo trì.
Route bootstrap được latch sau hydrate: điều hướng người dùng thực hiện trong
lúc sync không tạo dependency mới để cleanup/restart pipeline cũ.
Mốc Act chỉ được tạo một lần; sync sau đó không lùi timestamp hoặc phục hồi cache
mùa trước mốc.

Nguồn: [RootLayout](../app/_layout.tsx), [AppWarmup](../components/AppWarmup.tsx),
[data-sync](../utils/data-sync.ts), [startup-cache](../utils/startup-cache.ts).
Xem thêm [route bootstrap latch](../utils/root-bootstrap-route.ts) và
[recording baseline](../services/matches/match-recording-core.ts).
