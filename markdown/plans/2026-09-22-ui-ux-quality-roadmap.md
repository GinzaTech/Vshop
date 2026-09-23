# UI/UX Quality Roadmap — Implementation Plan

**Trạng thái:** in progress — device gesture đã xác minh; motion target và
TalkBack/real-account 38-Act swipe vẫn chưa đạt đủ completion gate

**Mục tiêu:** Làm Profile multi-Act thực sự thao tác được, giảm khựng ở lần mở
đầu, thống nhất hierarchy/i18n và thiết lập pipeline asset có provenance mà
không làm đổi contract dữ liệu Riot.

**Phạm vi:** Profile, primary navigation liên quan, shared UI/motion primitives,
accessibility và asset workflow.

**Ngoài phạm vi:** Purchase, queue, party mutation, lock agent, loadout mutation,
gửi chat, thay đổi Riot API contract hoặc fabricating dữ liệu mùa cũ.

## Baseline đã quan sát trên thiết bị

- Development APK `4.1.8 (89)` chạy trên Android device `45218ba`.
- Profile hiển thị `38 ACT`, nhưng chip Act khác không nhận tap và horizontal
  selector không nhận swipe trong khi outer vertical scroll vẫn hoạt động.
- Warm Overview ↔ Details: 1/27 janky frames, không miss VSync, P90 14–17 ms.
- Lần chuyển đầu sang player-data mode: 15/18 janky frames, median 69 ms.
- Overview vẫn có cỡ số không đồng nhất; một số màn còn nhãn Anh–Việt lẫn nhau.
- Full source gate gần nhất: 78/78 suites, 801/801 tests; Android Hermes bundle
  7.99/8.00 MiB, vì vậy asset/code mới phải giữ budget.

## Bằng chứng thiết bị mới nhất (23/09/2026)

- Đã cài đúng development client `4.1.8 (89)` trên Android device `45218ba`;
  package dump có `expo.modules.devlauncher` và app chạy foreground qua Metro.
- Sửa đúng root cause selector: header đã transform vẫn giữ hit-box expanded và
  chặn vùng `y=893–993`. `pointerEvents="box-none"` cho khoảng trống đi xuyên,
  còn content-collapse pan bị tắt khi dashboard tương tác đang hiện.
- DEV profile offline chọn được current, middle và old Episode; UIAutomator xác
  nhận `selected=true` lần lượt và số liệu Overview/Details đổi theo Act.
- Fixture 8 Act tạo overflow thật: swipe trái/phải đổi bounds chip, tap Act đầu,
  giữa và cuối (`Episode 8 · Act 1`) đều selected; vertical swipe bắt đầu ngay
  trên selector vẫn cuộn dashboard thay vì bị horizontal row giữ.
- Baseline demo forward là 89.47% jank/P95 117 ms. Sau khi bỏ animation subtree
  ẩn, dùng rank fast-path, đổi nền một lần và dùng token 220 ms, 5 warm forward
  runs có median 66.67%/P95 38 ms; reverse median 75%/P95 46 ms. Cảm giác trễ giảm nhưng
  vẫn chưa đạt tiêu chí 5%/32 ms, vì vậy Phase 2 chưa được coi là hoàn tất.
- UIAutomator xác nhận Overview/Details và ba season tab có selected/enabled
  đúng; logcat không có FATAL/ANR/SIGSEGV trong flow cuối. TalkBack thủ công và
  swipe toàn bộ 38 Act trên session thật chưa được xác minh sau fix.
- Final source gate: `pnpm run check` PASS với 78/78 suites, 807/807 tests,
  zero-warning ESLint, production audit PASS và Android export 10.47 MiB
  (Hermes 7.99/8.00 MiB); thư mục export tạm đã được dọn.

## Acceptance criteria

- [ ] Người dùng swipe qua toàn bộ 38 Act và tap bất kỳ Act visible nào trên cả
  Overview lẫn Details; selected chip, title, loading và data cùng cập nhật.
- [ ] Request cũ không ghi đè Act mới; lỗi/partial data giữ cache tốt và metric
  không có thật hiển thị `--`.
- [ ] Cold và warm Profile transition không tách card/layer; Reduce Motion đổi
  trạng thái tức thời và không để layer ẩn nhận touch.
- [ ] Trên thiết bị 60 Hz mục tiêu, warm flow đạt ≤5% jank và P95 ≤32 ms; cold
  flow phải được đo và báo riêng, không gộp để che regression.
- [ ] Numeric hierarchy nhất quán theo yêu cầu thiết kế; copy visible dùng cùng
  locale, trừ tên riêng/game taxonomy có chủ đích.
- [ ] Mọi control có role/state/label, touch target hợp lý và TalkBack focus không
  rơi vào panel ẩn.
- [ ] Asset mới có brief/provenance, kích thước ổn định, không làm vượt Android
  export budget và có fallback phù hợp.

## Phase 0 — Workflow và công cụ

- [x] Cài skill UI/UX, React Native motion/gesture, planning, accessibility và
  static asset ở user scope.
- [x] Thêm workflow, plan template và asset brief vào repository.
- [x] `skills list -g --json` discover đủ 9 skill mới cho agent Codex; catalog
  trong cuộc hội thoại sẽ nạp chúng từ turn/session kế tiếp.

## Phase 1 — Profile season interaction (P0)

**File trọng tâm:** `components/profile/PlayerInfoView.tsx`,
`features/profile/ProfileScreen.tsx`, test Profile và device automation.

- [x] Tạo test RED cho press Act khác, loading/disabled state và stale response.
- [x] Instrument responder/gesture tree; chứng minh outer manual pan giữ touch chưa quyết định.
- [x] Dùng `gestures` để truy hit-box thực tế: cho vùng header trong suốt pass
  touch bằng `box-none`, đồng thời tắt outer content pan ở player-info mode.
- [x] Test source/component cho tap, selected/disabled state, touch-up/cancel và
  tab semantics; device demo xác nhận current/middle/old season đổi thật.
- [x] Test device swipe trái/phải, tap first/middle/last Act và vertical scroll
  bắt đầu từ selector trên fixture overflow 8 Act. Loading/disabled state được
  component test bao phủ; live request vẫn cần account session hợp lệ.
- [ ] Device verify lại session thật với current Act, V26 Act IV và một Episode
  cũ; demo đã đối chiếu selected, title và toàn bộ metric, nhưng không thay thế
  bằng chứng Riot/cache của tài khoản thật.

### Reset-from-now recording contract

- [x] Tạo mốc timestamp bất biến theo tài khoản và mirror mốc/Act bắt đầu vào
  Match store để cache cũ không thể ghi đè chính sách mới.
- [x] Cho Act hiện tại bắt đầu từ 0; chỉ tính Competitive match có
  `GameStartTime` từ mốc ghi nhận và không dùng Riot MMR full-Act làm fallback.
- [x] Giữ archive cũ để phục hồi nhưng ẩn option/thống kê trước mốc; khi Riot
  content công bố Act mới, Act đã hoàn tất sau mốc vẫn được chọn và lưu riêng.
- [ ] Xác minh migration trên tài khoản Riot thật; fixture DEV một mùa chỉ là
  bằng chứng UI, không thay thế request/session thật.

## Phase 2 — Cold Profile motion (P0)

**File trọng tâm:** `features/profile/useProfileMotion.ts`,
`features/profile/ProfileHeroCard.tsx`, `components/profile/PlayerInfoView.tsx`,
`constants/Motion.ts`.

- [x] Capture cold/warm baseline cùng một APK, route và thao tác; tách bundle/data
  load khỏi transition frames.
- [x] Audit Profile JS/render commits và image decode; không memo hóa nếu profiler không
  chỉ ra lợi ích.
- [x] Giữ transform/opacity trên UI thread, pre-measure panel cần thiết và tránh
  mount toàn dashboard trong frame bắt đầu animation.
- [x] Test cold staging, warm immediate path, Reduce Motion và forward/reverse
  device flow; morph dùng token 220 ms, không animate full-screen background hay
  các stat subtree đã bị lớp hero che.
- [x] Re-measure cùng protocol; số đo được ghi ở mục bằng chứng thiết bị. Target
  vẫn chưa đạt nên tiếp tục mở Phase 2 thay vì đánh dấu acceptance criterion.

## Phase 3 — Visual hierarchy và localization (P1)

- [x] Chốt numeric type scale dùng chung cho Wins/Losses/Win rate/KAST/KD/ACS và
  cập nhật component test bằng semantic role/text, không snapshot mù.
- [x] Audit visible copy tại Profile, Equipment, Agent, Item Upgrades và About; đưa chuỗi
  translatable vào i18n, giữ tên riêng/game term có lý do.
- [x] Test catalog + runtime plural cho tiếng Việt/Anh; clipping màn nhỏ còn chờ device.
- [ ] Chụp Overview/Details trước/sau trên cùng dữ liệu và review contrast/rhythm.

## Phase 4 — Accessibility và gesture regression (P1)

- [x] Dùng `mobile-accessibility` audit primary tabs, season selector, dashboard
  tabs, media popup và Match Detail.
- [x] Kiểm source/component selected/disabled state, modal isolation và 44 dp touch.
- [x] Thêm testID/accessibility label tại điểm automation còn dùng coordinate.
- [x] Xác minh bằng component tree và UIAutomator rằng panel ẩn không nhận
  touch/focus, season tabs và Overview/Details công bố state đúng.
- [ ] Chạy TalkBack thủ công theo thứ tự focus đầy đủ trên thiết bị.

## Phase 5 — Asset pipeline (P1)

- [ ] Viết brief theo `assets/generated/ASSET_BRIEF_TEMPLATE.md` cho từng asset.
- [ ] Dùng `imagegen` cho bitmap/texture/illustration; dùng `canvas-design` cho art
  direction/static composition. Không dùng hai tool chỉ để tạo icon vector đơn giản.
- [ ] Review concept ở kích thước render thật, dark/light surface và màn hình nhỏ.
- [ ] Promote bản duyệt vào `assets/generated/production/<feature>/`, thêm sidecar
  provenance và import với kích thước layout cố định.
- [ ] Chạy export budget, kiểm alpha/crop/compression và screenshot trên Android.

## Phase 6 — Completion gate

- [x] Targeted RED/GREEN tests và `pnpm run check` đều PASS.
- [x] Android export PASS, output tạm được dọn, JS/Hermes không vượt 8 MiB.
- [ ] Toàn bộ flow read-only được chạy trên thiết bị; action thay đổi tài khoản
  chỉ test khi có yêu cầu rõ ràng.
- [x] Cập nhật README, CHANGELOG, design-system và plan evidence cho device pass
  cùng giới hạn motion còn lại.
- [x] Review diff, secret/build-artifact scan và completion audit theo từng
  acceptance criterion trước commit/push.
