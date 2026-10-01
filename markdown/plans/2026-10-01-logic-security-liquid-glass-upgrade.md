# Plan: Nâng cấp tầng logic, bảo mật và Liquid Glass — VShop

- **Ngày:** 2026-10-01
- **Phạm vi:** Android (build đích duy nhất), giữ nguyên nguyên lý cốt lõi của mọi function/request hiện có (không đổi contract API, không đổi shape store, không đổi luồng sync/session).
- **Cơ sở:** LOGIC_AUDIT.md (39 findings đã fix), báo cáo re-analysis 2026-09-27 (các HIGH/MEDIUM/LOW chưa fix), kỹ năng liquid-glass + liquid-glass-motion + secure-code-guardian.

## Trạng thái hiện tại của glass (đã khảo sát)

| Thành phần | Trạng thái |
|---|---|
| `modules/vshop-liquid-glass` (Kotlin: RefractionLensView, RefractionTargetView, LensRenderer, LensGeometry, LensLifecycle + unit test) | Đã build, **chưa có wrapper JS, chưa dùng ở đâu** |
| `components/ui/LiquidGlassSurface.tsx` (LiquidGlassDecoration/Surface, SVG tĩnh) | Đang dùng rộng rãi (shop/gallery/profile/party) |
| `components/ui/LiquidGlassBackdrop.tsx` | Đang dùng (store card, profile identity) |
| `components/ui/liquid-glass-native-policy.ts` (slot ≤6 native glass, reduce transparency/motion) | Sẵn sàng, chưa consumer nào |
| `@callstack/liquid-glass ^0.8.2` (package.json, chưa commit) | Chưa import; peer yêu cầu RN 0.87.1 patch, chỉ implement iOS → **quyết định: bỏ ra, không dùng** |

## WS-A — Tầng logic (giữ nguyên contract, chỉ siết đúng-sai)

| # | Việc | File | Mức |
|---|---|---|---|
| A1 | Rollback transfer phải khôi phục danh sách tài khoản đã lưu: capture account store vào snapshot trước `clearSavedAccounts()`, restore trong catch (thêm deps `getAccounts`/`setAccounts`), hoặc chuyển `clearSavedAccounts` xuống sau khi `syncAllData` thành công | `services/accounts/transferred-session.ts` + `.runtime.ts` | HIGH |
| A2 | `activateTransferredAccount` chạy trong `runSessionOperation` + dùng chung mutex `switchInProgress`; `switchSavedAccount` chỉ capture `previousData` sau khi có mutex; từ chối activation khi `isSessionRecoveryPaused()` | `services/accounts/transferred-session.ts`, `services/accounts/session.ts` | HIGH |
| A3 | Cancel trong lúc "activating": `activate()` re-check attempt trước khi publish `status: "ready"`; panel ẩn Cancel hoặc huỷ đúng | `hooks/useMobileAccountMirror.ts`, `MobileAccountMirrorPanel.web.tsx` | MED |
| A4 | Đường transfer gọi `invalidateResourceCaches()` + `clearStartupCache()` lúc bắt đầu và trong rollback (tái dùng helper `session-cache.ts`) | `services/accounts/transferred-session.ts` | MED |
| A5 | Chat: catch của `initChatService` chỉ đụng global khi `activeConnectionKey === connectionKey`, ngược lại disconnect client mồ côi; `keepSessionData` giữ `rosterRevision` đơn điệu + set status "disconnected" | `utils/chat-service.ts` | MED |
| A6 | Gộp code trùng: `mapWithConcurrency` → `utils/network.ts` (session-insights import lại); `getCompetitiveQueueSkill` → `utils/profile-rank.ts`; đổi tên 1 trong 2 `toTitleCase`; `API_DEBUG_LOGGING` import từ `request-context.ts` | `features/combat/session-insights.ts`, `features/matches/season-mmr-summary.ts`, `services/riot/client.ts` | LOW |
| A7 | Polish: `__DEV__` guard 3 console.warn (`app-update.ts:101,253`, `riot-cookies.ts:214`); bỏ 2 `@ts-ignore` yếu (`useWishlistStore.ts`, `PlausibleProvider.tsx`); wire `services/pentest-companion/client.ts` thành twin `.native.ts` hợp lệ; xoá `@expo/vector-icons` khỏi package.json (chạy lại app-icon-boundary test) | nhiều file | LOW |
| A8 | Bỏ `@callstack/liquid-glass` khỏi package.json (peer RN 0.87.1, chỉ iOS — không giá trị cho Android) | `package.json` | LOW |

## WS-B — Bảo mật

| # | Việc | File |
|---|---|---|
| B1 | `start-web-pentest.cjs`: đổi denylist → **allowlist** env (PATH/NODE_ENV/SYSTEMROOT/… + VSHOP_PENTEST_*); thêm test asserting biến `*_KEY`, `*_PASSWD` bị loại | `scripts/start-web-pentest.cjs`, `__tests__/` |
| B2 | Validate `stateSnapshot` trong envelope trước khi áp: shape + size cap tương ứng manifest (≤200 matches, ≤3 profile caches, ≤2000 wishlist) → từ chối bằng `TRANSFERRED_SNAPSHOT_REJECTED` | `services/accounts/transferred-session.ts` (`snapshotForSelectedAccount`) |
| B3 | Companion: strip header `authorization` khi redirect sang host Riot khác kind; move status-check claim vào cùng block sync sau `readJson` (hết TOCTOU claim 2 lần); global cap client sessions + auth browsers (429 khi vượt) | `scripts/lib/riot-pentest-companion.cjs` |
| B4 | Map error-code mirror → i18n key riêng: needs-reauth / expired / superseded / generic (hết 1 message chung) | `MobileAccountMirrorPanel.web.tsx`, locale en/vi |
| B5 | `snapshot-data.ts`: pick field cookie tường minh thay vì spread toàn bộ cookie object | `services/mobile-handoff/snapshot-data.ts` |

## WS-C — Liquid Glass theo ngôn ngữ Apple (Android-first)

Nguyên tắc áp dụng từ skill liquid-glass (phiên bản RN/Android của VShop, giữ token trong `constants/DesignSystem.ts` + `constants/Motion.ts`):

| # | Việc | Ghi chú |
|---|---|---|
| C1 | Tạo `components/ui/LiquidGlassLens.tsx` (+ `.web.tsx` fallback → LiquidGlassDecoration): wrapper của `RefractionLensView`/`RefractionTargetView` qua `requireNativeComponent`/`expo-modules-core`; gate bằng `useNativeGlassSlot` (≤6 lens) + `useNativeGlassPreferences` (reduce transparency → fallback tĩnh; reduce motion → tắt animation lens) | Glass thật = khúc xạ nền; cần content động phía sau (artwork/gradient) mới có hiệu lực quang học |
| C2 | Biến thể material theo Apple: `regular` (mặc định), `clear` (density), tone light/dark; `interactive` cho pressable: squish = scale transform Reanimated trên UI thread (không opacity), Reduce Motion → scale 1 | Không fade glass — mount là có, remove là biến mất (materialize chỉ mô phỏng được bằng transform) |
| C3 | Áp lens vào chrome: FloatingTabBar, modal bundles, header shop/night market (đã có BlurView) → đổi sang lens khi slot trống; **cấm glass-on-glass**: audit các chỗ GlassCard lồng trong LiquidGlassSurface, sửa bằng cách glass chỉ ở lớp ngoài cùng | GlassCard.tsx giữ làm fallback tĩnh |
| C4 | Siết rules: không đặt `opacity<1` lên ancestor của lens; text/artwork luôn nằm trên lớp glass; nền phẳng 1 màu → không dùng lens (trở thành chữ nhật màu) | Checklist review trong BUILD_DESIGN_SYSTEM.md |
| C5 | Hiệu năng: lens chỉ cho card nổi bật (≤6), grid dày dùng decoration tĩnh; đo frame metrics bằng script Android UI verify sẵn có trước/sau | Tôn trọng MAX_NATIVE_GLASS_CARDS |
| C6 | Cập nhật tài liệu: BUILD_DESIGN_SYSTEM.md (mục Liquid Glass), DIRECTORY_STRUCTURE.md, CHANGELOG | |

## WS-D — Kiểm thử & verify

1. Test mới bắt buộc:
   - `__tests__/transferred-session.test.ts`: rollback giữ nguyên danh sách tài khoản; activation tuân thủ queue/mutex; snapshot reject khi sai shape.
   - `__tests__/pentest-env-filter.test.js`: biến `*_KEY`/`*_PASSWD` bị loại khỏi env spawn.
   - Regression claim TOCTOU (mở rộng test companion có sẵn).
   - Test gate lens: quá 6 slot → fallback decoration; reduce transparency → fallback.
2. `pnpm run check` (typecheck + eslint --max-warnings=0 + test + audit).
3. `pnpm exec expo export --platform android --output-dir .codex-tmp/android-check-<n>` (budget ≤12MB) → xoá thư mục tạm sau khi verify.

## WS-E — Release

1. `CHANGELOG.md`: mục phiên bản mới (glass lens, security hardening, logic fixes).
2. Version: `package.json` + `app.json` → 4.2.0, Android `versionCode` 92 (iOS buildNumber giữ nguyên — không build iOS).
3. Commit theo phạm vi (logic/security/glass tách batch), push lên `main`.
4. `eas build -p android --profile production`.

## Acceptance criteria (mục nào xong phải có bằng chứng tương ứng)

- [ ] AC1: Test transferred-session chứng minh account list được restore sau rollback khi `syncAllData` fail.
- [ ] AC2: Test chứng minh activation và switch không chạy song song (queue/mutex).
- [ ] AC3: Test env-filter chặn biến chứa `KEY`/`PASSWD`.
- [ ] AC4: Test snapshot validation reject envelope sai shape/size.
- [ ] AC5: `pnpm run check` xanh; export android đạt budget; thư mục tạm đã xoá.
- [ ] AC6: Lens xuất hiện trên ≥1 chrome surface (tab bar hoặc modal) có fallback đầy đủ; ảnh chụp thiết bị + frame metrics ghi trong plan này khi hoàn tất.
- [ ] AC7: CHANGELOG + version bump + push thành công; EAS build android production lên dây.
