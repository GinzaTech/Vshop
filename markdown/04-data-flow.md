# 04 — Sơ đồ luồng dữ liệu (DFD)

Mũi tên ghi **dữ liệu**, không mô tả thứ tự thời gian. Kho D1/D2 là adapter
storage; D3 là state trong bộ nhớ, không phải database server.

## Mức ngữ cảnh

```mermaid
flowchart LR
    U[Người dùng] -->|Thao tác và lựa chọn| P((0. VShop))
    P -->|Giao diện, dữ liệu, thông báo| U
    P -->|Request xác thực hoặc dữ liệu| R[Riot services]
    R -->|Phiên, lịch sử, shop, party, chat| P
    P -->|Yêu cầu metadata| V[Public Valorant API]
    V -->|Asset và tên hiển thị| P
    O[Hệ điều hành] -->|Focus, network, background event| P
    P -->|Thông báo hoặc ảnh xuất theo thao tác| O
```

## Mức 1

```mermaid
flowchart TB
    U[Người dùng] -->|Đăng nhập, switch, logout| P1((1. Quản lý phiên))
    U -->|Refresh, chọn Act, mở chi tiết| P2((2. Đồng bộ và truy vấn))
    U -->|Trang bị hoặc thao tác game| P4((4. Mutation có chủ đích))
    P1 <-->|Phiên và cookie snapshot| D1[(D1. Secure session storage)]
    P1 -->|Auth context, generation| P2
    P1 -->|Auth context| P4
    P2 <-->|DTO request và response| R[Riot API]
    P4 <-->|Lệnh và kết quả xác nhận| R
    P2 <-->|Metadata asset| V[Public API]
    P2 <-->|Cache theo account và schema| D2[(D2. App cache storage)]
    P2 -->|Snapshot còn đúng phiên| D3[(D3. Zustand và local hook state)]
    P4 -->|Kết quả được xác nhận| D3
    D3 -->|Dữ liệu đã chuẩn hoá| P3((3. Tổng hợp và trình bày))
    P3 -->|Card, thống kê, bảng| U
    P1 -->|Reset hoặc rollback cache| D2
    P1 -->|Reset hoặc restore snapshot| D3
```

Request lỗi thời bị chặn trước khi cập nhật D2/D3. Lỗi một nguồn Profile giữ
lại giá trị và tuổi cache của nguồn đó. Các mutation được mô tả vì app có
chức năng này, không có nghĩa đợt kiểm thử tự động đã thực hiện chúng.

Nguồn: [session](../services/accounts/session.ts), [sync](../utils/data-sync.ts),
[profile refresh](../features/profile/profile-refresh-data.ts), [storage](../utils/storage.ts).
