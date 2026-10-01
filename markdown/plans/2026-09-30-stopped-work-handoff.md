# Bàn giao công việc đã dừng — 2026-09-30

**Trạng thái thực thi: ĐÃ DỪNG THEO YÊU CẦU NGƯỜI DÙNG.**

Không tự tiếp tục từ tài liệu này. Chỉ tiếp tục khi người dùng đưa yêu cầu mới.
Đây là bản tổng hợp trạng thái sau các lần ngắt; các kết quả PASS cũ không đại diện cho toàn bộ worktree hiện tại.

## 1. Workspace và trạng thái dừng

- Checkout đang làm: `C:/Users/kona/Desktop/Project/Vshop`.
- Branch: `main`; HEAD kiểm tra tại lúc dừng: `d69c24b`.
- Các thay đổi của đợt này vẫn nằm trong worktree, gồm file modified và file mới untracked. Chưa commit/push các thay đổi này.
- Không có goal tự chạy trong thread (`get_goal` trả `null`).
- Kiểm tra process không thấy Node/Expo/Metro/Jest/OpenCode của công việc còn chạy; không có listener trên cổng 8081.
- Hai agent cuối được kiểm tra (`Hume`, `Herschel`) không còn được tìm thấy trong runtime agent hiện tại. Các agent trước đó đã hoàn tất/đóng trong phiên cũ.
- Đã `am force-stop com.android.vshop` trên thiết bị `45218ba`; kiểm tra `pidof` sau đó không có PID.
- Lệnh kiểm tra thiết bị đã khởi động ADB server vì trước đó server không chạy. Sau khi dừng VShop, đã chạy `adb kill-server` để kết thúc server vừa khởi động.
- Không thực hiện thêm build, test, thao tác tài khoản Riot, commit, push, APK hoặc OTA trong bước dừng/bàn giao này.

## 2. Đang dở: API loadout ở Profile

### Yêu cầu người dùng

Chọn đồ là UI đổi ngay, vẫn được mở/chọn đồ ở ô khác khi request áp dụng đang chạy. Request cũ không được ghi đè lựa chọn mới. Đồng thời thu nhỏ bốn ô graffiti/flex thành một hàng.

### Phần API CHƯA triển khai

- Đã tạo plan: `markdown/plans/2026-09-30-profile-loadout-responsive.md`.
- Đã tạo test: `__tests__/profile-loadout-queue.test.ts` — 10 tình huống cho serializer/coalescing, lỗi, version, stale reads và lifecycle.
- **Chưa có file `features/profile/profile-loadout-queue.ts`.** Test đang import module này và lần chạy gần nhất FAIL vì không tìm thấy module.
- Chưa có `features/profile/profile-loadout-queue-registry.ts`.
- Agent Hume xác nhận chỉ khảo sát, chưa sửa integration và chưa tạo test integration mới.
- `useProfileMutations.ts`, `useProfileFetch.ts`, `useProfileState.ts`, `ProfileScreen.tsx`, `ProfilePickerModal.tsx`, `profile-loadout.ts` vẫn chưa được sửa cho hàng đợi mới.
- `services/riot/loadout-api.ts` và `services/riot/loadout-cache.ts` chưa được harden theo thiết kế hàng đợi.
- Vì vậy **luồng đổi trang bị vẫn có khóa `updatingLoadout` cũ**. Không được báo phần API loadout mới đã hoàn tất.

### Nguyên nhân đã xác định

1. Các handler identity, weapon, legacy spray và expression trả về sớm khi `updatingLoadout` là true. Collection quick-equip cũng bị chặn theo cờ này.
2. `ProfilePickerModal.tsx` dùng `pickerBusy = pickerLoading || updatingLoadout`, vô hiệu hóa cả sáu nhóm lựa chọn khi một PUT đang chạy.
3. v3 PUT gửi toàn bộ loadout cùng `Version`. Bỏ khóa UI rồi chạy PUT song song có thể gửi version cũ và làm mất lựa chọn ở ô khác.
4. `useProfileFetch.ts` xóa pending sau 8 giây kể cả PUT chưa xong; resolver còn chạy lại sau đợt tải ownership/rank nên dễ vượt ngưỡng giữa hai lần xử lý.
5. Cache hydration hiện sync snapshot trực tiếp, chưa đi qua một bộ reconcile chung với pending intent.
6. Các handler cũ ép trường yêu cầu vào response PUT rồi ghi như đã xác nhận; dữ liệu hiển thị optimistic và bằng chứng server chưa được tách rõ.
7. Mutation/confirmation chưa có đầy đủ guard đồng bộ cho account, token, generation, unmount và các callback được giữ từ render cũ.

### Hướng triển khai đã dự kiến, chưa phải code hoàn chỉnh

- Giữ một PUT đang chạy cho mỗi loadout, gộp lựa chọn chưa gửi theo field key.
- Field keys: card và title riêng; weapon theo ID với tuple skin/level/chroma; spray theo `EquipSlotID`; expression theo slot với tuple `TypeID`/`AssetID`.
- UI áp dụng intent ngay. Payload đầy đủ được dựng tại lúc gửi từ server base/version đã biết, rồi phủ các intent hiện hành.
- Response trước chỉ cập nhật server base; những lựa chọn mới hơn tiếp tục phủ lên UI.
- Lỗi chỉ gỡ/rollback revision còn hiện hành của field bị lỗi. Không rollback nguyên snapshot cũ lên các field khác.
- Timeout/version conflict/receipt không dùng được: force-read có giới hạn để xác định base. Nếu vẫn chưa rõ, giữ trạng thái chưa xác nhận và dừng gửi PUT tiếp; không tự lặp vô hạn mutation.
- Cache hydration, refresh, confirmation và receipt cần đi qua cùng boundary. Không để 8 giây tự xóa intent còn queued/sending.
- Saving là trạng thái thông tin; chỉ việc tải option/quyền/thiếu dữ liệu mới khóa lựa chọn.
- Nếu hàng đợi tiếp tục sau khi rời Profile, ownership phải nằm ngoài screen; unsubscribe UI khi unmount. Đổi account/generation/credentials phải vô hiệu continuation cũ, không gửi/cache/toast vào phiên mới.
- Cần giữ v2/v3 payload, buddy/attachments, DynamicOptions và các trường không sửa.

Contract dự kiến đã gửi cho agent, được phản ánh trong test RED:

```ts
createProfileLoadoutQueue({
  initial,
  isCurrent,
  write,
  read,
  onConfirmed,
  onError,
})

type ProfileLoadoutChange = {
  key: string;
  apply: (source: PlayerLoadoutResponse) => PlayerLoadoutResponse;
  matches: (actual: PlayerLoadoutResponse) => boolean;
};

// Methods dự kiến:
enqueue(change): Promise<boolean>
getSnapshot(): { display, confirmed, revision, pending, saving, uncertain }
subscribe(listener): () => void
adopt(server): boolean
cancel(): void
whenIdle(): Promise<void>
```

Đây là bản định hướng, có thể điều chỉnh hợp lý khi triển khai; không phải API đã tồn tại.

## 3. Đã sửa source nhưng chưa kiểm tra native: bốn ô graffiti/flex

Agent Herschel hoàn thành đúng ba file:

- `features/profile/ProfileEquipmentSections.tsx`
- `features/profile/profile-expression.styles.ts` — file mới
- `__tests__/profile-expression-section.test.tsx` — file mới

Hành vi source:

- Bốn ô cùng một hàng không wrap, chia đều chiều rộng với gap 8dp.
- Ảnh tối đa 48dp, nhãn caption 12dp, card trắng/viền từ design system.
- Giữ dữ liệu thật, thứ tự, callback, ưu tiên expressions và fallback legacy sprays.
- Accessibility label có tên đầy đủ, loại, vị trí; touch target tối thiểu 48dp.
- Khi upstream trả hơn bốn mục, dùng hàng cuộn ngang để không bỏ dữ liệu.
- Không sửa `profile-screen.styles.ts`; không thêm translation key.

Bằng chứng worker báo:

- RED: 8 test fail trên UI cũ.
- GREEN: 35/35 test qua expression, app viewport và Profile visual policy.
- Scoped coverage hai file source: 100% statements/branches/functions/lines.
- Scoped lint, typecheck và diff check đạt ở thời điểm worker chạy.
- Test renderer có 320/360/430dp và font scale 1/2; không thay thế layout native/TalkBack.

**Chưa kiểm tra giao diện này trên thiết bị; chưa chạy full gate cho toàn bộ worktree sau phần Profile mới.**

## 4. Đang dở: bottom tab bar Liquid Glass

### Input và trạng thái

- Spec người dùng: `C:/Users/kona/Downloads/README-bottom-tabbar-liquid-glass-codex.md` — 3.022 dòng.
- Yêu cầu trực tiếp: làm theo spec và giữ nguyên animation icon hiện có.
- Đã khảo sát spec, cấu trúc navigation, motion và viewport hiện tại.
- Installed Reanimated đã kiểm tra: `4.5.1`.
- **Chưa viết implementation, plan riêng, test mới hoặc thay đổi code nav bar.**
- Chưa sửa `app/(authenticated)/_layout.tsx`, `utils/primary-tab-motion.ts`, `components/ui/PrimaryTabScene.tsx`, `constants/Motion.ts` hoặc `constants/DesignSystem.ts` cho yêu cầu này.

### Các yêu cầu quan trọng phải giữ khi tiếp tục

- Một custom bar persistent, capsule trắng/glass, khoảng 54dp cao, margin 14dp, max width khoảng 420dp trên màn lớn, bottom theo safe area.
- Năm slot bằng nhau; icon khoảng 24dp và label khoảng 11dp; active đỏ, inactive gần đen.
- Lens xám mờ khoảng 50dp cao, width clamp theo slot 76–90dp; spring trượt, stretch nhỏ, magnification/pseudo-refraction và edge highlight.
- Lens khoảng 280–340ms khi đi một tab; content crossfade 110–150ms bắt đầu gần lúc lens đến đích, khoảng 210ms sau tap; không page slide ngang.
- Rapid tap retarget từ vị trí đang chạy, không queue transition, không khóa tap trong 300–500ms.
- Không remount bar hoặc reset scroll state giữa các tab; không JS state mỗi frame, không animate blur/shadow mỗi frame.
- Cold deep link/resume/resize không nhảy lens từ tab mặc định; Reduce Motion, pointer events, accessibility và content bottom inset phải đúng.
- **Giữ animation icon hiện có theo yêu cầu user**, không thay icon thành loại tĩnh hay sửa timing/trigger tùy tiện.
- Tên/thứ tự năm tab trong tài liệu mẫu cần đối chiếu với routes thực tế. Không tự suy ra việc đổi nghiệp vụ của các tab từ code mẫu.
- Dùng token của project; blur Android phải dùng API mới nếu sử dụng. Mẫu TypeScript có `any` hoặc API spring không phù hợp phiên bản chỉ là minh họa.

### Bằng chứng còn thiếu

- Chưa có ảnh/video implementation vì chưa code.
- Chưa có video tham chiếu thực tế trong input đã nhận; chỉ có mô tả/timing trong Markdown.
- Chưa có frame metrics, stress test, kiểm tra đủ năm tab, safe-area matrix hoặc so sánh video.
- Không được tuyên bố đạt “100%” hoặc 60/120fps chỉ từ đọc spec/source.

## 5. Phần trước đó đã tích hợp

Các phần sau đã được viết vào worktree trước đợt Profile/nav bar mới:

| Phần | Source/hành vi đã làm | Giới hạn kiểm tra |
|---|---|---|
| Bundle | Hero đúng variant/tỷ lệ; nền UI trắng; skin card nhỏ; lớp mờ/check từ inventory thật; bỏ estimate | Có ảnh và swipe native ở font bình thường; large-font visual chưa xác minh |
| Party/Combat | UI compact, members, online friends/playercards, mode/privacy, Custom, Start/Ready, code/share/join/invite | Có native đọc dữ liệu/form; không tự smoke-test mutation Riot |
| Agent/match | Bỏ agent list mặc định; popup khi có pregame, explicit lock, chuyển tracker; đội/tỉ số theo dữ liệu thật | Lock/Custom live và toàn bộ flow vẫn còn giới hạn runtime |
| Responsiveness | Accepted Party action xong trước refresh nền; Ready optimistic; guards cho version/receipt/account/race | User xác nhận Start phản hồi ngay; không có đo chính xác Start/Ready → PC |
| Friends | Chỉ online; card từ presence Valorant nested `playerPresenceData`; activity từ `matchPresenceData` | Card thật đã quan sát native; metadata thiếu giữ placeholder |
| Mã phòng | Panel trắng, mã nổi bật, Copy/Share icon; Generate theo empty/populated; Join/Invite hàng dưới | Mã thật và Android Share sheet đã quan sát; assistant không chọn recipient/gửi nội dung |
| API diagnostics | DEV opt-in sanitized JSONL, giới hạn/rotation/loss markers, native append và HTTP timing | Không bao gồm ảnh/XMPP/WebView; body quá lớn có truncation, auth chỉ overview |
| Dependency audit | Patch Joi, fast-uri, brace-expansion qua overrides và lockfile | Audit policy còn bốn advisory transitive đã được ghi nhận từ trước |

Nhóm file chính:

- Bundle: `components/BundleImage.tsx`, `components/BundleItem.tsx`, `hooks/useBundleOwnership.ts`, `utils/bundle-display.ts`, `utils/bundle-ownership.ts`, route bundles.
- Party: `features/party/`, route combat, `services/riot/party-api.ts`, `party-custom-api.ts`, `pregame-actions.ts`, endpoint registry/types.
- Match: `hooks/useCombatStore.ts`, `features/combat/`, `services/riot/combat-response.ts` và combat API.
- Friends: route friends, `utils/chat-service.ts`, `chat-store.ts`, `xmpp-client.ts`, `friend-card.ts`, `friend-presence.ts`.
- Diagnostics: `utils/api-response-logger.ts`, `api-response-redaction.ts`, HTTP clients, tests và `markdown/API_RESPONSE_DIAGNOSTICS.md`.
- Tài liệu/locale: README, CHANGELOG, plans, `assets/i18n/en.json` và `vi.json`.

## 6. Mốc kiểm tra PASS gần nhất — không phải trạng thái hiện tại

Trước khi thêm công việc Profile mới:

- `pnpm run check`: **140 suites / 1.980 tests PASS**.
- Typecheck và lint zero warnings PASS.
- Production audit policy PASS với bốn advisory transitive được policy hiện có ghi nhận; không thêm ngoại lệ để che advisory mới.
- Android export/budget PASS: tổng **10,36MiB / 12MiB**, Hermes **7,89MiB / 8MiB**.
- Global line coverage **64,88%**, chưa đạt mục tiêu chung 80%; scoped controller/forms cao hơn 90%.
- Export tạm được script dọn; đây là export JS/assets, không phải APK/release mới.

Log mốc đó:
`C:/Users/kona/AppData/Local/Temp/vshop-final-check-20260930.log`.

**Hiện tại có test queue RED thiếu module. Không dùng kết quả 1.980 PASS để nói toàn bộ cây code hiện tại đã PASS.** Khi tiếp tục phải hoàn thiện phần dở trước rồi chạy lại kiểm tra thích hợp và full gate.

## 7. Artifact, privacy và dữ liệu cần giữ

- API catalogue: `markdown/API_RESPONSE_DIAGNOSTICS.md`.
- Archive đã lọc ngoài Git: `C:/Users/kona/AppData/Local/CodexApiResponses/Vshop/2026-09-30/`.
- `responses-final.jsonl` là snapshot đã ghi nhận: 468 record, 35.628.955 byte, 21 nhóm URL/method, 0 dòng JSON lỗi, 0 capture-loss, 2 body weapons bị truncation. Không phải dữ liệu byte-for-byte chưa lọc hoặc toàn bộ lịch sử request.
- Các bản `responses-initial.jsonl` và `responses-hardened.jsonl` còn ngoài Git; có thể trùng record, không cộng thành tổng request duy nhất.
- Ảnh Bundle/friend/form hợp lệ đã lưu dưới host Temp và ghi trong các plan trước. Ảnh chứa thông tin cá nhân chỉ phục vụ local QA, không đưa vào Git.
- **Không sử dụng đường dẫn `vshop-party-code-redesign-final-20260930.jpg` trong các ghi chú cũ:** nó đã bị ghi đè khi người dùng chuyển sang ứng dụng khác, và bản chụp ngoài phạm vi đã được xóa. Những lần quan sát panel thật vẫn nằm trong lịch sử tool, nhưng đường dẫn ảnh đó không còn là artifact hợp lệ.
- Khi phát hiện điện thoại đang được dùng ngoài VShop, đã dừng UI automation. Khi tiếp tục cần phối hợp thời điểm kiểm tra native; không đọc/chụp ứng dụng khác để làm QA cho VShop.
- Font hệ thống đã trả về giá trị ban đầu `1.0`. Các lần capture font 1.8 chỉ thấy startup/Dev Launcher nên không chứng minh large-font layout.
- Một lỗi dev giữa chừng là Metro đọc file controller đang ghi dở; stable source sau đó đã qua build/test và app được mở lại. Không lấy lỗi trung gian hoặc ảnh startup làm bằng chứng font-layout failure.
- Managed worktree `bundle-reference-refine` đã được archive recoverably. OpenCode GLM 5.3 run trước đó timeout; phần patch hữu ích được Codex review/sửa/tích hợp, không gắn nhãn worker run thành công.

## 8. Thay đổi có sẵn của người dùng — phải bảo toàn

Hai file sau đã dirty từ trước, không thuộc implementation của đợt này; hash tại lúc dừng vẫn khớp baseline:

```text
components/ui/AppRefreshControl.web.tsx
E629E5C2C2F3E0C141AA4A5F96EC2B299B6F52A09BDEBE5AB525E0D7B8CF56AF

components/ui/AppViewport.tsx
1A46BDEE7AC13A7B88828904507D5EAD36C9F098113438F79D8EF2E511502962
```

Không reset/clean/checkout phá hủy worktree. Không stage/commit log, token, cookie, APK, build output hoặc file riêng tư. Lúc tiếp tục phải đọc lại AGENTS.md và trạng thái thực tế vì thông tin runtime có thể đã thay đổi.

## 9. Thứ tự tiếp tục đề xuất — chỉ khi user yêu cầu

1. Đọc bản bàn giao và `git status`; kiểm tra có thay đổi mới của người dùng.
2. Hoàn thiện pure loadout queue để test RED có module thật; tích hợp mutation/picker/fetch/cache với session/version guards.
3. Review và test các race đã liệt kê; giữ phần bốn ô đã làm, kiểm tra native khi người dùng không đang sử dụng ứng dụng khác.
4. Viết plan nav bar từ spec đã cung cấp, đối chiếu routes, giữ icon animation, rồi triển khai motion/surface/crossfade theo contract.
5. Chạy full gate sau khi mọi writer dừng; kiểm tra native, frame metrics và reference riêng. Không gộp source/build/runtime thành một tuyên bố PASS.
6. Báo kết quả và giới hạn còn lại. Commit/push/APK/OTA chỉ thuộc một bước phát hành được người dùng yêu cầu.
