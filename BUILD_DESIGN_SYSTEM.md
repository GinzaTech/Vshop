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

Không tạo nhiều giá trị lệch 1–2 px nếu không có lý do layout cụ thể. Khi xuất hiện từ ba lần trở lên, nâng giá trị thành token hoặc primitive.

## 3. UI primitives

| Primitive | Vai trò |
|---|---|
| `GlassCard` | tonal surface có border và shadow `xs`; không blur mặc định |
| `ValorantButton` | button chính/phụ với press feedback |
| `InfoPill` | metric, balance hoặc badge dạng pill |
| `PageIntro` | title/subtitle đầu màn hình |
| `SectionHeader` | tiêu đề section và action/meta |
| `EmptyStateCard` | trạng thái rỗng có nội dung hướng dẫn |
| `TwoColumnGrid` | grid nhỏ có số lượng item hữu hạn |
| `AnimatedNumber` | chuyển đổi số có kiểm soát |
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
pnpm exec expo export --platform android --output-dir .expo-production-check
```

`test:api` cần mạng và chỉ kiểm tra public read-only endpoints. Nếu upstream tạm lỗi, ghi nhận riêng; không bỏ qua `pnpm run check`.

## 8. Versioning

Trước native release:

1. cập nhật cùng app version trong `package.json` và `app.json`;
2. tăng `expo.android.versionCode`;
3. tăng `expo.ios.buildNumber` nếu phát hành iOS;
4. cập nhật `CHANGELOG.md` và release highlights trong `README.md`;
5. chạy check + Android export;
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

## 10. Artifact policy

- Không commit APK/AAB, mapping, native build output hoặc credential.
- Artifact local đặt ngoài repository hoặc thư mục đã ignore.
- Ghi build URL, build ID, version và checksum trong release notes/handoff thay vì đưa binary vào Git.
