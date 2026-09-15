# 13 — Sơ đồ triển khai

Phân biệt pipeline tạo artifact và runtime. Build/config dưới đây tồn tại
trong repository; trạng thái release cụ thể cần đối chiếu bản ghi build.

```mermaid
flowchart TB
    subgraph Development[Máy phát triển / CI]
        Src[Source TypeScript + Expo config]
        Check[pnpm run check: types, lint, tests, audit, export, budget]
        Metro[Metro dev server]
        Src --> Check
        Src --> Metro
    end
    subgraph Build[Expo EAS Build]
        Native[Native prebuild và compile]
        Dev[Development APK: dev client]
        Prod[Production APK: profile production]
        AAB[Production-store: app bundle]
        Native --> Dev
        Native --> Prod
        Native --> AAB
    end
    Check -->|Source đã kiểm chứng| Native
    subgraph Runtime[Thiết bị Android / iOS]
        App[Native app + Hermes JS]
        Modules[Native modules]
        Cache[(MMKV cache)]
        Secure[(Encrypted session storage)]
        Keys[Keystore / Keychain]
        App --> Modules
        App --> Cache
        App --> Secure
        Secure --> Keys
    end
    Dev -->|Cài bản dev| App
    Prod -->|Cài APK production| App
    Metro -. Chỉ dev client .-> App
    App --> Riot[Riot / public API / chat]
    Updates[Expo Updates: runtime và channel tương thích] -->|JS và assets OTA| App
```

Android/iOS trong repo là output prebuild, không phải nguồn cấu hình chính.
Nguồn là `app.json`, plugin Expo và TypeScript. `production` xuất APK;
`production-store` xuất AAB. iOS cần pipeline và signing tương ứng, không
được suy ra đã build chỉ vì Android thành công. OTA không thay native binary.

Nguồn: [eas.json](../eas.json), [app.json](../app.json),
[quality workflow](../.github/workflows/quality.yml), [build rules](../BUILD_DESIGN_SYSTEM.md).
