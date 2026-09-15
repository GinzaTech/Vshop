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

Release 4.1.8 dùng EAS build
[`6e0a0273-9bac-46c5-b1d8-66c230b24557`](https://expo.dev/accounts/hyeon004/projects/vshop/builds/6e0a0273-9bac-46c5-b1d8-66c230b24557)
từ commit `7e42d64`, package `com.android.vshop`, version/code `4.1.8/89`.
Build đạt `FINISHED`; APK ký có SHA-256
`554AE2715CE64639413CD98F5318B26E23D6803A66B1CFD4303749F737157224`.
Git chỉ chứa source và release metadata; APK được đính kèm ngoài Git tại
GitHub Release `v4.1.8`. Runtime production chưa được kiểm chứng vì thiết bị ADB
không còn kết nối sau khi artifact hoàn tất.

Nguồn: [eas.json](../eas.json), [app.json](../app.json),
[quality workflow](../.github/workflows/quality.yml), [build rules](../BUILD_DESIGN_SYSTEM.md).
