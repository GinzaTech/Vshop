# VShop architecture

Tài liệu này mô tả cấu trúc của source candidate `4.1.9`; artifact native đã
xác minh gần nhất vẫn là release `4.1.8`. `app/` chỉ chịu trách nhiệm routing và
ghép màn hình; network, state, UI dùng lại và domain logic không được đặt trực
tiếp trong route.

Bộ [17 loại sơ đồ](markdown/README.md) mô tả luồng, dữ liệu, thành phần và
deployment; [LOGIC_AUDIT.md](LOGIC_AUDIT.md) ghi kết quả kiểm tra và phần chưa xác minh.

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
│   └── ui/                      design-system primitives
│       ├── AppIcon.tsx          boundary Morphicons/vendor duy nhất
│       ├── app-icon-registry.ts semantic token → morphable IconNode có type
│       ├── app-icon-lucide.ts   deep ESM Lucide + custom Pistol boundary
│       ├── app-icon-types.ts    định nghĩa MorphIcon duy nhất
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
│   ├── matches/
│   │   ├── match-archive-core.ts repository, validate và merge archive theo Act
│   │   ├── match-archive.native.ts SQLite driver cho Android/iOS
│   │   └── match-archive-storage.ts storage adapter cho web/test
│   └── valorant/
│       └── public-api.ts        facade duy nhất cho valorant-api.com
├── utils/                       domain helpers, cache, sync và compatibility
│   ├── valorant-api.ts          facade tương thích re-export Riot services
│   ├── valorant-user.ts         default user/session shape
│   ├── valorant-assets.ts       cache + orchestration asset
│   ├── riot-cookies.ts          logic cookie dùng chung; cookies.* là entry point nền tảng
│   ├── primary-tab-motion.ts    cấu hình chuyển tab dùng bởi runtime và test
│   ├── auth-session.ts          tạo/khôi phục session
│   ├── session-events.ts        phân loại lỗi auth/network
│   ├── root-bootstrap-route.ts  chốt route khởi động, không redirect đè route mới
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

### Ranh giới logic sau đợt audit 2026-09-16

- `services/accounts/session-cache.ts` chụp/khôi phục dữ liệu khi switch thất bại
  và dọn cache khi logout; session generation vô hiệu hoá request cũ.
- `services/riot/request-scope.ts` quản lý danh tính request trong bộ nhớ.
  `client-config-cache`, `mmr-cache`, `player-name-cache`, `loadout-cache` tách
  cache theo loại dữ liệu; credential không xuất hiện trong key persist.
- `hooks/useMatchStore.ts` là facade cho `features/matches/`: history, detail,
  season, hydration, request lifetime và snapshot dữ liệu.
- `services/matches/` giữ archive match đã quan sát theo account + Act. Native
  dùng SQLite/WAL và primary key kép; web/test dùng `appStorage`. Repository
  tuần tự hoá write, validate payload, chống trùng Match ID và giữ tối đa 1.000
  summary mỗi Act mà không persist credential hoặc full match detail.
- `utils/match-ui.ts` giữ API tương thích, còn chuyển đổi dữ liệu nằm trong
  `utils/match-transform/`; `utils/match-result.ts` là nguồn xác định outcome.
- `PlayerInfoView` ghép dashboard Tổng quan/Chi tiết và dùng các helper
  `player-stats-data`, `player-stats-format`; tab state nằm trong
  `useProfileDashboardTabStore`, không sao chép logic win rate.
- `components/ui/AppIcon.tsx` là boundary icon runtime duy nhất. Screen/feature
  truyền `AppIconName`; registry nhận exact-version Lucide data từ
  `app-icon-lucide.ts`, Morphicons render mọi glyph qua `react-native-svg`, và
  không còn MaterialCommunityIcons fallback. Deep ESM runtime import chỉ được
  phép trong boundary Lucide; pistol dùng `IconNode` local. Wishlist filled giữ
  cùng Heart path và chỉ đổi fill.
- Các hook dữ liệu màn hình theo dõi tài khoản, token và vòng đời. Combat
  polling chỉ hoạt động khi màn hình có focus và app ở foreground.
- `utils/log-redaction.ts` là boundary chẩn đoán chung. Flow trace và API log
  chỉ bật rõ ràng ở dev; OAuth state/nonce nằm ở `services/accounts/interactive-auth.ts`.

### Luồng chuẩn

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
8. Icon UI dùng `AppIconName`; không import MaterialCommunityIcons, còn direct
   Morphicons chỉ được xuất hiện trong `AppIcon.tsx`. Runtime deep Lucide import
   chỉ nằm tại `app-icon-lucide.ts`; không dùng namespace hoặc runtime barrel.
   Icon trong control đã có label là decorative; state accessibility ở parent.
9. Pull-to-refresh dùng `useAsyncRefresh` + `AppRefreshControl` và phải giữ vùng cuộn khi dữ liệu rỗng.
10. Chi tiết coding rule xem `AGENTS.md`; token/build rule xem `BUILD_DESIGN_SYSTEM.md`.

## State, cache và refresh

- `services/accounts/session.ts` điều phối renewal, chuyển tài khoản, đăng xuất và chuẩn bị WebView trên một hàng đợi thao tác cookie. Request làm mới trùng dùng chung promise; token/cookie mới được lưu ngay, kết quả của phiên đã đổi bị bỏ qua.
- `utils/session-operations.ts` quản lý generation và ranh giới xác thực tương tác. Startup/warmup chỉ mở reauth khi Riot yêu cầu đăng nhập/MFA hoặc xác nhận phiên không hợp lệ; lỗi mạng, lỗi native cookie và response không xác định giữ session/cache để thử lại.
- `syncAllData` gộp request trùng, kiểm tra account/token/generation trước mỗi lần ghi kết quả. Các phép so sánh dữ liệu phục vụ báo cáo sync; việc lưu credentials không phụ thuộc shop có thay đổi hay không.

- `useUserStore`: session Riot, shop, balance và account progress được persist.
- `useMatchStore`: lịch sử/chi tiết trận có cache, deduplication và force refresh.
- `useProfileCacheStore`: cache loadout/profile có version và TTL.
- `useCombatStore`: snapshot pregame/live/party; các màn combat tự polling khi cần.
- `utils/app-sync.ts`: điều phối shop, balance, match và background sync.
- `useAsyncRefresh`: chống nhiều gesture refresh chạy đồng thời và reset spinner trong `finally`.

- Profile được ghép tại `features/profile/ProfileScreen.tsx`; `useProfileSession`,
  `useProfileState`, `useProfileFetch` quản lý dữ liệu, các hook Loadout/Hero/Collection
  tính dữ liệu hiển thị, Picker/Mutations xử lý thao tác, Motion/Pager quản lý chuyển cảnh.
- `useProfileDashboardTabStore` tách lựa chọn Tổng quan/Chi tiết khỏi toàn màn
  Profile; hai panel render sẵn và đổi lớp bằng Reanimated shared value.
- `services/accounts/session-cache.ts` snapshot/restore dữ liệu khi switch thất bại;
  `utils/storage-migration.ts` tuần tự hoá write/remove, loại read cũ khi hydrate.
- `utils/match-result.ts` là nguồn quy tắc win/loss/draw/cancelled/unknown;
  `utils/match-ui.ts` và `hooks/useMatchStore.ts` giữ vai trò facade tương thích.

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
pnpm run check           # typecheck + lint + test:ci + audit + Android export/budget
```

Gate Android đặt `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` và
`EXPO_UNSTABLE_TREE_SHAKING=1`; development/preview/production EAS dùng cùng
env, còn `production-store` kế thừa production. Lần full check đầu đạt source,
audit và 87 suite / 909 test nhưng fail Hermes 8,79/8,00 MiB; deep-import-only
đạt 8,26 MiB. Export tối ưu cuối PASS 10,16/12 MiB tổng, 7,69/8 MiB Hermes và
1,25/1,50 MiB asset lớn nhất.

EAS project `@hyeon004/vshop` production environment đã set/verify hai optimizer
vars dạng plaintext, nên future `eas update --environment production` dùng cùng
optimizer. Parity này không cho phép 4.1.9 OTA vào binary/runtime 4.1.8.

API Riot cần access token/entitlements token chỉ được integration-test bằng session thử nghiệm hợp lệ. Các endpoint thay đổi trạng thái như lock agent, quit game, queue, loadout và party không được tự động gọi trong smoke test để tránh thay đổi tài khoản thật; URL/missing-param/encoding của chúng được kiểm tra đầy đủ bằng contract test.

## Build và release

Nguồn version/build number là `package.json` và `app.json`. Profile production tạo APK qua EAS:

```bash
pnpm dlx eas-cli@latest build --profile production --platform android
```

Không phát hành Gradle release local nếu `android/app/build.gradle` còn dùng `debug.keystore`. Checklist chi tiết và artifact policy nằm trong `BUILD_DESIGN_SYSTEM.md`.

Source candidate 4.1.9 dùng `react-native-svg` trong chuỗi
Lucide `IconNode` → Morphicons → SVG nên bắt buộc rebuild native client.
Metadata là 4.1.9/Android 90/iOS 42 và optimized static export budget đã PASS,
nhưng EAS native build, APK install, device interaction, accessibility thủ công
và performance 4.1.9 hiện **NOT VERIFIED**. Không publish OTA 4.1.9 cho runtime
4.1.8.
