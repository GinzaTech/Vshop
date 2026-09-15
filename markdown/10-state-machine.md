# 10 — Sơ đồ trạng thái

## Snapshot Combat

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Pregame: nhận pregameMatch
    Idle --> Live: nhận currentGameMatch
    Pregame --> Live: pregame kết thúc, có live match
    Pregame --> Idle: không còn pregame/live
    Live --> Idle: không còn live match
    Live --> Pregame: snapshot mới có pregame
    Idle --> Idle: party hoặc tên thay đổi
    Pregame --> Pregame: snapshot pregame mới
    Live --> Live: snapshot live mới
    Pregame --> Idle: resetSession/logout
    Live --> Idle: resetSession/logout
```

Nếu upstream trả đồng thời pregame và live, store ưu tiên pregame. Khi lỗi
mạng tạm thời, giữ snapshot tốt của cùng phiên; không suy ra idle chỉ từ lỗi.

## Vòng đời request

```mermaid
stateDiagram-v2
    [*] --> Created
    Created --> Running: credential và chủ sở hữu hợp lệ
    Created --> Discarded: caller cũ hoặc thiếu auth
    Running --> Published: thành công và scope còn đúng
    Running --> Failed: lỗi của request hiện tại
    Running --> Discarded: logout, đổi token, generation hoặc request mới
    Failed --> [*]: cho phép lần gọi mới thử lại
    Published --> [*]
    Discarded --> [*]: không ghi state mới
```

Focus/background là điều kiện **polling**, không phải một giá trị `snapshot.state`.
Ngừng poll không có nghĩa trận đấu thật trên server đã kết thúc.

Nguồn: [Combat store](../hooks/useCombatStore.ts),
[polling](../features/combat/useCombatSessionPolling.ts),
[request runtime](../features/matches/request-runtime.ts).
