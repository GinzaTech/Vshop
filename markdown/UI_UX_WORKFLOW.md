# Workflow UI/UX, motion và asset của VShop

Tài liệu này định tuyến công việc thiết kế cho VShop. Nguồn chuẩn bắt buộc vẫn
là [AGENTS.md](../AGENTS.md), [BUILD_DESIGN_SYSTEM.md](../BUILD_DESIGN_SYSTEM.md),
`constants/DesignSystem.ts` và `constants/Motion.ts`. Skill chỉ bổ sung phương
pháp; không được tự ý đổi kiến trúc, màu, motion token hoặc quy tắc release.

## Bộ skill đã cài

Các skill dưới đây được cài ở user scope `C:\Users\kona\.codex\skills` và sẽ
được Codex nạp từ turn/session kế tiếp.

Nguồn/path và commit pin được ghi trong
[`UI_UX_SKILL_MANIFEST.md`](UI_UX_SKILL_MANIFEST.md).

| Nhóm | Skill | Vai trò trong VShop |
|---|---|---|
| Thiết kế | `ui-ux-pro-max` | Tra cứu hierarchy, palette, typography, design-system và hướng dẫn React Native |
| Thiết kế | `frontend-design` | Chọn visual direction có chủ đích, tránh giao diện template/generic |
| Mobile | `react-native-best-practices` | Đo FPS, render cost, bundle, memory và tối ưu React Native |
| Motion | `animations` | Reanimated 4, Skia/GPU, layout/scroll animation và Reduce Motion |
| Gesture | `gestures` | RNGH, phối hợp tap/pan/scroll và xử lý xung đột responder |
| Accessibility | `mobile-accessibility` | TalkBack/VoiceOver, role/state, touch target và semantics native |
| Ý tưởng | `brainstorming` | Chuyển yêu cầu lớn thành brief/spec có tiêu chí thành công |
| Kế hoạch | `writing-plans` | Chia spec thành task nhỏ, có file, test và evidence cụ thể |
| Thực thi | `executing-plans` | Chạy plan tuần tự và review theo checkpoint |
| Asset | `imagegen` | Sinh/chỉnh bitmap từ brief hoặc ảnh tham chiếu |
| Asset | `canvas-design` | Art direction và static composition PNG/PDF nguyên bản |

Không dùng nhóm GSAP cho animation native React Native. GSAP chỉ phù hợp khi
đầu ra thực sự là web/HTML. Với VShop native, ưu tiên `animations`, `gestures`
và `react-native-best-practices`.

## Luồng bắt buộc

1. **Khảo sát**: đọc screen/component, token, dữ liệu thật, test hiện có và ảnh
   chụp thiết bị. Ghi rõ vấn đề nào đã quan sát và vấn đề nào chỉ là giả thuyết.
2. **Brief/spec**: với redesign hoặc flow nhiều màn, dùng `brainstorming`; chốt
   người dùng, mục tiêu, trạng thái loading/empty/error, accessibility và Reduce
   Motion. Thay đổi nhỏ có thể dùng brief ngắn ngay trong plan.
3. **Plan**: tạo file theo mẫu trong `markdown/plans/`. Mỗi task phải nêu file,
   test RED, implementation, lệnh kiểm tra và evidence mong đợi.
4. **Thiết kế**: dùng `ui-ux-pro-max` để tra cứu, `frontend-design` để chọn visual
   direction, sau đó ánh xạ về token VShop thay vì chép raw hex/spacing.
5. **Thực thi**: TDD; component dùng lại đặt trong `components/ui/`; motion dùng
   UI thread; gesture phải test cả tap, pan ngang, pan dọc và nested scroll.
6. **Asset**: tạo brief trong `assets/generated/`, sinh concept, review, rồi chỉ
   promote asset được duyệt. Ảnh mạng/runtime vẫn dùng `CachedImage`/`expo-image`.
7. **Xác minh**: `pnpm run check`, Android export, TalkBack/accessibility tree,
   ảnh chụp ở thiết bị mục tiêu và frame metrics cho flow có motion.
8. **Bàn giao**: cập nhật plan, README/CHANGELOG khi hành vi hoặc workflow thay
   đổi; tách rõ PASS source, PASS build và PASS runtime/device.

## Bằng chứng tối thiểu theo loại thay đổi

| Thay đổi | Bằng chứng bắt buộc |
|---|---|
| Layout/typography | Before/after screenshot, màn hình nhỏ, text dài và i18n |
| Gesture | Tap + swipe hai hướng, nested scroll, testID/accessibility tree |
| Motion | Reduce Motion, warm/cold flow, `gfxinfo`/trace trước và sau |
| Skia/GPU | Native screenshot, fallback web, không crash/ANR, bundle budget |
| Asset mới | Brief + provenance, kích thước/alpha, device render và export budget |
| Navigation | Forward/back, interrupted transition, state preservation và orientation |

Không smoke-test các action làm thay đổi tài khoản Riot như mua hàng, queue,
lock agent, rời party, đổi loadout hoặc gửi chat nếu task không yêu cầu rõ ràng.

## Vị trí artifact

- Plan và trạng thái: [`markdown/plans/`](plans/README.md)
- Brief, prompt và asset sinh mới: [`assets/generated/`](../assets/generated/README.md)
- Token/runtime source: `constants/DesignSystem.ts`, `constants/Motion.ts`
- Component dùng lại: `components/ui/`
- Bằng chứng tạm như screenshot/log: đặt ngoài repository; chỉ commit báo cáo đã
  scrub nếu cần giữ lâu dài.
