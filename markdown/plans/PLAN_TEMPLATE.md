# <Tên thay đổi> — Implementation Plan

**Trạng thái:** draft

**Mục tiêu:** Một câu mô tả kết quả người dùng nhận được.

**Phạm vi:** Màn hình/flow/module nằm trong plan.

**Ngoài phạm vi:** Những hành vi không được thay đổi.

**Nguồn chuẩn:** Link spec, issue, screenshot hoặc tài liệu liên quan.

## Hiện trạng có bằng chứng

- Quan sát:
- Metric/baseline:
- Giới hạn xác minh:

## Acceptance criteria

- [ ] Hành vi người dùng cụ thể.
- [ ] Loading/empty/error/retry cụ thể.
- [ ] Accessibility và Reduce Motion cụ thể.
- [ ] Quality gate và device evidence cụ thể.

## Kiến trúc và file ownership

| File/module | Trách nhiệm | Thay đổi dự kiến |
|---|---|---|
| `<path>` | `<ownership>` | `<change>` |

## Task 1 — <Kết quả độc lập>

- [ ] Viết test RED tại `<test-path>` cho `<behavior>`.
- [ ] Chạy `<exact-command>` và lưu lỗi mong đợi.
- [ ] Implement tối thiểu trong `<source-path>`.
- [ ] Chạy targeted test và refactor.
- [ ] Thu bằng chứng `<screenshot/log/metric>`.

## Verification matrix

| Requirement | Automated | Device/manual | Evidence |
|---|---|---|---|
| `<requirement>` | `<test>` | `<flow>` | `<artifact>` |

## Risks và rollback

- Risk:
- Guardrail:
- Rollback:

## Completion audit

- [ ] Mọi acceptance criterion có evidence.
- [ ] `pnpm run check` PASS.
- [ ] Android export PASS và output tạm đã dọn.
- [ ] Không có secret/log/build artifact bị commit.
- [ ] README/CHANGELOG/kiến trúc đã cập nhật nếu cần.
