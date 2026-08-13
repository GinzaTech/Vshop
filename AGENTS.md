# VShop coding rules

Các quy tắc trong file này áp dụng cho toàn bộ repository. Mọi thay đổi code, tài liệu, test và build phải tuân thủ các ràng buộc dưới đây.

## 1. Công cụ và phạm vi

- Dùng `pnpm` theo `packageManager` trong `package.json`; không tạo `package-lock.json`, `yarn.lock` hoặc `bun.lockb`.
- TypeScript phải giữ `strict: true`. Không dùng `any` mới nếu có thể mô tả bằng type cụ thể hoặc `unknown` + type guard.
- Không sửa hoặc xóa thay đổi chưa liên quan của người khác. Không dùng `git reset --hard`, `git clean -fd` hoặc checkout phá hủy worktree.
- Không commit token Riot, cookie, signing key, `.env`, APK, thư mục build, log hoặc cache.
- `android/` và `ios/` là output Expo prebuild đang bị ignore. Cấu hình ứng dụng phải bắt đầu từ `app.json`, plugin Expo và source TypeScript.

## 2. Kiến trúc bắt buộc

Luồng phụ thuộc chuẩn:

```text
route -> component/store -> service -> HTTP client -> upstream API
                         -> cache/domain helper
```

- `app/` chỉ chứa route và điều phối UI. Không import `axios`, không hard-code URL và không giữ transport dài hạn trong screen.
- URL Riot chỉ được tạo bởi `services/riot/endpoints.ts`; request Riot dùng `services/riot/client.ts` hoặc facade trong `utils/valorant-api.ts`.
- API công khai `valorant-api.com` phải đi qua `services/valorant/public-api.ts`.
- Không thay đổi `axios.defaults`. Mỗi nhóm upstream dùng client và timeout riêng trong `services/http/clients.ts`.
- Endpoint động phải validate region, kiểm tra tham số bắt buộc và encode ID/query.
- Logic dùng lại phải chuyển vào `utils/`, `services/`, `hooks/` hoặc `components/`; không sao chép cùng một luồng fetch vào nhiều screen.
- State chia sẻ dùng Zustand store hiện có. Cập nhật store phải giữ dữ liệu phiên mới nhất để tránh ghi đè token hoặc cache vừa được làm mới.

## 3. API, session và dữ liệu

- Mọi request Riot cần truyền đúng access token, entitlements token, region và user ID theo contract endpoint.
- 401/403 chỉ được coi là lỗi phiên khi đến từ Riot host hợp lệ; dùng cơ chế session event hiện có thay vì redirect rải rác trong screen.
- Request có thể trùng phải có deduplication, request ID hoặc cache phù hợp. Response cũ không được ghi đè lựa chọn mới của người dùng.
- Pull-to-refresh phải gọi dữ liệu thật. Dùng `useAsyncRefresh` và `AppRefreshControl`; giữ `FlatList`/`ScrollView` tồn tại cả khi empty state.
- Không tự động smoke-test endpoint làm thay đổi tài khoản thật như queue, lock agent, quit game, party, loadout hoặc purchase.
- Lỗi mạng tạm thời phải giữ cache đang hiển thị khi có thể; không xóa dữ liệu tốt chỉ vì một lần refresh thất bại.

## 4. Design system và UI

- Màu, radius và style nền dùng `constants/DesignSystem.ts`. Không tạo màu gần giống token hiện có trong screen mới.
- Motion dùng `constants/Motion.ts`. Animation tương tác ưu tiên transform/opacity trên UI thread bằng Reanimated.
- Mọi animation lặp, entrance hoặc decoration phải tôn trọng Reduce Motion của hệ điều hành.
- Component dùng lại đặt trong `components/ui/`; screen không tự dựng lại card, button, empty state hoặc refresh control đã có primitive.
- Danh sách lớn dùng `FlatList`; tránh `ScrollView` + `.map()` khi dữ liệu có thể tăng không giới hạn.
- Ảnh mạng dùng `CachedImage`/`expo-image`, có cache key ổn định và kích thước layout xác định trước để tránh nhảy bố cục.
- `BlurView` Android dùng API mới: cấu hình `blurTarget`, dùng `blurMethod`, không dùng `experimentalBlurMethod`.
- Thành phần tương tác phải có role/state accessibility, vùng chạm hợp lý và trạng thái disabled/loading rõ ràng.
- Xem chuẩn đầy đủ tại `BUILD_DESIGN_SYSTEM.md`.

## 5. Hiệu năng và nền tảng

- Không chạy tác vụ nặng đồng bộ trong render hoặc effect đầu tiên nếu có thể đưa qua idle task/background wave.
- Memoization chỉ dùng khi có lợi ích đo được; dependency phải đầy đủ và snapshot selector Zustand phải ổn định.
- Luôn cleanup timer, listener, subscription, animation và request task khi unmount.
- Module native phải có boundary/fallback cho web hoặc Expo Go nếu route có thể được bundle trên các nền tảng đó.
- Match Session là màn hình duy nhất được phép khóa landscape; phải trả orientation về portrait khi rời màn hình.

## 6. Kiểm tra bắt buộc

Trước khi bàn giao hoặc commit một thay đổi code:

```bash
pnpm run check
pnpm exec expo export --platform android --output-dir <temporary-directory>
```

- API/endpoint mới hoặc sửa URL phải có contract test trong `__tests__/`.
- Helper có sorting, filtering, cache key hoặc race behavior phải có unit test.
- ESLint chạy với `--max-warnings=0`; không tắt rule mới để che lỗi cục bộ nếu có thể sửa code.
- Thư mục export/build tạm phải được dọn khỏi workspace sau khi xác minh.

## 7. Release và Git

- Version nguồn nằm trong `package.json` và `app.json`; Android `versionCode` và iOS `buildNumber` phải tăng cho native release mới.
- Production APK dùng EAS profile `production` trong `eas.json`. Không phát hành APK release ký bằng debug keystore từ Gradle local.
- Cập nhật `CHANGELOG.md`, `README.md` và tài liệu kiến trúc khi release thay đổi hành vi, dependency hoặc cấu trúc.
- Commit phải có phạm vi rõ ràng, message mô tả đúng file/thay đổi và chỉ được push sau khi toàn bộ kiểm tra đạt.
- Không force-push nhánh chia sẻ nếu người dùng không yêu cầu rõ ràng.
