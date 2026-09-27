# Plan: Web parity fixes (2026-09-27)

> Trạng thái: ✅ Implemented

## 1. Bối cảnh

Audit so sánh web vs mobile (4 góc độ: platform-split files, Platform.OS branches,
native-only modules, viewport/safe-area) phát hiện các gap khiến UI/UX web
không phản ánh 100% như mobile. Screenshot đối chiếu bằng Playwright
(390×844, `/profile?demo=1`, `/history?demo=1`) + screenshot phone qua adb.

## 2. Findings & xử lý

| # | Finding | Severity | Xử lý |
|---|---|---|---|
| F1 | `AppIcon` (morphicons) đổi path SVG qua `setNativeProps({d})` — trên react-native-web là no-op → icon động bị đóng băng ở lần render đầu (tab indicator, wishlist heart, chevron, radio...) | Critical | ✅ `AppIcon.web.tsx`: remount SVG khi `name`/màu/fill đổi (mất morph animation trên web — platform không hỗ trợ — nhưng icon luôn đúng state) |
| F2 | Pull-to-refresh: RNW bỏ qua prop `refreshControl` → không gesture, không spinner, không phản hồi nào khi refresh chạy | High | ✅ `AppRefreshControl.web.tsx`: external store đếm refresh đang chạy; `AppViewport` vẽ thanh tiến trình mỏng (ACCENT, 3dp) trên frame qua `useWebRefreshActivity()` — mọi màn hình có PTR đều có feedback, không sửa từng screen |
| F3 | Safe-area insets = 0 trên web → nội dung dính sát mép frame | Medium | ✅ `AppViewport` bọc `SafeAreaProvider initialMetrics` (top 26/bottom 8) **chỉ trên web** — native giữ provider thật |
| F4 | Nút "Xuất ảnh bộ sưu tập" missing trên web (stub null — cần expo-media-library + offscreen render sheet) | Medium | ⏸ Chấp nhận gap: thêm nút disabled sai vị trí còn tệ hơn thiếu; làm canvas-export là feature riêng |
| F5 | Blur modal bundles trên web = backdrop-filter approximation | Low | by-design (expo-blur web build tự xử lý) |
| F6 | Chat/presence offline trên web (XMPP cần raw TCP) | Medium | by-design — đã gate fail-fast c17a2de; muốn thật thì cần WebSocket proxy qua companion (feature riêng) |
| F7 | Chart web fallback (rotated Views), shimmer JS driver, shadows boxShadow | Cosmetic | by-design, chấp nhận |

## 3. Files

- NEW `components/ui/AppIcon.web.tsx` — remount-on-change
- NEW `components/ui/AppRefreshControl.web.tsx` — refresh activity store
- `components/ui/AppRefreshControl.tsx` — stub `useWebRefreshActivity()` cho native
- `components/ui/AppViewport.tsx` — refresh bar + SafeAreaProvider web-only

## 4. Verify

- tsc + eslint --max-warnings=0 ✓
- Playwright screenshots 5 route (root/profile-demo/history-demo/shop/settings) —
  không regression; history demo render đủ ảnh agent + màu + RR như mobile ✓
- Icon remount là fix deterministic (remount = render mới = icon đúng) ✓
