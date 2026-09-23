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
- Bottom navigation phải tham gia layout của navigator, không đặt absolute phủ lên screen content.
- Scene của tab chính dùng native detach sau chuyển cảnh, giữ React state. Nền design system nằm trong PrimaryTabScene và ẩn cùng nội dung khi mất focus; nền navigator phải trong suốt để không che bạc trang mới. Chuyển tab dùng native transform tối đa 32 dp trong 220 ms, scene mới fade nhẹ từ opacity 0.92. Indicator chỉ khởi động một lần cho mỗi đích, không restart khi route xác nhận. Bấm tab khác đổi đích ngay và Reduce Motion chuyển tức thời.

Không tạo nhiều giá trị lệch 1–2 px nếu không có lý do layout cụ thể. Khi xuất hiện từ ba lần trở lên, nâng giá trị thành token hoặc primitive.

## 3. UI primitives

| Primitive | Vai trò |
|---|---|
| `GlassCard` | tonal surface có border và shadow `xs`; không blur mặc định |
| `ValorantButton` | button chính/phụ với press feedback |
| `InfoPill` | metric, balance hoặc badge dạng pill |
| `PageIntro` | title/subtitle đầu màn hình |
| `EmptyStateCard` | trạng thái rỗng có nội dung hướng dẫn |
| `TwoColumnGrid` | grid nhỏ có số lượng item hữu hạn |
| `AppRefreshControl` | pull-to-refresh đồng nhất Android/iOS |

Trước khi tạo component mới, kiểm tra `components/ui/`. Primitive không được chứa domain logic hoặc tự gọi Riot API.

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

## 5. Lists, loading và refresh

- Dữ liệu dài hoặc tăng theo API dùng `FlatList`.
- Empty state phải đặt trong `ListEmptyComponent`; không thay toàn bộ list bằng `View` tĩnh nếu màn hình hỗ trợ pull-to-refresh.
- `contentContainerStyle` dùng `flexGrow: 1` khi danh sách rỗng/ngắn để gesture vẫn hoạt động.
- Refresh bất đồng bộ dùng `useAsyncRefresh`; hook chống request trùng và luôn reset spinner trong `finally`.
- Refresh screen-specific gọi đúng API. Các màn hình shop dùng `refreshShopAndBalances(true)`; screen asset/cache có thể dùng `fullBackgroundSync(true)`.
- Request chuyển season/tab cần request ID hoặc cancellation để response cũ không ghi đè selection mới.

## 6. Accessibility và responsive layout

- Button/pressable cần `accessibilityRole`, label khi icon-only và `accessibilityState` cho selected/disabled/busy.
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

## 8. Versioning

Trước native release:

1. cập nhật cùng app version trong `package.json` và `app.json`;
2. tăng `expo.android.versionCode`;
3. tăng `expo.ios.buildNumber` nếu phát hành iOS;
4. cập nhật `CHANGELOG.md` và release highlights trong `README.md`;
5. chạy `pnpm run check` (đã gồm Android export);
6. commit và push source đã kiểm chứng.

Runtime version dùng policy `appVersion`, vì vậy thay app version tạo runtime OTA mới.

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

Để chạy không tương tác trên CI, cấu hình `EXPO_TOKEN` trong secret manager và thêm `--non-interactive`. Signing credential phải do EAS hoặc release keystore hợp lệ quản lý; không phát hành output `assembleRelease` nếu Gradle đang dùng `debug.keystore`.

Sau khi build:

1. tải APK từ EAS dashboard/build URL;
2. kiểm tra package `com.android.vshop`, version name/code và chữ ký;
3. cài sạch trên thiết bị thật;
4. kiểm tra login, shop, profile, refresh, match history, TLS chat và update channel;
5. phát hành GitHub Release nếu smoke test đạt.

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
