# Bộ sơ đồ kiến trúc VShop

Mô tả mã nguồn **4.1.7** tại checkout VShop ngày **15-09-2026**, gồm các thay đổi
của đợt audit logic. Đây là tài liệu kiến trúc, không phải chứng nhận
mọi luồng đã được chạy trên thiết bị hoặc xác minh trên hạ tầng Riot.

VShop là ứng dụng Expo/React Native, dùng Zustand và cache cục bộ, gọi dịch vụ
Riot/Valorant bên ngoài. Repository **không triển khai database SQL hay backend
VShop riêng**. Không đưa token, cookie, tài khoản thật hoặc địa chỉ LAN thật vào sơ đồ.

## Danh mục 17 loại sơ đồ

| # | Sơ đồ | Nội dung chính |
|---|---|---|
| 01 | [Flowchart](01-flowchart.md) | Khởi động và khôi phục phiên |
| 02 | [ERD](02-erd.md) | Quan hệ dữ liệu logic, không phải schema SQL |
| 03 | [Mạng máy tính](03-network.md) | Thiết bị, mạng ngoài, HTTP và XMPP |
| 04 | [DFD](04-data-flow.md) | Dữ liệu đi qua process và kho dữ liệu |
| 05 | [Class Diagram](05-class.md) | Interface, store và service |
| 06 | [Object Diagram](06-object.md) | Snapshot minh hoạ nhiều mùa |
| 07 | [Use Cases](07-use-cases.md) | Người dùng và chức năng |
| 08 | [Sequence](08-sequence.md) | Đổi tài khoản và rollback |
| 09 | [Collaboration / Composite Structure](09-composite-structure.md) | Phối hợp bên trong Profile |
| 10 | [State Machine](10-state-machine.md) | Trạng thái Combat và request |
| 11 | [Component](11-component.md) | Các thành phần kiến trúc |
| 12 | [Activity](12-activity.md) | Làm mới Profile và partial failure |
| 13 | [Deployment](13-deployment.md) | Build, runtime native và OTA |
| 14 | [Package](14-package.md) | Phụ thuộc giữa thư mục/module |
| 15 | [Communication](15-communication.md) | Thứ tự thông điệp tải thống kê mùa |
| 16 | [Interaction Overview](16-interaction-overview.md) | Tổng hợp các tương tác con |
| 17 | [Timing](17-timing.md) | Request cũ, logout và request mới |

## Cách đọc và giới hạn ký pháp

Mở các file bằng Markdown Preview có hỗ trợ Mermaid. `erDiagram`,
`classDiagram`, `sequenceDiagram`, `stateDiagram-v2` dùng cú pháp riêng.
Các loại UML không có cú pháp Mermaid chuyên dụng được biểu diễn tương đương
bằng flowchart/subgraph; Timing dùng timeline minh hoạ, không phải số đo FPS.

Collaboration là tên cũ gắn với Communication trong UML; Composite Structure
không đồng nghĩa hoàn toàn với nó. File 09 tập trung **cấu trúc phối hợp nội bộ**,
file 15 tập trung **thông điệp đánh số**, tránh vẽ hai bản trùng nhau.

Trong sơ đồ lớp, stereotype `interface`/`store`/`service` mô tả TypeScript
function và Zustand store; không ngụ ý code đã được viết thành class OOP.
Quan hệ ERD là liên kết theo ID/key hoặc dữ liệu suy ra, không có foreign key
được database cưỡng chế. Các đối tượng `demo-*` hoàn toàn là dữ liệu giả.

Nguồn đối chiếu: [quy tắc dự án](../AGENTS.md),
[cấu trúc thư mục](../DIRECTORY_STRUCTURE.md), [audit](../LOGIC_AUDIT.md).
Tình trạng kiểm chứng source/device được ghi riêng trong audit; các sơ đồ không
đại diện cho deployment hay thay đổi tài khoản thật.

Kiểm tra tài liệu: 19 khối Mermaid trong 17 loại sơ đồ parse thành công bằng
Mermaid 12.0.0; 93 liên kết file nội bộ tồn tại. Đây là kiểm tra cú pháp/liên kết,
không phải bằng chứng chạy toàn bộ luồng app. Tham khảo ký pháp
[Mermaid](https://mermaid.js.org/config/usage.html) và
[Gantt cho Timing minh hoạ](https://mermaid.js.org/syntax/gantt.html).
