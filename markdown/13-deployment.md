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
    Release[GitHub Release: signed APK asset + checksum]
    Check -->|Source đã kiểm chứng| Native
    subgraph Runtime[Thiết bị Android / iOS]
        App[Native app + Hermes JS]
        Modules[Native modules]
        Cache[(MMKV cache)]
        Archive[(SQLite match archive theo account + Act)]
        Secure[(Encrypted session storage)]
        Keys[Keystore / Keychain]
        App --> Modules
        App --> Cache
        App --> Archive
        App --> Secure
        Secure --> Keys
    end
    Dev -->|Cài bản dev| App
    Prod -->|Cài APK production| App
    Prod -->|FINISHED + artifact URL| Release
    Metro -. Chỉ dev client .-> App
    App --> Riot[Riot / public API / chat]
    Updates[Expo Updates: runtime và channel tương thích] -->|JS và assets OTA| App
```

Android/iOS trong repo là output prebuild, không phải nguồn cấu hình chính.
Nguồn là `app.json`, plugin Expo và TypeScript. `production` xuất APK;
`production-store` xuất AAB. iOS cần pipeline và signing tương ứng, không
được suy ra đã build chỉ vì Android thành công. OTA không thay native binary.

Release 4.1.8 sẽ dùng EAS build production cuối từ commit source đã kiểm chứng,
package `com.android.vshop`, version/code `4.1.8/89`. Candidate
`ebcdfbea-913a-4b67-84d1-9b00c2a81382` bị thay thế vì có trước guard archive và
căn chỉnh patch SDK 57. Git chỉ chứa source và release metadata; APK cuối được
đính kèm ngoài Git tại GitHub Release `v4.1.8` sau khi đạt `FINISHED` và kiểm tra checksum.

Nguồn: [eas.json](../eas.json), [app.json](../app.json),
[quality workflow](../.github/workflows/quality.yml), [build rules](../BUILD_DESIGN_SYSTEM.md).
