# VShop build and design system

Tài liệu này là nguồn tham chiếu cho quy trình build/release và cách xây UI thống nhất trong VShop. Quy tắc bắt buộc cho agent và contributor nằm trong `AGENTS.md`.

## 1. Nguồn cấu hình

| Phạm vi | Nguồn chuẩn |
|---|---|
| App version, native build number, plugin | `app.json` |
| Package version và scripts | `package.json` |
| EAS profile và loại artifact | `eas.json` |
| Màu, radius, surface, shadow | `constants/DesignSystem.ts` |
| Motion duration, easing, spring | `constants/Motion.ts` |
| Match-specific visual tokens | `constants/MatchTheme.ts` |
| UI primitives | `components/ui/` |

Không sửa trực tiếp version hoặc signing trong generated native project rồi coi đó là nguồn chuẩn. `android/` và `ios/` có thể được tạo lại bởi Expo prebuild.

## 2. Design tokens

### Màu sắc

- `BACKGROUND`: nền màn hình.
- `SURFACE`: card, input và vùng nội dung nổi.
- `SURFACE_MUTED`: trạng thái phụ, placeholder hoặc nền control nhẹ.
- `TEXT_PRIMARY` / `TEXT_SECONDARY` / `TEXT_TERTIARY`: ba cấp độ chữ.
- `BORDER` / `BORDER_STRONG`: viền mặc định và viền cần nhấn nhẹ.
- `ACCENT` / `ACCENT_DEEP`: nhấn trung tính của ứng dụng.
- `SUCCESS`, `WARNING`, `WARNING_SURFACE`, `WARNING_BORDER`: semantic state.
- `STATUS_AWAY`, `STATUS_BUSY`, `STATUS_INFO`: trạng thái presence; luôn đi cùng icon/text.
- `MODAL_BACKDROP`: backdrop dành riêng cho modal/sheet cần khóa tương tác nền.
- `VALORANT_RED`, `VALORANT_VIOLET`, `VALORANT_DARK_BLUE`: chỉ dùng khi ngữ cảnh thương hiệu/game yêu cầu.
- `PURE_WHITE`, `PURE_BLACK`: tương phản tuyệt đối; không thay thế tùy tiện cho text/surface token.

Nếu cần semantic color mới, thêm token có tên mô tả ý nghĩa vào `DesignSystem.ts`; không rải hex mới trên nhiều screen.

### Radius và shape

| Token | Dùng cho |
|---|---|
| `RADIUS.screen` | sheet/modal hoặc container lớn |
| `RADIUS.card` | card nội dung chính |
| `RADIUS.button` | button tiêu chuẩn |
| `RADIUS.chip` | pill, badge và filter chip |

Radius chi tiết có thể dùng `RADIUS.sm/md/lg/xl`; không tạo một radius mới chỉ để chênh 1–2 px.

Component nhỏ đặc thù có thể dùng radius cục bộ, nhưng các primitive mới phải ưu tiên token.

### Typography, spacing, layout và elevation

- Dùng `TYPOGRAPHY` cho caption, body, title và display scale.
- Dùng `SPACING` cho nhịp 4/8/12/16/20/24/32.
- Dùng `LAYOUT.screenPadding`, `minTouchTarget` và `bottomNavHeight` cho kích thước dùng chung.
- Card thường dùng `SHADOWS.none/xs/sm`; navigation dùng tối đa `md`; `lg` dành cho modal/sheet.
- Bottom navigation dùng capsule nổi theo spec Liquid Glass đã duyệt: cao 54dp, margin ngang 14dp, tối đa 420dp và năm vùng chạm bằng nhau. `getGlassNavigationMetrics` là nguồn chuẩn cho safe-area và khoảng trống cuối nội dung; không để item cuối bị thanh nổi che.
- `LiquidNavigationShell` giữ TabRouter/descriptors/history nhưng dùng retained view host cho scene chính. `PrimaryTabScene` crossfade opacity, không trượt ngang. Lens đổi đích ngay, di chuyển 310–385ms theo khoảng cách; nội dung bắt đầu fade sau khoảng 210ms, fade 130ms. Chặn touch/accessibility của scene chưa hiện xong; thanh tab vẫn nhận lần bấm mới để retarget. Giữ một active AppIcon xuyên suốt cả khi ẩn bar ở route phụ. Reduce Motion bỏ stretch/magnification và tôn trọng OS.

Không tạo nhiều giá trị lệch 1–2 px nếu không có lý do layout cụ thể. Khi xuất hiện từ ba lần trở lên, nâng giá trị thành token hoặc primitive.

Navigation giữ nhấn Cài đặt500ms để thu thành nút tròn54dp bên phải; bấm nút để
mở lại, không đổi route. Expanded content giữ mounted để bảo toàn MorphIcon.
Vùng trong suốt ngoài nút tròn phải cho chạm xuyên; tab ẩn không nhận chạm hoặc
accessibility. Reduce Motion bỏ animation thu/mở. Bundle giữ body/title trắng
opaque, không dùng hero lặp lại làm nền blur; ownership fade/check là lớp riêng.
Viền Bundle/tile dùng `BUNDLE_SURFACE_BORDER` (1.5dp, `COLORS.BORDER_STRONG`).
Badge cho card/title/spray/flex/buddy phải khớp inventory đúng loại và tài khoản;
ID cấp/offer được giữ riêng với UUID metadata. Không suy ra sở hữu từ giá0 hoặc
ảnh/tên. Item cache cũ thiếu loại phải được refresh, không đoán dấu tích.

## 3. UI primitives

| Primitive | Vai trò |
|---|---|
| `GlassCard` | kính sáng với lớp frost, specular rim và shadow nhẹ; giữ contract View/contentStyle, không native blur mặc định |
| `LiquidGlassDecoration` | lớp ánh sáng/viền SVG tĩnh dùng lại trên card; không nhận touch hoặc tạo accessibility node |
| `LiquidGlassBackdrop` | native blur từ artwork trang trí có target riêng cho card nổi bật; chữ và artwork chính luôn rõ |
| `ValorantButton` | button chính/phụ với press feedback |
| `InfoPill` | metric, balance hoặc badge dạng pill |
| `PageIntro` | title/subtitle đầu màn hình |
| `EmptyStateCard` | trạng thái rỗng có nội dung hướng dẫn |
| `TwoColumnGrid` | grid nhỏ có số lượng item hữu hạn |
| `AppRefreshControl` | pull-to-refresh đồng nhất Android/iOS |
| `AppIcon` | boundary semantic có type duy nhất; mọi icon, kể cả glyph Valorant, render qua Morphicons |

Trước khi tạo component mới, kiểm tra `components/ui/`. Primitive không được chứa domain logic hoặc tự gọi Riot API.

### Liquid glass material

`GLASS_MATERIAL` và `GLASS_TAB_BAR` giữ màu/độ trong/kích thước. Store skin và
Profile identity được phép dùng blur với target cùng bounds đã layout và ảnh
đã tải. Bundle giữ hero gốc và phần nội dung trắng, không blur bản sao artwork
phía sau; lớp phủ đã sở hữu chỉ áp dụng lên ảnh/tên từng vật phẩm, không phủ giá.
Toàn bộ card chỉ giữ tối đa sáu native blur slot; danh sách
dày dùng lớp quang học tĩnh. Web, Android dưới API 31, Reduce Motion/Transparency,
ảnh thiếu/lỗi hoặc hết slot dùng nền dự phòng sáng. Navigation có target nội dung
riêng, bar là sibling để không tự lấy chính nó làm ảnh blur. Không gọi lớp SVG
tĩnh là khúc xạ hoặc background sampling thật.

Candidate Android API 33+ thêm `modules/vshop-liquid-glass`: target chỉ giữ lệnh
vẽ của subtree trang, lens sibling dùng RenderEffect/AGSL trong bounds lens có
padding. Không snapshot bitmap toàn màn hình, không chuyển pixel sang JS/storage.
Khúc xạ dùng transform global để bù translation/stretch, giữ tint xám 0.92 một
lần trên output opaque; icon/label và ánh sáng nằm trên shader. Target và lens
cleanup khi ẩn/background/detach, Reduce Motion và APK cũ giữ fallback. Cần build
native mới; compile/JVM/JS tests không chứng minh chất lượng hay FPS trên máy thật.

Module này đã được wire vào primary navigation: `LiquidNavigationShell` bọc các
scene chính trong `RefractionTarget`, `FloatingTabBar` render `RefractionLens`
trong chỉ-indicator di động qua bridge `NativeRefraction.android.tsx`. Gate bắt
buộc của lens: Android API 33+, module `apiVersion === 1`, tag target hợp lệ,
app foreground, không Reduce Transparency (Reduce Motion chỉ tắt animation, lens
tĩnh vẫn cho phép). Checklist khi thêm lens mới:

- Cấm đặt `opacity < 1` lên ancestor của lens đang hoạt động — khúc xạ sụp
  im lặng; animation thu gọn đang fade cả lens lẫn fallback là giới hạn chấp
  nhận được, không lồng glass mới vào trạng thái đó.
- Cấm glass trên glass: chỉ một lớp khúc xạ thật cho mỗi vùng; specular/rim
  SVG là lớp trang trí, không phải glass thứ hai.
- Lens cần nội dung động phía sau; nền phẳng một màu biến lens thành hình
  chữ nhật màu — dùng `LiquidGlassDecoration` thay thế.
- Card lặp/danh sách dày giữ decoration tĩnh; lens thật giới hạn cho chrome
  và card nổi bật.

Profile loadout hiển thị lựa chọn tức thời nhưng chỉ gửi một full-payload PUT cho
mỗi owner. Các intent chưa gửi được gộp theo field và dựng lại từ ACK Version mới.
Cache chỉ chứa dữ liệu server đã xác nhận. Force GET bị invalidation trả `null`,
không trả cache giả làm bằng chứng; non-force GET không được giải quyết trạng thái
PUT chưa rõ kết quả. Fixture `/ui-qa?demo=1` chỉ có ở DEV, không dùng tài khoản thật;
production resolver thay toàn bộ module fixture bằng stub rỗng.

### AppIcon boundary

- Screen/component chỉ truyền `AppIconName`; không import trực tiếp
  `morphicons/react-native` hoặc MaterialCommunityIcons.
- `AppIcon.tsx` là nơi duy nhất import `morphicons/react-native`; source runtime
  không còn import MaterialCommunityIcons.
- `app-icon-registry.ts` chỉ import từ `app-icon-lucide.ts`. File boundary này
  cô lập mọi runtime deep ESM import `lucide/dist/esm/icons/*.mjs`; namespace và
  runtime barrel import bị source-policy test cấm. `lucide` phải giữ exact pin
  `1.47.0` vì các internal path phụ thuộc đúng version.
- Chuỗi runtime chuẩn là semantic token → Lucide `IconNode` → Morphicons →
  `react-native-svg`. Pistol dùng `IconNode` local trong `app-icon-lucide.ts`;
  rank/role và các glyph Valorant khác cũng map sang vector data morphable, không
  dùng fallback icon font.
- Jest map `.mjs` sang Expo JS transformer để unit/component tests đọc đúng các
  deep ESM module giống Metro.
- `heart` ↔ `heartFilled` và `wishlist` ↔ `wishlistFilled` là ngoại lệ fill có
  chủ đích: dùng cùng path Heart, đổi `fill="none"` sang màu hiện tại; không đổi
  sang HeartPlus/HeartMinus và không giả path morph.

## 4. Motion system

`constants/Motion.ts` cung cấp:

- `MOTION_DURATION.fast`: phản hồi bấm/chuyển nhỏ;
- `MOTION_DURATION.standard`: chuyển trạng thái thông thường;
- `MOTION_DURATION.emphasized`: entrance hoặc thay đổi bố cục đáng chú ý;
- `MOTION_TIMING`: timing + easing chuẩn;
- `MOTION_SPRING.press`: press scale/feedback;
- `MOTION_SPRING.settle`: phần tử trở về trạng thái ổn định.

Quy tắc:

1. Ưu tiên `transform` và `opacity`; tránh animate width/height/top/left liên tục.
2. Animation tương tác dùng Reanimated để chạy trên UI thread.
3. Luôn dùng `ReduceMotion.System` hoặc API tương đương.
4. Cleanup animation/timer khi unmount.
5. Không chạy animation entrance lại chỉ vì selector/store trả object mới.
6. Blur/modal phải giữ target ổn định; Android Expo Blur dùng `blurTarget` + `blurMethod`.
7. Tab preload dùng `usePrimaryTabPreload` và `runIdleSequence`: dừng ngay khi bấm tab/transitionStart, tiếp tục sau transitionEnd và idle, mỗi lượt chỉ mount một scene. Không restart hàng đợi theo identity của navigation; cleanup cả listener, idle task và timer khi unmount.
8. Màn phụ dùng fade 140 ms; root stack dùng slide 220 ms với nền cố định và gesture back. `useMotionPreference` cập nhật Reduce Motion khi OS thay đổi, kể cả sau khi app đã mở.
9. Profile pager/list và ScrollView Bundles/More/Shop bật clipping riêng Android để giảm view ngoài vùng nhìn. Khi thay đổi layout/transform phải kiểm tra lại nội dung khi cuộn, chuyển trang con và quay lại tab; không unmount React state để tối ưu chuyển cảnh.
10. Profile player-data dùng một dark canvas xuyên qua status bar/header/body. Hai panel Tổng quan/Chi tiết được render sẵn, giữ cùng kích thước container và chỉ chuyển `opacity`/`transform` bằng shared value để tránh card tách lớp hoặc khựng layout.
11. Skeleton native-driver phải đặt `isInteraction: false` để không giữ hàng đợi render danh sách. Không dùng `LayoutAnimation.configureNext` toàn cục trước request bất đồng bộ của danh sách.
12. Biểu đồ nhiều đoạn dùng `GpuLineChartCanvas` để gom grid/line/point vào một Skia surface trên native; lớp `Pressable` accessibility vẫn đặt phía trên. Web dùng fallback nhẹ, không nạp CanvasKit.
13. Gesture thu gọn Profile dùng manual activation phải `fail()` khi touch kết thúc mà chưa activate. Header có transform/z-index phải dùng `pointerEvents="box-none"` cho khoảng trống; player-data mode tắt body-collapse pan để selector/tab/scroll con nhận touch đúng, trong khi loadout mode vẫn giữ collapse gesture.
14. Dashboard Profile lạnh phải mount hoàn tất trước frame bắt đầu morph. Warm transition dùng `MOTION_TIMING.standard` (220 ms); Reduce Motion nhảy trực tiếp tới trạng thái cuối. Không mount/aggregate toàn dashboard, interpolate nền toàn màn hình hoặc chạy reveal cho stat subtree đã bị che trong cùng cửa sổ animation.
15. Mọi nhóm tab phải có `tablist`, từng tab có `selected`; modal toàn cục phải ẩn background khỏi TalkBack/VoiceOver và chặn background touch trong lúc mở.
16. Icon đổi trạng thái phải giữ cùng một `AppIcon` đã mount và đổi semantic
    `name`; mọi `MorphIcon` dùng spring `snappy` và
    `reducedMotion="user"`. Không thêm entrance/infinite icon animation cho row
    danh sách hoặc để animation trì hoãn business state.

## 5. Lists, loading và refresh

- Dữ liệu dài hoặc tăng theo API dùng `FlatList`.
- Empty state phải đặt trong `ListEmptyComponent`; không thay toàn bộ list bằng `View` tĩnh nếu màn hình hỗ trợ pull-to-refresh.
- `contentContainerStyle` dùng `flexGrow: 1` khi danh sách rỗng/ngắn để gesture vẫn hoạt động.
- Refresh bất đồng bộ dùng `useAsyncRefresh`; hook chống request trùng và luôn reset spinner trong `finally`.
- Refresh screen-specific gọi đúng API. Các màn hình shop dùng `refreshShopAndBalances(true)`; screen asset/cache có thể dùng `fullBackgroundSync(true)`.
- Request chuyển season/tab cần request ID hoặc cancellation để response cũ không ghi đè selection mới.

## 6. Accessibility và responsive layout

- Button/pressable cần `accessibilityRole`, label khi icon-only và `accessibilityState` cho selected/disabled/busy.
- Icon trong button/tab đã có label là decorative; parent giữ role, label và
  state. Chỉ `AppIcon` icon-only mới truyền `label`, tạo đúng một accessibility
  node. Glyph game cũng đi qua `MorphIcon` và tuân cùng decorative/label policy.
- Text có thể dài phải có `numberOfLines` hoặc container co giãn đúng.
- Grid thay đổi số cột theo chiều rộng; không hard-code card width vượt viewport.
- Chỉ Match Session được landscape. Màn còn lại phải ổn định ở portrait và hỗ trợ tablet khi có thể.
- Màu trạng thái không được là tín hiệu duy nhất; thêm icon/text.

## 7. Kiểm tra trước build

Yêu cầu Node `>=22.13.0`, JDK 17 và pnpm theo repository.

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm dlx expo-doctor@1.20.3
pnpm run test:api
```

`test:api` cần mạng và chỉ kiểm tra public read-only endpoints. Nếu upstream tạm lỗi, ghi nhận riêng; không bỏ qua `pnpm run check`.

`check` chạy `check:source` (typecheck, lint, test/coverage, audit) rồi
`check:android` (Android export và bundle budget). Export dùng thư mục tạm
riêng dưới `.codex-tmp/` và tự dọn sau khi hoàn tất hoặc lỗi. Không cần chạy
export lần thứ hai; bản export không phải APK đã build/cài trên thiết bị.

`check:android` luôn đặt `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` và
`EXPO_UNSTABLE_TREE_SHAKING=1` cho Expo export. `eas.json` mang cùng hai biến ở
development, preview và production; `production-store` extends production nên
kế thừa cùng graph/tree-shaking contract. Không đo local export bằng một env rồi
build EAS bằng env khác.

EAS project `@hyeon004/vshop` production environment đã được set và verify cả
hai biến trên dưới dạng plaintext. Vì vậy future
`eas update --environment production` dùng cùng optimizer với export/build.
Đây chỉ là parity cấu hình: tuyệt đối không OTA source 4.1.9 phụ thuộc native
`react-native-svg` vào binary/runtime 4.1.8.

## 8. Versioning

Trước native release:

1. cập nhật cùng app version trong `package.json` và `app.json`;
2. tăng `expo.android.versionCode`;
3. tăng `expo.ios.buildNumber` nếu phát hành iOS;
4. cập nhật `CHANGELOG.md`; README chỉ giữ tính năng, kiến trúc và hướng dẫn,
   không nhúng lịch sử/changelog phát hành;
5. chạy `pnpm run check` (đã gồm Android export);
6. commit và push source đã kiểm chứng.

Runtime version dùng policy `appVersion`, vì vậy thay app version tạo runtime OTA mới.
Dependency native mới như `react-native-svg` bắt buộc tăng app/runtime version,
rebuild development/production binary và xác minh cài đặt trước khi publish.
Không được dùng OTA để đưa JavaScript phụ thuộc module native mới vào runtime cũ.

## 9. Production APK

Profile `production` trong `eas.json` tạo APK trên channel `production`:

```bash
pnpm dlx eas-cli@latest build --profile production --platform android
```

Profile `production-store` tạo AAB có thể phân phối theo ABI qua Play Store mà
không thay thế APK GitHub hiện tại:

```bash
pnpm dlx eas-cli@latest build --profile production-store --platform android
```

Để chạy không tương tác trên CI, cấu hình `EXPO_TOKEN` trong secret manager và thêm `--non-interactive`. Profile production dùng `credentialsSource: remote`; EAS Build cung cấp `credentials.json` và đặt `EAS_BUILD`, vì vậy guard local nhường quyền cho EAS integration. Ngoài EAS, release task vẫn fail-closed nếu thiếu bốn biến production keystore. Không phát hành output `assembleRelease` nếu Gradle đang dùng `debug.keystore`.

Sau khi build:

1. tải APK từ EAS dashboard/build URL;
2. kiểm tra package `com.android.vshop`, version name/code và chữ ký;
3. cài sạch trên thiết bị thật;
4. kiểm tra login, shop, profile, refresh, match history, TLS chat và update channel;
5. phát hành GitHub Release nếu smoke test đạt.

### Trạng thái source candidate 4.2.0

- Metadata: app/runtime `4.2.0`, Android `versionCode 92`, iOS `buildNumber 43`
  (không build iOS trong đợt này).
- Native refraction lens đã wire vào primary navigation qua
  `NativeRefraction.android.tsx`; gate: API 33+, `apiVersion 1`, foreground,
  tag hợp lệ, không Reduce Transparency; Reduce Motion chỉ tắt animation.
- Full gate PASS: 166 suite / 2367 test, audit, export 9,01/12 MiB tổng,
  7,79/8 MiB Hermes và asset 0,92/1,50 MiB. FPS/frame metrics trên máy thật
  chưa đo trong đợt này.

### Trạng thái source candidate 4.1.10

- Metadata: app/runtime `4.1.10`, Android `versionCode 91`, iOS `buildNumber 43`.
- Android primary scenes giữ attached sau preload; secondary scene freeze khi
  blur. Profile dashboard preload chỉ chạy sau focus/transition/idle.
- LoadingScreen và ErrorBoundary dùng `RecoveryUpdateActions` không phụ thuộc
  authenticated route/Paper Portal; update loop guard lưu metadata tối thiểu.
- Full gate PASS: 91 suite / 961 test, audit, export 10,18/12 MiB tổng,
  7,71/8 MiB Hermes và asset 1,25/1,50 MiB.
- Local release APK build bằng signer production hợp lệ; SHA-256
  `76A6F8DA4BBC73FB2A7B2628EB45E44A9906B4733F90297B63B041C0CA5E44B8`,
  signer match và zipalign 16 KiB PASS. Cài/metric thiết bị còn `NOT VERIFIED`
  vì ADB ngắt kết nối.

### Lịch sử source candidate 4.1.9

- Metadata nguồn: version/runtime `4.1.9`, Android `versionCode 90`, iOS
  `buildNumber 42`.
- Migration AppIcon đã hoàn tất ở source: không còn MaterialCommunityIcons
  runtime; `morphicons/react-native` chỉ được import trong `AppIcon.tsx`, còn
  runtime deep ESM imports của `lucide@1.47.0` chỉ nằm trong
  `app-icon-lucide.ts`. Mọi entry registry, gồm custom local Pistol `IconNode`,
  có `kind: "morph"`.
- Lần `pnpm run check` đầy đủ đầu tiên đạt strict TypeScript, ESLint không
  warning, production audit policy và 87 Jest suite / 909 test, rồi fail budget
  Hermes ở 8,79/8,00 MiB. Chỉ deep import giảm còn 8,26 MiB, vẫn fail.
- Android gate cuối với Expo optimized graph/tree shaking PASS: tổng
  10,16/12 MiB, Hermes 7,69/8 MiB, asset lớn nhất 1,25/1,50 MiB. Đây là static
  export/budget evidence, không phải native APK evidence.
- EAS project `@hyeon004/vshop` production environment đã set/verify hai
  optimizer vars dạng plaintext; future `eas update --environment production`
  dùng cùng graph/tree shaking. 4.1.9 vẫn không được OTA vào runtime 4.1.8.
- 21 Mermaid diagram, 138 local link và `git diff --check` PASS.
- Development/production native build, artifact URL, APK install, device flows,
  TalkBack/VoiceOver, Reduce Motion on-device, frame metrics và logcat 4.1.9 đều
  **NOT VERIFIED**. Không có OTA/build/artifact 4.1.9 được tuyên bố.

### Bằng chứng release 4.1.8

- Version/runtime `4.1.8`, Android `versionCode 89`, iOS `buildNumber 41`.
- EAS production build [`6e0a0273-9bac-46c5-b1d8-66c230b24557`](https://expo.dev/accounts/hyeon004/projects/vshop/builds/6e0a0273-9bac-46c5-b1d8-66c230b24557) từ commit source `7e42d64` đã `FINISHED` trên channel `production` và xuất APK ký cho `com.android.vshop`.
- Artifact GitHub: [`VShop-4.1.8-production-89.apk`](https://github.com/GinzaTech/Vshop/releases/download/v4.1.8/VShop-4.1.8-production-89.apk), 131.262.994 byte, SHA-256 `554AE2715CE64639413CD98F5318B26E23D6803A66B1CFD4303749F737157224`; `apksigner` xác minh APK Signature Scheme v2 với một signer.
- `pnpm run check` đạt 73 suite / 770 test, strict TypeScript, ESLint không warning, audit policy và Android export/budget 9,91 MiB/7,44 MiB; Expo Doctor đạt 21/21. Build/asset GitHub không thay thế kiểm tra cài đặt trên thiết bị.
- Không có thiết bị ADB kết nối sau khi artifact production hoàn tất, nên cài đặt/runtime production là **NOT VERIFIED**; kiểm thử UI máy thật của release này dùng development client cùng native version 4.1.8/code89.

## 10. Artifact policy

- Không commit APK/AAB, mapping, native build output hoặc credential.
- Artifact local đặt ngoài repository hoặc thư mục đã ignore.
- Ghi build URL, build ID, version và checksum trong release notes/handoff thay vì đưa binary vào Git.
