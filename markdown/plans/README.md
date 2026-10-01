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

**Đã tiếp tục theo goal mới ngày 2026-09-30.** Plan điều phối hiện tại:
[`2026-09-30-liquid-glass-completion.md`](2026-09-30-liquid-glass-completion.md).
Bản [`stopped-work-handoff`](2026-09-30-stopped-work-handoff.md) là mốc lịch sử
trước khi tiếp tục, không phải trạng thái thực thi hiện tại.

- [`2026-09-30-profile-loadout-responsive.md`](2026-09-30-profile-loadout-responsive.md) —
  active: Profile equip không khóa thao tác, hàng đợi PUT versioned/coalesced,
  bảo vệ lựa chọn mới và bốn ô graffiti/flex compact cùng hàng.
- [`2026-09-30-party-match-flow.md`](2026-09-30-party-match-flow.md) —
  active: Party compact, friends online/card thật, popup agent/polling 3s,
  mutation acknowledgement nhanh, Ready optimistic và code/share/join/invite.
  Source/device read-only evidence tách biệt khỏi live mutation QA.
- [`2026-09-30-bundle-reference-refinement.md`](2026-09-30-bundle-reference-refinement.md) —
  active: chỉnh tỷ lệ/ảnh hero và carousel compact theo screenshot thực tế;
  bổ sung lớp mờ/check skin đã mua từ inventory thật và dev response diagnostics.
- [`2026-09-30-white-bundle-detail-card.md`](2026-09-30-white-bundle-detail-card.md) —
  done: card bundle trắng inline hoàn tất theo RED→GREEN (parser giữ giá
  base/discounted thật, không invent ownership; carousel ngang peek card kế;
  modal tối đã gỡ); targeted 32/32 và full gate 119 suite / 1.397 test + Android
  export PASS; screenshot, swipe ngang/dọc và accessibility parity trên
  `45218ba` đều PASS.
- [`2026-09-29-codex-opencode-worker.md`](2026-09-29-codex-opencode-worker.md) —
  done: policy/runtime/runner TDD, custom worker/skill, matching CLI `1.18.32`,
  exact `zai-coding-plan/glm-5.3` live smoke, final hardening review và full
  source/Android gates đều PASS.
- [`2026-09-29-codex-opencode-worker-design.md`](2026-09-29-codex-opencode-worker-design.md) —
  approved: Codex lập plan/review, OpenCode CLI chạy exact GLM 5.3 trong
  worktree riêng với path/command guards, stable-write audit và tối đa hai
  repair round.
- [`2026-09-25-multi-account-phone-mirror-design.md`](2026-09-25-multi-account-phone-mirror-design.md) —
  approved and agent-self-reviewed: transfer toàn bộ saved
  Riot accounts và app snapshot từ Android qua USB vào companion RAM vault;
  browser chỉ nhận session account đang active và refresh dữ liệu read-only.
- [`2026-09-25-multi-account-phone-mirror.md`](2026-09-25-multi-account-phone-mirror.md) —
  active inline TDD plan cho validator, companion vault, web client, Android
  sender, desktop activation/UI và same-signer runtime parity.
- [`2026-09-25-phone-session-handoff-design.md`](2026-09-25-phone-session-handoff-design.md) —
  approved design cho one-time USB Riot session handoff từ production-signed
  Android pentest build sang Expo Web; superseded về credential/data scope bởi
  multi-account mirror design phía trên.
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
