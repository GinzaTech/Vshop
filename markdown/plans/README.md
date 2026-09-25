# Kế hoạch dự án

Thư mục này là nguồn chuẩn cho các plan nhiều bước của VShop. Dùng
[`PLAN_TEMPLATE.md`](PLAN_TEMPLATE.md) cho plan mới và giữ một trạng thái rõ ràng:
`draft`, `approved`, `active`, `blocked` hoặc `done`.

## Quy ước

- Tên file: `YYYY-MM-DD-<pham-vi>.md`.
- Mỗi yêu cầu phải ánh xạ tới ít nhất một task và một acceptance criterion.
- Mỗi task kết thúc bằng bằng chứng có thể kiểm tra: test, ảnh, log, metric hoặc
  artifact build. Không dùng “đã xem qua” làm bằng chứng.
- Task code theo RED → GREEN → refactor; không sửa test chỉ để hợp thức hóa bug.
- Không ghi ước lượng thời gian chung chung. Ghi dependency, risk và điều kiện
  dừng cụ thể.
- Khi scope thay đổi, cập nhật plan trước khi triển khai phần mới.

## Plan hiện tại

- [`2026-09-25-phone-session-handoff-design.md`](2026-09-25-phone-session-handoff-design.md) —
  approved design cho one-time USB Riot session handoff từ production-signed
  Android pentest build sang Expo Web.
- [`2026-09-25-phone-session-handoff.md`](2026-09-25-phone-session-handoff.md) —
  active TDD plan: companion protocol, fixed-argument ADB bridge, guarded phone
  route, desktop activation và signer-preserving install/runtime evidence.
- [`2026-09-25-desktop-pentest-companion-design.md`](2026-09-25-desktop-pentest-companion-design.md) —
  spec đã duyệt cho Expo Web local pentest: browser auth broker, Riot API
  gateway loopback, Axios web adapter và read-only policy mặc định.
- [`2026-09-25-desktop-pentest-companion.md`](2026-09-25-desktop-pentest-companion.md) —
  implementation hoàn tất cho policy, loopback companion, browser broker, web
  adapter và shared auth; source/export/local login surface PASS, real Riot
  login và live data reads còn `NOT VERIFIED`.
- [`2026-09-24-ui-performance-startup-update-recovery-design.md`](2026-09-24-ui-performance-startup-update-recovery-design.md) —
  spec đã duyệt cho primary-tab/Profile performance, update recovery trước
  authenticated tree và local native release signing.
- [`2026-09-24-ui-performance-startup-update-recovery.md`](2026-09-24-ui-performance-startup-update-recovery.md) —
  implementation plan đang active: source/full gate và local production APK
  `4.1.10 (91)` đã PASS signer/alignment; cài đặt và device metric matrix đang
  chờ ADB nối lại.
- [`2026-09-22-ui-ux-quality-roadmap.md`](2026-09-22-ui-ux-quality-roadmap.md) —
  roadmap xử lý Profile multi-Act, cold motion, hierarchy/i18n, accessibility và
  pipeline asset.
- [`2026-09-23-act-recording-baseline.md`](2026-09-23-act-recording-baseline.md) —
  source hoàn tất; mốc Act theo tài khoản, cache/archive filtering và full gate
  đã PASS; device/live Riot migration còn `NOT VERIFIED` do ADB ngắt kết nối.
- [`2026-09-23-morphicons-system-design.md`](2026-09-23-morphicons-system-design.md) —
  spec đã duyệt; migration source, zero-fallback AppIcon và optimized Android
  export/budget đã hoàn tất. Native APK/device metrics và accessibility thủ
  công còn `NOT VERIFIED`.
- [`2026-09-23-morphicons-system.md`](2026-09-23-morphicons-system.md) —
  implementation plan: Task 1–6 hoàn tất theo commit evidence; Task 7 đã đạt
  source gates 87 suite / 910 test và optimized export 10,16/12 MiB tổng,
  7,69/8 MiB Hermes. Native rebuild, APK install/device verification và final
  commit/push vẫn mở.
