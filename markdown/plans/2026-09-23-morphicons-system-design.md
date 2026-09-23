# Morphicons System — Design Specification

**Ngày:** 2026-09-23
**Trạng thái:** approved — user duyệt ngày 2026-09-23
**Phạm vi:** Expo/React Native VShop, Android/iOS/web boundary, toàn bộ icon UI

## 1. Mục tiêu

Chuẩn hoá toàn bộ icon của VShop qua một API nội bộ duy nhất và dùng Morphicons
cho các chuyển đổi trạng thái có ý nghĩa. Kết quả phải tạo cảm giác liền mạch mà
không biến mọi icon thành animation trang trí, không phá TalkBack/VoiceOver,
không bỏ qua Reduce Motion và không tăng budget Hermes hiện tại.

“Toàn bộ icon” trong spec này có nghĩa:

- mọi screen/component không còn import trực tiếp MaterialCommunityIcons;
- icon UI chuẩn đi qua `AppIcon` và dùng Lucide icon data;
- icon thay đổi trạng thái morph giữa hai hình tương ứng;
- icon tĩnh vẫn dùng cùng `AppIcon` nhưng không tự morph vô cớ;
- hình game đặc thù không có Lucide tương đương dùng fallback có kiểm soát bên
  trong `AppIcon`, không tạo đường import riêng ở screen.

## 2. Bối cảnh và ràng buộc đã xác minh

- Source hiện có khoảng 196 điểm dùng icon trong 44 file React Native.
- Runtime dùng React Native 0.86.3, React 19.2.3 và Reanimated 4.5.1.
- `morphicons` 1.7.1 có entry `morphicons/react-native`, là ESM-only, nhận
  `IconNode`/path data và render qua `react-native-svg`; nó không nhận component
  từ MaterialCommunityIcons.
- Binding React Native yêu cầu `react-native-svg >= 14`; project chưa khai báo
  dependency này trực tiếp.
- Morphicons không cung cấp bộ hình; cần package `lucide` dạng data, không dùng
  `lucide-react-native` component package.
- Android export hiện 7,99/8,00 MiB Hermes. Không tăng threshold để hợp thức hoá
  dependency mới.
- `react-native-svg` là native dependency nên development client và production
  binary phải được build lại; OTA không đủ.

## 3. Quyết định kiến trúc

### 3.1 API duy nhất

Tạo `components/ui/AppIcon.tsx` làm boundary duy nhất cho icon runtime:

```tsx
<AppIcon name="search" size={20} color={color} />

<AppIcon
  name={searchVisible ? "close" : "search"}
  size={20}
  color={color}
/>
```

Contract dự kiến:

```ts
type AppIconName = keyof typeof APP_ICON_REGISTRY;

type AppIconProps = {
  name: AppIconName;
  size: number;
  color: string;
  strokeWidth?: number;
  label?: string;
  decorative?: boolean;
  testID?: string;
};
```

`name` là semantic token của VShop, không phải tên vendor. Screen không biết
Lucide hay fallback nào đứng sau token đó.

### 3.2 Registry và tree shaking

Tạo `components/ui/app-icon-registry.ts` với named imports từ `lucide`. Không
`import * as Icons` vì sẽ làm mất tree shaking và vượt bundle budget.

Registry chứa:

- semantic name;
- Lucide `IconNode` mặc định;
- optional fallback cho hình không có bản tương đương chính xác;
- metadata `morphGroup` dùng để review cặp chuyển đổi hợp lệ.

Registry phải là nguồn duy nhất. Dynamic string từ API/store được normalize qua
type guard; giá trị lạ dùng token `unknown`, không được truy cập object tùy ý.

### 3.3 Khi nào morph

Morph chỉ chạy khi cùng một control đổi trạng thái:

- menu ↔ close;
- search ↔ close;
- heart ↔ heart-filled;
- chevron-down ↔ chevron-up;
- radio-off ↔ radio-on;
- ready ↔ cancel;
- collapsed ↔ expanded;
- tab/navigation icon cũ ↔ icon mới trong cùng indicator;
- retry/refresh ↔ success hoặc error khi có state machine rõ ràng.

Không morph giữa hai icon ở hai vị trí khác nhau, không morph dữ liệu list chỉ
vì re-render và không chạy entrance liên tục. Icon tĩnh render ở trạng thái cuối.

### 3.4 Motion policy

- Mọi `MorphIcon` truyền `reducedMotion="user"`.
- Spring mặc định `snappy`; chỉ registry/component cấp cao được đổi preset.
- Animation không sở hữu business state; state đổi trước, morph phản ánh state.
- Không thêm timer lặp hoặc animation vô hạn. Loading spinner hiện có tiếp tục
  dùng primitive phù hợp thay vì morph hai hình liên tục.
- Press feedback scale/opacity vẫn chạy trên UI thread bằng motion token hiện có;
  Morphicons chỉ chịu trách nhiệm path interpolation.

### 3.5 Accessibility

- Icon nằm trong button/tab mặc định là decorative; parent giữ
  `accessibilityRole`, `accessibilityLabel`, `accessibilityState` và touch target.
- Icon-only control phải truyền `label`; `AppIcon` không tạo hai accessibility
  node trùng với parent.
- State selected/expanded/checked nằm trên control, không suy ra từ hình icon.
- Reduce Motion hệ điều hành làm morph đổi tức thời.
- Touch target Android tối thiểu 48 dp, iOS tối thiểu 44 pt được giữ ở parent.

### 3.6 Fallback cho icon game đặc thù

Những hình như pistol, rank crest, agent role hoặc Valorant taxonomy không được
ép sang Lucide nếu làm sai nghĩa. Chúng dùng một trong hai dạng:

1. asset/image game hiện có;
2. MaterialCommunityIcons fallback nằm duy nhất trong implementation `AppIcon`.

Fallback không morph path với Lucide. Khi state đổi, nó crossfade/instant swap
theo Reduce Motion. Mục tiêu cuối là không còn import vendor icon trực tiếp ngoài
boundary này.

## 4. Dependency và native boundary

Dùng pnpm theo repository:

```bash
pnpm add morphicons@1.7.1 lucide react-native-svg
```

Trước implementation plan phải xác minh version `react-native-svg` tương thích
Expo SDK 57 bằng `expo install --check`; nếu Expo pin version khác, dùng version
Expo đề xuất thay vì ép latest.

Sau dependency change:

- chạy Expo Doctor;
- chạy prebuild/compile gate hiện có;
- build development APK mới trước device test;
- tăng native versionCode/buildNumber trước production release;
- không phát hành bằng OTA lên runtime chưa có `react-native-svg`.

## 5. Chiến lược migration

Migration theo domain, mỗi phase vẫn compile và test được:

1. dependency + `AppIcon` + registry + unit tests;
2. primary navigation, global header, Loading/Retry và shared primitives;
3. Profile/Match Detail/History;
4. Store/Shop/Bundle/Gallery/Item Upgrades;
5. Combat/Friends/Chat/Settings và modal;
6. dynamic icon maps + game-specific fallback;
7. xoá import MaterialCommunityIcons khỏi screen/component và audit bundle.

Mỗi phase giữ semantic key ổn định để review diff, không đổi layout/copy cùng lúc.

## 6. Kiểm thử

### Unit/component

- mọi semantic token resolve đúng icon hoặc fallback;
- token lạ resolve `unknown` an toàn;
- cùng một `AppIcon` đổi semantic `name` tạo MorphIcon transition;
- icon tĩnh không tự animate lại khi parent re-render;
- `reducedMotion="user"` luôn được truyền;
- decorative/icon-only accessibility không tạo node trùng;
- dynamic maps không nhận raw string ngoài registry.

### Integration/source policy

- source test cấm import trực tiếp `@expo/vector-icons/MaterialCommunityIcons`
  ngoài `AppIcon` fallback;
- source test cấm `import * as` từ `lucide`;
- source test kiểm mọi icon-only Pressable có semantic label ở parent;
- typecheck/lint không warning.

### Build và device

- `pnpm run check`;
- Expo Doctor;
- Android export và Hermes ≤ 8 MiB, tổng ≤ 12 MiB;
- native development build cài được và load `react-native-svg`;
- test current/selected/expanded/loading flows trên Android 60 Hz;
- logcat không có FATAL/ANR/SIGSEGV;
- đo frame metrics riêng cho navigation và Profile state morph;
- kiểm Reduce Motion và TalkBack thủ công.

## 7. Bundle và hiệu năng

- Named Lucide imports là bắt buộc.
- Không tạo registry bằng runtime string lookup trên toàn package.
- Production tiếp tục strip DEV fixtures/flow tracing.
- Sau migration, kiểm xem font MaterialCommunityIcons còn consumer nào; chỉ bỏ
  asset/import khi không còn consumer runtime.
- Không tăng budget. Nếu vượt, giảm dependency/import hoặc giữ fallback tĩnh;
  không sửa threshold.
- Morphicons cập nhật `d` bằng `setNativeProps`, tránh React render mỗi frame;
  vẫn phải đo thiết bị vì số lượng icon đồng thời có thể lớn.

## 8. Error handling và rollback

- Nếu icon token thiếu, render `unknown` và cảnh báo sanitized chỉ trong dev.
- Nếu SVG/native module không load, development build gate phải fail; không tạo
  fallback im lặng làm production trắng icon.
- Mỗi phase là diff độc lập có thể revert mà không đổi business state.
- Không xoá MaterialCommunityIcons dependency/fallback trước khi source audit đạt.

## 9. Acceptance criteria

- [ ] Không còn import MaterialCommunityIcons trực tiếp trong app/component/
  feature code ngoài icon boundary.
- [ ] Mọi icon UI dùng semantic token typed.
- [ ] Mọi control có state dùng cặp morph hợp lệ; icon tĩnh không animation vô cớ.
- [ ] Reduce Motion, TalkBack/VoiceOver và touch target đạt policy VShop.
- [ ] Game-specific icon giữ đúng nghĩa qua fallback có kiểm soát.
- [ ] Full tests, lint, typecheck, audit và Android export PASS.
- [ ] Hermes không vượt 8 MiB; total export không vượt 12 MiB.
- [ ] Development APK mới chạy trên thiết bị và các flow chính không crash/jank
  nghiêm trọng.
- [ ] README, CHANGELOG, design-system và diagram/package docs được cập nhật.

## 10. Ngoài phạm vi

- Không redesign layout, màu hoặc typography trong cùng migration.
- Không morph ảnh skin/agent/rank raster.
- Không tự động animate icon từ dữ liệu list không có state transition.
- Không publish OTA/production build trước khi native version được bump và binary
  mới hoàn tất.
