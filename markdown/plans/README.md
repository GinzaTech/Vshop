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

- [`2026-09-22-ui-ux-quality-roadmap.md`](2026-09-22-ui-ux-quality-roadmap.md) —
  roadmap xử lý Profile multi-Act, cold motion, hierarchy/i18n, accessibility và
  pipeline asset.
- [`2026-09-23-act-recording-baseline.md`](2026-09-23-act-recording-baseline.md) —
  source hoàn tất; mốc Act theo tài khoản, cache/archive filtering và full gate
  đã PASS; device/live Riot migration còn `NOT VERIFIED` do ADB ngắt kết nối.
- [`2026-09-23-morphicons-system-design.md`](2026-09-23-morphicons-system-design.md) —
  spec proposed cho icon boundary toàn app, Morphicons state transitions,
  accessibility, native dependency và bundle/device gates; chờ user review.
