# 03 — Sơ đồ mạng máy tính

Topology logic của các kết nối ứng dụng. Không suy đoán router, VLAN hay địa
chỉ IP của người dùng; các hạ tầng cloud do bên ngoài quản lý.

```mermaid
flowchart LR
    subgraph Local[Thiết bị và mạng cục bộ]
        PC[Máy phát triển: Metro]
        Phone[Android hoặc iOS chạy VShop]
        Store[(Storage trên thiết bị)]
        PC -. Dev client: LAN hoặc ADB reverse .-> Phone
        Phone --- Store
    end
    Phone -->|HTTPS 443| Auth[Riot Auth, Entitlements, Geo]
    Phone -->|HTTPS 443| PD[PD theo shard: dữ liệu người chơi]
    Phone -->|HTTPS 443| GLZ[GLZ theo shard: party và live game]
    Phone -->|HTTPS 443| Config[Riot Client Config]
    Phone -->|HTTPS 443| Public[valorant-api.com và asset CDN]
    Phone -->|XMPP qua TLS 5223| Chat[Riot Chat host được phân giải]
    Phone -. HTTPS: nếu cấu hình .-> Sentry[Sentry telemetry]
    Phone -->|HTTPS: kiểm tra OTA| OTA[Expo Updates]
    Phone -. Chỉ dev và opt-in .-> Trace[Flow trace WebSocket]
```

Client HTTP Riot, public API và telemetry độc lập (timeout lần lượt 10s, 15s,
8s). Riot URL được tạo từ registry; shard được validate. XMPP kiểm tra host
Riot hợp lệ và chứng chỉ TLS. Metro/trace là đường phát triển, không phải
backend bắt buộc của bản production.

Nguồn: [HTTP clients](../services/http/clients.ts), [endpoints](../services/riot/endpoints.ts),
[XMPP](../utils/xmpp-client.ts), [chat service](../utils/chat-service.ts),
[Expo config](../app.json), [tracer](../utils/flow-tracer.ts).
