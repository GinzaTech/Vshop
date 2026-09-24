# Morphicons System — Design Specification

**Ngày:** 2026-09-23
**Trạng thái:** approved — source migration và optimized Android export hoàn tất; native build/device còn chờ xác minh
**Phạm vi:** Expo/React Native VShop, Android/iOS/web boundary, toàn bộ icon UI

## 1. Mục tiêu

Chuẩn hoá toàn bộ icon của VShop qua một API nội bộ duy nhất và dùng Morphicons
cho các chuyển đổi trạng thái có ý nghĩa. Kết quả phải tạo cảm giác liền mạch mà
không biến mọi icon thành animation trang trí, không phá TalkBack/VoiceOver,
không bỏ qua Reduce Motion và không tăng budget Hermes hiện tại.

“Toàn bộ icon” trong spec này có nghĩa:

- source runtime không còn import MaterialCommunityIcons, kể cả trong `AppIcon`;
- mọi icon UI đi qua `AppIcon` và được render bằng `MorphIcon`;
- icon thay đổi trạng thái morph giữa hai hình tương ứng;
- icon tĩnh vẫn dùng cùng `AppIcon` nhưng không tự morph vô cớ;
- hình game đặc thù dùng Lucide `IconNode` phù hợp hoặc vector data local; pistol
  dùng custom local `IconNode`, không dùng fallback icon font.

## 2. Bối cảnh và ràng buộc đã xác minh

- Source hiện có khoảng 196 điểm dùng icon trong 44 file React Native.
- Runtime dùng React Native 0.86.3, React 19.2.3 và Reanimated 4.5.1.
- `morphicons` 1.7.1 có entry `morphicons/react-native`, là ESM-only, nhận
  `IconNode`/path data và render qua `react-native-svg`; nó không nhận component
  từ MaterialCommunityIcons.
- Binding React Native yêu cầu `react-native-svg >= 14`; project pin bản Expo
  tương thích `15.15.4`.
- Morphicons không cung cấp bộ hình; cần package `lucide` dạng data, không dùng
  `lucide-react-native` component package.
- `lucide` được exact-pin ở `1.47.0` vì runtime dùng internal deep ESM path;
  Jest cần transform `.mjs` bằng Expo transformer.
- Lần full check đầu đạt source/audit và 87 suite / 909 test nhưng export fail
  Hermes 8,79/8,00 MiB. Chỉ deep import giảm còn 8,26 MiB; optimized graph/tree
  shaking cuối cùng đạt 7,69/8 MiB mà không tăng threshold.
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
Lucide `IconNode` hoặc custom local vector nào đứng sau token đó.

### 3.2 Registry và tree shaking

`components/ui/app-icon-registry.ts` chỉ import icon data từ
`components/ui/app-icon-lucide.ts`. Boundary Lucide dùng import chính xác
`lucide/dist/esm/icons/*.mjs`; đây là nơi duy nhất được phép có runtime deep ESM
import. Không dùng runtime barrel hoặc `import * as Icons` vì Metro kéo toàn bộ
catalog và vượt bundle budget.

Registry chứa:

- semantic name;
- Lucide hoặc local `IconNode` morphable;
- metadata fill tối thiểu cho trạng thái dùng cùng path;
- semantic type suy ra trực tiếp từ key registry.

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

Morphicons là engine cho stroke path và đặt `fill="none"` mặc định. Trạng thái
wishlist outline ↔ selected là ngoại lệ có chủ đích: dùng cùng path Heart đúng
nghĩa và đổi SVG `fill` từ `none` sang màu hiện tại; không thay bằng HeartPlus/
HeartMinus sai nghĩa. Motion nhấn hiện có vẫn cung cấp phản hồi, còn path không
giả morph khi hình học thực tế không đổi.

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

### 3.6 Vector morphable cho icon game đặc thù

Những hình như pistol, rank crest, agent role hoặc Valorant taxonomy không được
ép sang một Lucide glyph sai nghĩa. Rank/role dùng `IconNode` phù hợp đã review;
pistol dùng neutral sidearm silhouette khai báo local trong
`app-icon-lucide.ts`. Tất cả vẫn đi qua cùng registry → `AppIcon` → `MorphIcon`
pipeline, nên không có nhánh MaterialCommunityIcons hoặc crossfade fallback.

## 4. Dependency và native boundary

Dùng pnpm theo repository:

```bash
pnpm add morphicons@1.7.1 lucide@1.47.0 react-native-svg@15.15.4
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
6. dynamic icon maps + custom game-specific `IconNode`;
7. xoá toàn bộ runtime MaterialCommunityIcons import, cô lập deep ESM Lucide và
   audit bundle.

Mỗi phase giữ semantic key ổn định để review diff, không đổi layout/copy cùng lúc.

## 6. Kiểm thử

### Unit/component

- mọi semantic token resolve đúng morphable `IconNode`;
- token lạ resolve `unknown` an toàn;
- cùng một `AppIcon` đổi semantic `name` tạo MorphIcon transition;
- icon tĩnh không tự animate lại khi parent re-render;
- `reducedMotion="user"` luôn được truyền;
- decorative/icon-only accessibility không tạo node trùng;
- dynamic maps không nhận raw string ngoài registry.

### Integration/source policy

- source test cấm mọi import `@expo/vector-icons/MaterialCommunityIcons`;
- source test cấm `import * as` và runtime barrel import từ `lucide`;
- source test chỉ cho deep Lucide runtime import trong `app-icon-lucide.ts`;
- source test kiểm mọi icon-only Pressable có semantic label ở parent;
- typecheck/lint không warning.

### Build và device

- `pnpm run check`;
- Expo Doctor;
- Android export và Hermes ≤ 8 MiB, tổng ≤ 12 MiB;
- Android export dùng `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` và
  `EXPO_UNSTABLE_TREE_SHAKING=1`; EAS development/preview/production dùng cùng
  env và `production-store` kế thừa production;
- EAS project `@hyeon004/vshop` production environment set/verify hai giá trị
  trên dạng plaintext để future `eas update --environment production` dùng cùng
  optimizer; parity này không thay đổi native runtime compatibility;
- native development build cài được và load `react-native-svg`;
- test current/selected/expanded/loading flows trên Android 60 Hz;
- logcat không có FATAL/ANR/SIGSEGV;
- đo frame metrics riêng cho navigation và Profile state morph;
- kiểm Reduce Motion và TalkBack thủ công.

## 7. Bundle và hiệu năng

- Exact deep ESM Lucide imports chỉ được phép trong `app-icon-lucide.ts`;
  `lucide` phải giữ pin `1.47.0`.
- Không dùng CommonJS/runtime barrel hoặc tạo registry bằng dynamic lookup trên
  toàn package.
- Production tiếp tục strip DEV fixtures/flow tracing.
- Application source không import MaterialCommunityIcons runtime cho AppIcon;
  pistol là local `IconNode` nên không cần icon-font fallback. Expo export vẫn
  chứa `MaterialCommunityIcons.ttf` từ dependency khác; asset này tiếp tục được
  tính trong budget và không được tuyên bố đã loại bỏ.
- Không tăng budget. Nếu vượt, giảm dependency/import và bật cùng Expo optimized
  graph/tree-shaking contract ở local/EAS; không sửa threshold.
- Morphicons cập nhật `d` bằng `setNativeProps`, tránh React render mỗi frame;
  vẫn phải đo thiết bị vì số lượng icon đồng thời có thể lớn.

## 8. Error handling và rollback

- Nếu icon token thiếu, render `unknown` và cảnh báo sanitized chỉ trong dev.
- Nếu SVG/native module không load, development build gate phải fail; không tạo
  fallback im lặng làm production trắng icon.
- Mỗi phase là diff độc lập có thể revert mà không đổi business state.
- Chỉ bỏ MaterialCommunityIcons runtime path sau khi source-policy test xác nhận
  zero import và mọi registry entry đều là `kind: "morph"`.

## 9. Trạng thái xác minh 2026-09-24

- Task 1–6 đã hoàn tất ở source qua các commit `2cf5c81`, `6a58686`,
  `6704fa9`, `f6c684c`, `6ffa86f`, `7b27218`, `a632fb9`, `f8d11c9` và
  `a384b78`: dependency được pin, boundary/registry có type và mọi domain đã
  migrate khỏi direct vendor import.
- Task 7 đã khóa metadata source candidate ở 4.1.9/Android 90/iOS 42. Source
  policy hiện yêu cầu zero MaterialCommunityIcons import, chỉ `AppIcon.tsx`
  import `morphicons/react-native`, và chỉ `app-icon-lucide.ts` chứa runtime deep
  ESM Lucide imports. Pistol là local `IconNode`; mọi registry entry là morph.
- Lần `pnpm run check` đầu đạt strict TypeScript, zero-warning ESLint,
  production audit policy và 87 Jest suite / 909 test, nhưng toàn lệnh fail ở
  Hermes 8,79/8,00 MiB. Deep-import-only đạt 8,26 MiB, vẫn fail.
- Gate Android cuối bật Expo optimized graph/tree shaking và PASS ở
  10,16/12 MiB tổng, 7,69/8 MiB Hermes, 1,25/1,50 MiB asset lớn nhất. Cùng env
  được khai báo cho các EAS profile. EAS project `@hyeon004/vshop` production
  environment cũng đã set/verify hai plaintext vars cho future
  `eas update --environment production`. Jest đã transform `.mjs` qua Expo
  preset.
- 21 Mermaid diagram, 138 local link và `git diff --check` PASS.
- Development/production native build, APK install, device interaction, Reduce
  Motion/TalkBack/VoiceOver thủ công, frame metrics và logcat 4.1.9 đều
  **NOT VERIFIED**. Static export/config parity không phải APK/device proof và
  tuyệt đối không cho phép OTA 4.1.9 vào binary/runtime 4.1.8; không có OTA, EAS
  build, artifact, commit hay push 4.1.9 được tuyên bố.

## 10. Acceptance criteria

- [x] Không còn runtime import MaterialCommunityIcons trong AppIcon/app/component/
  feature code.
- [x] Mọi icon UI dùng semantic token typed.
- [x] Mọi control có state dùng cặp morph hợp lệ; icon tĩnh không animation vô cớ.
- [ ] Reduce Motion, TalkBack/VoiceOver và touch target đạt policy VShop.
- [x] Game-specific icon giữ đúng nghĩa qua morphable `IconNode`; pistol dùng
  vector local.
- [x] Typecheck, lint, 87 suite / 910 test, audit và final Android export gate
  PASS; lần full-check đầu fail budget được ghi riêng, không bị gọi nhầm là pass.
- [x] Optimized export đạt Hermes 7,69/8 MiB, total 10,16/12 MiB và largest
  asset 1,25/1,50 MiB.
- [ ] Development APK mới chạy trên thiết bị và các flow chính không crash/jank
  nghiêm trọng.
- [x] README, CHANGELOG, design-system và diagram/package docs được cập nhật.

## 11. Ngoài phạm vi

- Không redesign layout, màu hoặc typography trong cùng migration.
- Không morph ảnh skin/agent/rank raster.
- Không tự động animate icon từ dữ liệu list không có state transition.
- Không publish OTA/production build trước khi native version được bump và binary
  mới hoàn tất.
