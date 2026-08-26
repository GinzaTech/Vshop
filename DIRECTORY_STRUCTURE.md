# VShop architecture

Tài liệu này mô tả cấu trúc đang được sử dụng. `app/` chỉ chịu trách nhiệm routing và ghép màn hình; network, state, UI dùng lại và domain logic không được đặt trực tiếp trong route.

## Cấu trúc chính

```text
Vshop/
├── AGENTS.md                    quy tắc bắt buộc khi thay đổi repository
├── BUILD_DESIGN_SYSTEM.md       build/release và chuẩn UI/motion
├── README.md                    hướng dẫn dự án song ngữ
├── CHANGELOG.md                 lịch sử release
├── app/                         Expo Router routes
│   ├── _layout.tsx              providers và session lifecycle
│   ├── (authenticated)/         các màn hình cần đăng nhập Riot
│   │   ├── _layout.tsx          tabs, route phụ và transition
│   │   ├── shop/bundles/...     store và reference screens
│   │   ├── profile/history/...  profile và match screens
│   │   └── combat*.tsx          pregame/live session
│   └── chat/                    direct-message routes
├── components/                  UI dùng lại
│   ├── match-detail/            UI chi tiết trận đấu
│   ├── matches/                 match cards, loading và empty states
│   ├── popups/                  overlay/modal dùng toàn app
│   ├── profile/                 profile dashboard sections
│   ├── providers/               platform providers
│   └── ui/                      design-system primitives
│       ├── AppRefreshControl.tsx
│       ├── GlassCard.tsx
│       ├── ValorantButton.tsx
│       └── ...
├── constants/                   design tokens và cấu hình tĩnh
│   ├── DesignSystem.ts
│   ├── MatchTheme.ts
│   └── Motion.ts                timing/spring chuẩn, hỗ trợ Reduce Motion
├── hooks/                       Zustand stores và hooks cấp ứng dụng
│   ├── useUserStore.ts          session, shop, balance
│   ├── useMatchStore.ts         match list/detail cache
│   ├── useProfileCacheStore.ts  profile warm cache
│   ├── useCombatStore.ts        pregame/live snapshot
│   └── useAsyncRefresh.ts       refresh guard dùng chung
├── services/                    mọi kết nối ra ngoài ứng dụng
│   ├── http/
│   │   └── clients.ts           client tách biệt cho Riot/public/telemetry
│   ├── riot/
│   │   ├── client.ts            interceptor, auth invalidation, API logging
│   │   ├── endpoints.ts         registry URL có type + validation
│   │   ├── request-context.ts   headers, auth context và debug redaction
│   │   ├── account-api.ts       player identity, names và account data
│   │   ├── loadout-api.ts       inventory, loadout và storefront
│   │   ├── match-api.ts         history, MMR và match details
│   │   ├── combat-api.ts        party, pregame và coregame
│   │   └── progression-api.ts   contracts, content và leaderboard
│   └── valorant/
│       └── public-api.ts        facade duy nhất cho valorant-api.com
├── utils/                       domain helpers, cache, sync và compatibility
│   ├── valorant-api.ts          facade tương thích re-export Riot services
│   ├── valorant-user.ts         default user/session shape
│   ├── valorant-assets.ts       cache + orchestration asset
│   ├── auth-session.ts          tạo/khôi phục session
│   ├── session-events.ts        phân loại lỗi auth/network
│   └── ...
├── types/                       shared declarations/view-model types
├── __tests__/                   unit và API contract tests
├── scripts/
│   └── smoke-api.mjs            smoke test API công khai qua mạng thật
├── eas.json                     EAS build profiles
├── app.json                     Expo/native version source
└── assets/                      ảnh, font và native assets
```

## Luồng phụ thuộc

```text
route → component/store → service → HTTP client → upstream API
                       ↘ cache/domain helper
```

Quy tắc:

1. Route không import `axios` hoặc hard-code API URL.
2. API Riot phải dùng `riotApiClient` và `buildRiotApiUrl`.
3. API `valorant-api.com` phải đi qua `services/valorant/public-api.ts`.
4. Không thay đổi `axios.defaults`; mỗi nhóm API có timeout riêng.
5. Endpoint động phải validate region và encode ID trước khi gửi.
6. Animation tương tác chạy trên UI thread bằng Reanimated; timing/spring lấy từ `constants/Motion.ts`.
7. Animation lặp hoặc trang trí phải tôn trọng thiết lập Reduce Motion của hệ điều hành.
8. Pull-to-refresh dùng `useAsyncRefresh` + `AppRefreshControl` và phải giữ vùng cuộn khi dữ liệu rỗng.
9. Chi tiết coding rule xem `AGENTS.md`; token/build rule xem `BUILD_DESIGN_SYSTEM.md`.

## State, cache và refresh

- `useUserStore`: session Riot, shop, balance và account progress được persist.
- `useMatchStore`: lịch sử/chi tiết trận có cache, deduplication và force refresh.
- `useProfileCacheStore`: cache loadout/profile có version và TTL.
- `useCombatStore`: snapshot pregame/live/party; các màn combat tự polling khi cần.
- `utils/app-sync.ts`: điều phối shop, balance, match và background sync.
- `useAsyncRefresh`: chống nhiều gesture refresh chạy đồng thời và reset spinner trong `finally`.

Màn hình có empty state không được thay `FlatList` bằng card tĩnh. Đặt card trong `ListEmptyComponent` và dùng `flexGrow: 1` để Android/iOS vẫn nhận gesture kéo xuống.

## API layers

### Riot authenticated API

`services/riot/endpoints.ts` là nguồn duy nhất cho toàn bộ URL Riot. Registry hiện có contract test cho mọi endpoint, bao gồm storefront, wallet, loadout, match, pregame/coregame, party, contracts, leaderboard và auth services.

`utils/valorant-api.ts` chỉ là facade tương thích cho các consumer hiện hữu. Phần triển khai được chia theo domain trong `services/riot/*-api.ts`; code mới nên import service domain trực tiếp khi không cần giữ compatibility.

`services/riot/client.ts` cài interceptor đúng một lần trên một Axios instance riêng:

- timeout 10 giây;
- API timing/logging;
- nhận diện 401/403 từ đúng Riot host;
- phát session-auth failure cho lifecycle manager.

### Public VALORANT content API

`services/valorant/public-api.ts` unwrap envelope `{ status, data }`, quản lý base URL và query params. `utils/valorant-assets.ts` tiếp tục quản lý cache/deduplication, nhưng không còn tự dựng URL hoặc thay đổi Axios global.

### Telemetry và API khác

Telemetry dùng client timeout ngắn riêng. GitHub release check dùng public client, nên không bị Riot interceptor hoặc timeout của asset loader tác động.

## Kiểm tra

```bash
pnpm run typecheck       # TypeScript strict
pnpm run lint            # ESLint, không cho warning
pnpm run test:ci         # unit + endpoint contract + coverage
pnpm run test:api        # gọi mạng thật các public API app đang dùng
pnpm run check           # typecheck + lint + test:ci
```

API Riot cần access token/entitlements token chỉ được integration-test bằng session thử nghiệm hợp lệ. Các endpoint thay đổi trạng thái như lock agent, quit game, queue, loadout và party không được tự động gọi trong smoke test để tránh thay đổi tài khoản thật; URL/missing-param/encoding của chúng được kiểm tra đầy đủ bằng contract test.

## Build và release

Nguồn version/build number là `package.json` và `app.json`. Profile production tạo APK qua EAS:

```bash
pnpm dlx eas-cli@latest build --profile production --platform android
```

Không phát hành Gradle release local nếu `android/app/build.gradle` còn dùng `debug.keystore`. Checklist chi tiết và artifact policy nằm trong `BUILD_DESIGN_SYSTEM.md`.
