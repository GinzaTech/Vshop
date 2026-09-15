# 08 — Sơ đồ trình tự: switch account và rollback

Nhánh lỗi tập trung vào trường hợp B đã được activate trước khi sync thất bại.
Các lần capture cookie/renew chi tiết được gom để tránh che mất thứ tự dữ liệu.

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant S as AccountSessionService
    participant Q as Session queue / generation
    participant C as Cookie jar
    participant D as User + domain stores
    participant API as Sync / Riot API
    U->>S: switchSavedAccount(B)
    S->>Q: invalidate và enqueue
    Q-->>S: bắt đầu khi cookie queue rảnh
    S->>C: chụp cookie A, khôi phục cookie B
    opt Token B cần làm mới
        S->>API: renew B
        API-->>S: credential đúng subject
    end
    S->>D: captureAccountData(A)
    S->>D: activate B, ghi region B
    S->>API: syncAllData(B)
    alt Sync thành công và generation còn đúng
        API-->>S: dữ liệu dùng được
        S->>C: capture cookie mới
        S->>D: saveAccount(B, active)
        S-->>U: switched
    else Sync lỗi, chưa có phiên khác tiếp quản
        API-->>S: lỗi
        S->>Q: tăng generation để chặn request B
        S->>D: restore user A + match/profile snapshot
        S->>D: xoá startup marker, restore region A
        S->>C: restore cookie A
        S-->>U: failed hoặc reauth-required
    else Logout / phiên khác đã tiếp quản
        S-->>U: không restore đè lên phiên mới
    end
```

Snapshot rollback chỉ chứa dữ liệu, không phục hồi promise, credential trong
request runtime hoặc cờ loading. Lỗi dọn startup marker không được ngắt việc
khôi phục region/cookie.
Archive mùa không bị copy giữa A và B: row được khóa bằng account + Act và chỉ
được hydrate khi auth key của account đang hoạt động khớp scope request.

Nguồn: [session](../services/accounts/session.ts),
[session-cache](../services/accounts/session-cache.ts),
[session queue](../utils/session-operations.ts),
[match archive](../services/matches/match-archive-core.ts).
