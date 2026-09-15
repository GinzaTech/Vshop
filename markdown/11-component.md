# 11 — Sơ đồ thành phần

Các nhóm triển khai chính và boundary thay thế độc lập.

```mermaid
flowchart TB
    Shell[Application Shell: Router, providers, bootstrap]
    UI[Feature UI: Profile, Match, Combat, Shop, Chat]
    Primitives[UI primitives, DesignSystem, Motion]
    Stores[Zustand domain stores]
    Hooks[Screen lifecycle và local data hooks]
    Domain[Transforms, thống kê, cache policy, sync]
    Session[Account Session Service]
    Riot[Riot services + endpoint registry]
    Public[Public Valorant facade]
    HTTP[Isolated HTTP clients]
    Persist[Storage adapters + migration]
    Archive[Match archive repository]
    Chat[XMPP client + chat service]
    Native[Native modules: cookie, secure key, SQLite, image, background]
    Shell --> UI
    Shell --> Session
    UI --> Primitives
    UI --> Hooks
    UI --> Stores
    Hooks --> Domain
    Stores --> Domain
    Session --> Stores
    Domain --> Riot
    Domain --> Public
    Riot --> HTTP
    Public --> HTTP
    Stores --> Persist
    Stores --> Archive
    Archive --> Persist
    Archive --> Native
    Persist --> Native
    Session --> Native
    UI --> Chat
    Chat --> Native
```

Network DTO được chuyển sang view model trước khi render bảng/card. Persist
chỉ lưu subset cần thiết, không lưu promise hoặc loading flags. Tracer/log là
chẩn đoán opt-in, không phải dependency cần thiết để app hoạt động.

Nguồn: [cấu trúc dự án](../DIRECTORY_STRUCTURE.md), [HTTP clients](../services/http/clients.ts),
[match facade](../utils/match-ui.ts), [storage](../utils/storage.ts).
Archive contract: [services/matches](../services/matches/match-archive-core.ts).
