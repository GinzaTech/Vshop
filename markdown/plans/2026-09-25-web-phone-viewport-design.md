# VShop Web Phone Viewport — Design

**Ngày:** 2026-09-25

**Trạng thái:** approved — người dùng yêu cầu triển khai responsive giống điện
thoại và đã cho phép tự review plan/triển khai trong cùng workflow

**Workspace:** `C:\Users\kona\Desktop\Project\Vshop`

## 1. Mục tiêu

Khi VShop Expo Web chạy trên máy tính, toàn bộ app phải giữ cùng kích thước và
breakpoint như một điện thoại thay vì dùng toàn bộ chiều rộng desktop. Mục tiêu
là kiểm thử UI, gesture, pager, bottom navigation và các màn đăng nhập với layout
gần bản Android nhất có thể mà không cần sửa riêng từng screen.

Acceptance criteria:

1. Cửa sổ web rộng hơn `430 CSS px` hiển thị app trong một viewport rộng đúng
   `430 px`, căn giữa và có gutter hai bên.
2. Cửa sổ web từ `320–430 px` dùng toàn bộ chiều rộng hiện có; không ép min-width
   và không sinh horizontal scroll ở root.
3. Mọi logic đang phụ thuộc `useWindowDimensions()` nhận chiều rộng hiệu dụng
   của app (`min(browserWidth, 430)`) để pager, grid, card và tab bar không tiếp
   tục tính theo chiều rộng desktop.
4. Android/iOS giữ nguyên `width`, `height`, `scale` và `fontScale` thật của
   thiết bị.
5. Root loading/recovery overlay, React Navigation stack, Paper portal và các
   route setup/reauth/authenticated cùng nằm trong một viewport.
6. Demo Profile, Match History và Match Details hiển thị đúng ở browser
   `1440×900`, đồng thời không regression ở viewport `375×812`.
7. Route `combat_session` dùng khung điện thoại landscape tối đa `932×430`,
   trong khi mọi route khác tiếp tục dùng portrait tối đa `430 px`.

## 2. Hiện trạng và root cause

Root layout hiện để `GestureHandlerRootView` và nội dung `View` dùng `flex: 1`,
không có web frame. Vì vậy ở browser `1440×900`, Profile card rộng khoảng
`1352 px` và segmented control rộng khoảng `1408 px`.

Chỉ thêm `maxWidth` cho root là chưa đủ. Ít nhất 13 module dùng
`useWindowDimensions()` trực tiếp để tính pager width, card size, grid columns,
tab-bar width và responsive table. Nếu browser vẫn báo `1440 px`, các module đó
sẽ render nội dung 1440 px bên trong frame 430 px và bị cắt/overflow.

## 3. Kiến trúc được chọn

Tạo một boundary duy nhất tại `components/ui/AppViewport.tsx`:

```text
browser/native window dimensions
              │
              ▼
getAppViewportDimensions(dimensions, platform)
              │
       web: min(width, 430)
       native: unchanged
              │
       ┌──────┴────────┐
       ▼               ▼
AppViewport       useAppWindowDimensions
(visual frame)    (layout calculations)
```

- `AppViewport` đặt app trong host full-window, căn giữa frame trên web và dùng
  màu gutter từ Design System. Không dùng `transform: scale()` vì scale làm sai
  tọa độ pointer, font rasterization và phép đo layout.
- `useAppWindowDimensions()` là API duy nhất cho code app đọc kích thước viewport.
  Hook vẫn dựa trên React Native `useWindowDimensions()`, nên resize browser và
  xoay thiết bị native vẫn reactive.
- `WEB_PHONE_MAX_WIDTH = 430`, landscape `932×430` là các constant exported để
  test và không bị lặp magic number ở screen.
- Root `app/_layout.tsx` truyền orientation policy hiện có vào `AppViewport` và
  bọc toàn bộ error fallback/navigation/loading trong frame.
- Các consumer hiện tại chuyển import sang hook mới; không thay đổi công thức
  responsive nội bộ của từng màn.
- Provider memo hóa dimensions để root rerender không kéo theo rerender các màn
  chỉ vì object context đổi identity.

## 4. Lựa chọn đã loại

### Chỉ giới hạn CSS/root width

Không chọn vì pager/grid vẫn đọc chiều rộng browser thật. Kết quả nhìn giống
mobile ở shell nhưng content vẫn overflow và phép test không đáng tin.

### Chỉ resize browser automation xuống 430 px

Hữu ích cho E2E nhưng không đáp ứng yêu cầu mở localhost trên màn hình PC mà app
vẫn tự giữ layout điện thoại. Mỗi công cụ/browser cũng phải nhớ cấu hình lại.

### Render app trong iframe

Không chọn vì làm phức tạp history, OAuth callback fragment, focus, clipboard,
DevTools và CSP mà không mang lại lợi ích cho local Expo Web.

## 5. Phạm vi file

- Tạo `components/ui/AppViewport.tsx` cho clamp policy, hook và visual frame.
- Sửa `app/_layout.tsx` để bọc root.
- Thay `useWindowDimensions()` bằng `useAppWindowDimensions()` ở toàn bộ app
  consumer hiện có.
- Tạo `__tests__/app-viewport.test.tsx` cho boundary `320/375/430/1440`, native
  parity, root integration và direct-hook ownership.

Không thay đổi Riot token/session, web auth companion, API client, native
orientation policy, animation timing hoặc dữ liệu demo.

## 6. UX và accessibility

- Không thêm phone bezel trang trí vì nó làm giảm vùng app và sai tọa độ kiểm
  thử. Gutter chỉ là nền phân biệt viewport.
- Frame không dùng border chiếm content width; `430 px` là content width thật.
- Không chặn browser zoom và không thêm fixed height; chiều cao tiếp tục theo
  browser để hỗ trợ cửa sổ thấp và keyboard.
- Touch target, safe area, reduced motion và focus semantics hiện có được giữ
  nguyên. Lỗi focus vào scene `opacity: 0` được theo dõi riêng, không trộn vào
  thay đổi responsive này.

## 7. Verification

- RED/GREEN unit + integration boundary tests.
- Targeted Jest, TypeScript và ESLint.
- `pnpm run check` và Expo Android export theo `AGENTS.md`.
- Expo Web runtime ở `1440×900`: frame và mọi profile tab page phải rộng `430`.
- Expo Web runtime ở `375×812`: frame phải rộng `375`, không horizontal root
  overflow.
- Contract test route orientation: portrait clamp `430`, combat landscape clamp
  `932×430`; authenticated combat runtime cần session hợp lệ để quan sát trực tiếp.
- Kiểm thử demo Profile → Match History → Match Details bằng semantic controls;
  không dùng token/callback Riot thật trong automated verification.

