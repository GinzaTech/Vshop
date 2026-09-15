# LOGIC_AUDIT.md — Kiểm toán & Sửa lỗi tầng logic VShop

## Đợt sửa tiếp theo — 2026-09-15

Kế hoạch ECC: tái hiện lỗi bằng test; triển khai song song theo phạm vi file;
review tích hợp; chạy typecheck, lint, test, production audit và Android export.

- Bảo mật: trace/log mặc định tắt, loại credential khỏi storage trace và log;
  OAuth dùng state/nonce riêng cho từng lần đăng nhập.
- Tài khoản: rollback user và dữ liệu cùng nhau, xoá cache khi logout,
  vô hiệu hoá request đang chạy trước khi reset; tuần tự hoá startup marker.
- API/cache: key request theo credential/generation; giữ dữ liệu tốt khi
  một nguồn lỗi, chỉ đánh dấu nguồn fetch thành công là fresh.
- Màn hình: chống response cũ ghi state, cập nhật leaderboard khi đổi region,
  dừng polling khi mất focus, cleanup refresh.
- Thống kê: phân biệt thắng/thua/hoà/huỷ/chưa rõ; thống nhất mẫu số win rate.
- Bảo trì: tách logic của các module lớn, bổ sung test hành vi và nâng coverage gate;
  đưa export/budget vào lệnh check thống nhất, chuyển npm lock cũ sang backup.

Rủi ro chính: rollback trong lúc request B còn chạy; logout/login cùng tài khoản;
refresh token giữa request; API trả null do lỗi bị nhầm thành chưa xếp hạng.
Test phải điều khiển thứ tự resolve promise và kiểm tra cả state lẫn persist.

Đính chính audit: CI `quality.yml` đã có Android export và budget ở bước riêng.
Đợt này hợp nhất vào `pnpm run check` để lệnh local và CI có cùng tập kiểm tra.
### Kiểm chứng và giới hạn

- Full `pnpm run check` sau review cuối: 66 suite / 728 test PASS, TypeScript strict
  và ESLint không warning; Android export 2.695 module PASS.
- Bundle budget: tổng 9,77 MiB / 12 MiB, JS/Hermes 7,30 MiB / 8 MiB,
  asset lớn nhất 1,25 MiB / 1,5 MiB. Export tạm được tự dọn.
- Audit dependency đạt policy hiện tại với 8 advisory transitive đã biết;
  **không có nghĩa dependency không có lỗ hổng**. Sáu advisory moderate/high
  có lý do allowlist trong `scripts/audit-production.mjs`; hai advisory Joi low
  không chặn theo policy hiện tại. Không thay đổi allowlist trong đợt này.
- Coverage toàn ứng dụng: statements 44,65%, branches 38,66%,
  functions 38,66%, lines 44,50%. **Mục tiêu ECC 80% toàn app chưa đạt**.
  Jest giữ nguyên tập source/UI được đo; thêm floor 80% mỗi metric cho các
  domain đã được kiểm chứng (session, cache, sync, screen data hooks, Combat hooks,
  match actions và logging/auth). Jest loại các domain riêng khỏi nhóm global;
  floor phần còn lại là branches 22%, functions 24%, lines/statements 26%.
  Match transforms và các hook UI Profile vẫn còn nhánh thiếu test.
- Review cuối có thêm RED thật: chỉ đổi entitlements token vẫn cho loadout
  cũ cập nhật Profile. Bổ sung guard token thứ hai; suite hook 10/10 GREEN,
  gồm regression đổi từng token riêng lẻ.
- 17 loại sơ đồ: 19 khối Mermaid parse thành công, 93 liên kết nội bộ tồn tại.
  Xem [mục lục](markdown/README.md); mô hình ERD là logical cache model, không SQL.
- Thiết bị Android từng kết nối, cài dev `com.android.vshop` 4.1.6/code87.
  Dev Launcher gặp lỗi nối Metro; sau khi đổi binding Metro, ADB mất thiết bị.
  **UI máy thật trên source mới: NOT VERIFIED**. Không suy ra FPS, chuyển card,
  multi-Act hay tài khoản thật hoạt động từ unit/render tests hoặc export.
- Chuẩn bị native 4.1.7/code88, iOS build40; chưa coi APK production tồn tại
  khi EAS chưa báo FINISHED cùng artifact URL. Không phát hành OTA trong đợt này.
- Quét source thay đổi/mới: không phát hiện private key, JWT dạng đầy đủ,
  GitHub/OpenAI token theo các mẫu quét; không có `.env`, APK, keystore, log,
  cache hay thư mục tạm trong tập thay đổi. Đây là scan có giới hạn, không phải
  chứng nhận bảo mật toàn diện. `git diff --check` PASS.
- Hook ECC phát hiện chuỗi password giả trong test redaction; fixture đã được
  rút gọn, vẫn kiểm tra đúng việc loại dữ liệu khỏi trace. Không tắt hook.
  `.easignore` loại cả checkout ECC và config OpenCode cục bộ khỏi upload.

### Các invariant bổ sung đã có regression

Rollback vẫn khôi phục region/cookie khi dọn startup metadata lỗi; logout/reset
vô hiệu hóa request cũ dù đăng nhập lại cùng credential; forced refresh mới nhất
giữ dữ liệu; hydrate từ storage không làm sống lại cache đã reset; partial Profile
failure không tạo vòng fetch tự lặp, null rank thành công xoá rank cũ; huỷ/chưa rõ
được hiển thị trung lập và không bị đếm thành thua.

## Audit lịch sử — 2026-09-13

Phần dưới giữ lại ghi chép tại thời điểm audit trước. Một số nhãn “dự kiến/chưa
sửa” là trạng thái ban đầu; kết quả tích hợp hiện tại và giới hạn nằm ở đầu file.

> Ngày audit: 2026-09-13
> Phạm vi: **chỉ tầng logic** (data flow, cache, race condition, state, lifecycle).
> Không sửa UI. Mọi thay đổi được ghi lại trong file này sau khi fix xong từng nhóm.

---

## 📋 TỔNG QUAN

Audit được thực hiện từ 4 góc độ song song:

| Góc độ | Phạm vi | Tìm thấy |
|---|---|---|
| Data/Cache layer | `utils/data-sync.ts`, `app-sync.ts`, `profile-cache.ts`, `auth-session.ts`, `valorant-api/*`, `storage.ts`, `wishlist.ts` | 4 High, 9 Medium, 13 Low |
| Stores/Hooks | `hooks/*` (user, match, profile-cache, combat, wishlist, account), `utils/chat-store.ts` | 3 High, 7 Medium, 10 Low |
| Screens | `app/_layout.tsx`, `features/profile/ProfileScreen.tsx`, `match_details`, `leaderboard`, `combat_session`... | 1 High (cốt lõi), nhiều Medium/Low |
| Background/Lifecycle | `components/AppWarmup.tsx`, `LoginWebView.tsx`, `chat-service.ts`, `index.ts` | 4 High, 5 Medium, 8 Low |

**Timeline cold start (đã verify):**

```text
t=0    JS bundle: Sentry.init → registerHeadlessTask → MMKV persist rehydrate (sync)
t=1    RootLayout bootstrap:
       → renewSavedAccountSession (nếu token hết hạn)  [reAuth + entitlements + geo]
       → syncAllData                                    [FULL SYNC #1: ~15-20 request]
          entitlements, geo, assets, agents, username, shop, progress, balances,
          riotclientconfig, fetchMatches, fetchProfileWarmCache
       → router.replace("/profile") → AppWarmup mount
t+250-900ms   chat connect        [PAS token + riotclientconfig + XMPP + roster names]
t+3000ms      refreshShopAndBalances(false)   [no-op nếu markSynced đã stamp]
t+5200-7800ms fetchMatches                    [no-op nếu TTL 30 phút còn]
mỗi 15s       inspectConnection → có thể recoverSession → FULL SYNC #2
```

---

# 🔴 NHÓM HIGH (8 vấn đề)

## H1. Profile fetch lặp 2 lần mỗi cold start với account không rank ⛳ ROOT CAUSE
- **File:** `features/profile/ProfileScreen.tsx` (effect chính), `utils/profile-cache.ts` (`hasValidCompetitiveRankCache`, persist path)
- **Hiện tượng:** Effect bỏ qua fetch chỉ khi `hasValidCompetitiveRankCache` = true. Account không rank → `competitiveRank: null` → fail → fall-through → fetch full `playerLoadout + 6×ownedItems + MMR` dù `syncAllData` vừa preload xong.
- **Ngòi nổ thứ 2:** khi rank null, `rankCacheVersion: undefined` được persist → điều kiện **không bao giờ** true → lặp vĩnh viễn mỗi cold start/foreground.
- **Chi phí:** `ownedItems` (×6) + `getCompetitiveMMR` không cache/dedup → 7 request mạng thật bị duplicate.
- **Trạng thái:** ✅ Đã sửa (xem Nhật ký — Group C)

## H2. `refreshShopAndBalances` ghi đè token mới bằng token cũ
- **File:** `utils/app-sync.ts`
- **Hiện tượng:** guard chỉ so `region|id`, không so `accessToken`. Pull-to-refresh shop trùng lúc token renew → response cũ ghi `setUser({...token cũ})` đè token mới → 401 dây chuyền → vòng recovery.
- **Trạng thái:** ✅ Đã sửa (Group A)

## H3. Vòng lặp retry full-sync 15s vô hạn khi lỗi persistent — ✅ Đã sửa (Group D)
- **File:** `components/AppWarmup.tsx` (catch của recoverSession + poll loop)
- **Hiện tượng:** lỗi không thuộc transient/reauth (vd clientconfig 404) → `recoveryNeeded = true` → poll 15s chạy lại `syncAllData` (~20 request) vô hạn, không backoff, không cap.
- **Fix dự kiến:** thêm exponential backoff + cap số attempt liên tiếp; reset khi sync thành công.
- **Trạng thái:** ⬜ Chưa sửa

## H4. Double full `syncAllData` lúc cold start khi token sắp hết hạn — ✅ Đã sửa (Group D)
- **File:** `app/_layout.tsx` (bootstrap) + `components/AppWarmup.tsx` (poll + recovery)
- **Hiện tượng:** bootstrap sync xong → AppWarmup mount → poll đầu thấy token ≤5 phút → renew + full sync lần 2 chỉ vài giây sau lần 1 (~38-42 request thay vì ~20).
- **Fix dự kiến:** grace period "vừa sync xong" — recovery bỏ qua renew/sync nếu syncAllData thành công trong N giây gần nhất.
- **Trạng thái:** ⬜ Chưa sửa

## H5. Stale-over-fresh: sync cũ ghi đè data mới
- **File:** `utils/data-sync.ts`
- **Hiện tượng:** `cachedUser` snapshot đầu sync, fetch mất vài giây, rồi `setUser` không kiểm tra data freshness. `refreshShopAndBalances` kịp ghi balances mới hơn → `syncAllData` về sau ghi đè bằng data cũ hơn.
- **Trạng thái:** ✅ Đã sửa (Group A — full-sync registry + token-guard + stamp sớm)

## H6. Delta-sync match thất bại vẫn stamp cache "fresh" + match kẹt "unavailable"
- **File:** `hooks/useMatchStore.ts` (delta path)
- **Hiện tượng:** (a) catch của delta path set `lastUpdated: Date.now()` dù fail → không retry trong 30 phút. (b) match detail fetch fail trong delta loop → `stats: null` persist, `knownIds` khiến không bao giờ retry.
- **Trạng thái:** ✅ Đã sửa (Group B)

## H7. `force=true` (pull-to-refresh history) bị nuốt bởi delta sync đang chạy
- **File:** `hooks/useMatchStore.ts`
- **Hiện tượng:** force refresh join promise của delta sync → full re-fetch không chạy → spinner tắt, data cũ.
- **Trạng thái:** ✅ Đã sửa (Group B)

## H8. Đổi token = xoá toàn bộ chat giữa session — ✅ Đã sửa (Group E)
- **File:** `components/AppWarmup.tsx` + `utils/chat-service.ts` + `utils/chat-store.ts`
- **Hiện tượng:** connection key chứa token → mỗi renew (~1h) → Effect re-run → disconnect → `resetChatSession()` wipe friends/messages. User đang đọc chat thì màn hình trống.
- **Fix dự kiến:** chỉ reset chat store khi **đổi account** (user id đổi); reconnect cùng account thì giữ nguyên friends/messages/pendingPresence.
- **Trạng thái:** ⬜ Chưa sửa

---

# 🟠 NHÓM MEDIUM (15 vấn đề)

## M1. `syncAllData` và `refreshShopAndBalances` không dedup chung — ✅ Đã sửa (Group A)
## M2. Match fetch fail vẫn được `markSynced(["matches"])` — ✅ Đã sửa (Group A)
## M3. Ownership fetch fail 1 phần → cache persist danh sách rỗng — ✅ Đã sửa (Group C)
## M4. Foreground recovery luôn full-sync, bypass TTL — ✅ Đã sửa (Group D)
- **File:** `components/AppWarmup.tsx` (recoverSession foreground) vs `utils/app-sync.ts` (TTL)
- Mỗi lần ra/vào app = 1 full `syncAllData`; TTL shop 6h thành dead code.
- **Fix dự kiến:** recovery kiểm tra TTL (`isStale`/`shouldSkipFullSync`) trước; còn fresh thì bỏ qua full sync.
- **Trạng thái:** ⬜ Chưa sửa

## M5. `fetchSeasonStats` re-crawl mỗi khi `setUser` nếu lần trước fail — ✅ Đã sửa (Group B — negative-cache 15 phút)
## M6. `fetchLoadoutData` re-arm mỗi khi user identity đổi — ✅ Đã sửa (Group C — ref-based)
## M7. `match_details` setState trực tiếp phá LRU + crash — ✅ Đã sửa (Group F)
- **File:** `app/(authenticated)/match_details/[id].tsx` + `hooks/useMatchStore.ts` (LRU)
- Ghi `detailsById` ngoài LRU → entry rác `{playerIdentities}` → cache-hit trả object lỗi → crash.
- **Fix dự kiến:** thêm store action `mergeMatchDetails(matchId, patch)` cập nhật cả LRU order; screen gọi action thay vì setState trực tiếp.
- **Trạng thái:** ⬜ Chưa sửa

## M8. PTR của Profile bị nuốt khi initial fetch đang chạy — ✅ Đã sửa (Group C)
## M9. Leaderboard: re-fetch mỗi `setUser` + lỗi transient xoá list — ✅ Đã sửa (Group F)
- **File:** `app/(authenticated)/leaderboard.tsx`
- Không TTL/dedup; lỗi mạng → `setPlayers([])` xoá list (vi phạm rule giữ cache).
- **Fix dự kiến:** deps chỉ dựa vào primitive (qua ref); lỗi transient giữ `players` cũ.
- **Trạng thái:** ⬜ Chưa sửa

## M10. `buildAuthenticatedUser` all-or-nothing: fail 1 downstream = mất entitlements token mới — ✅ Đã sửa (Group A)
## M11. `loadAssets()`/`loadAgent()` fail làm chết toàn bộ sync Riot — ✅ Đã sửa (Group A)
## M12. `ensureChatService` trong lúc đang connecting → throw giả — ✅ Đã sửa (Group E)
- **File:** `utils/chat-service.ts`
- Dedup bằng Set nhưng không share promise → caller thấy `xmppClientInstance = null` → throw "Could not connect" dù connect đang chạy.
- **Fix dự kiến:** lưu Promise vào Map, caller await promise đó.
- **Trạng thái:** ⬜ Chưa sửa

## M13. Roster name retry chết — ✅ Đã sửa (Group E)
- **File:** `utils/chat-service.ts`
- Catch set `rosterNameResolveKey = null` → predicate retry không bao giờ match → friends "Unknown".
- **Trạng thái:** ⬜ Chưa sửa

## M14. `loading`/`hydrating` flag leak giữa sessions — ✅ Đã sửa (Group B — re-check authKey sau await)
## M15. AppWarmup delay-fetch matches dùng user cũ + `reauthRequested` không reset — ✅ Đã sửa (Group D)
- **File:** `components/AppWarmup.tsx`
- (a) User bị capture trước delay 5.2-7.8s → switch account → fetch sai account.
  (b) `reauthRequested` set true không bao giờ reset → lần 2 token chết → navigateToReauth im lặng.
- **Trạng thái:** ⬜ Chưa sửa

---

# 🟡 NHÓM LOW

| # | File | Vấn đề | Trạng thái |
|---|---|---|---|
| L1 | `utils/profile-cache.ts` | `force` option bị rơi trong `fetchProfileWarmCache` | ✅ Đã sửa (Group C) |
| L2 | `utils/app-sync.ts` | TTL matches 5 phút < store 30 phút | ✅ Đã sửa (Group A — align 30 phút) |
| L3 | `profile-cache.ts` vs `saved-accounts.ts` vs `history.tsx` | authKey casing không nhất quán | ✅ Đã sửa (Group C — delegate chuẩn; history.tsx sẽ đổi ở Group F) |
| L4 | `useMatchStore.ts` | Match history persist không cap | ✅ Đã sửa (Group B — cap 200) |
| L5 | `app/_layout.tsx` | Wishlist bg-fetch đọc store trước hydrate (fallback path) | ✅ Đã sửa (Group F) |
| L6 | `chat-service.ts` | Reconnect không check network, không cap | ✅ Đã sửa (Group E) |
| L7 | `CombatSessionScreen.tsx` | Poll 10s không gate focus | ✅ Đã sửa (Group F) |
| L8 | `useMatchStore.ts` | Season stats off-by-one + fail-all | ✅ Đã sửa (Group B) |
| L9 | data-sync + chat-service | `getRiotClientConfig` fetch 2 lần song song | ✅ Đã sửa (Group F) |
| L10 | `shop.tsx`, `night_market.tsx` | Countdown trôi (tính target mỗi render) | ✅ Đã sửa (Group F) |
| L11 | `ProfileScreen.tsx` | Comment sai effect chính | ✅ Đã sửa (Group C) |
| L12 | `utils/profile-cache.ts` | `profileWarmupCache` không evict | ✅ Đã sửa (Group F) |
| L13 | `app/_layout.tsx` | Bootstrap re-run edge → isPreloading kẹt | ✅ Đã sửa (Group F) |
| L14 | `utils/wishlist.ts` | Notify "no hit" cả khi foreground; checkShop không guard | ✅ Đã sửa (Group F) |
| L15 | `night_market.tsx` | Hardcode `"KONA_Prime"` | ✅ Đã sửa (Group F) |
| L16 | `utils/chat-store.ts` | Dedup nuốt message hợp lệ; party messages không sort/cap | ✅ Đã sửa (Group E) |

---

# ✅ ĐÃ VERIFY — KHÔNG CẦN SỬA

- Token renewal dedup + serialize qua `runSessionOperation` (`services/accounts/session.ts`)
- 401 storm sau rotation được filter đúng bằng token-comparing auth-failure events
- `initChatService` double-socket init qua token rotation (có `initializingConnectionKeys` + re-check key)
- Combat orientation lock/unlock portrait khi rời màn
- `LoginWebView` double-navigation + callback-before-ready races
- Cleanup timers/intervals AppWarmup, XMPP keep-alive
- Zustand selectors — không có inline object selector gây re-render loop
- `getPlayerNames` partial-overlap dedup + LRU 60 phút
- `request-deduper.ts` release đúng cả fulfill/reject

---

# 📝 NHẬT KÝ SỬA

## ✅ Group A — app-sync / data-sync / auth-session (xong)
- **H2** `utils/app-sync.ts`: `refreshShopAndBalances` verify `currentUser.accessToken === user.accessToken` trước khi ghi store — token cũ không thể đè token mới đã renew.
- **H5/M1** `utils/app-sync.ts` + `utils/data-sync.ts`: registry `fullSyncInFlight` (`beginFullSync`/`endFullSync`/`isFullSyncInFlight`); `syncAllData` đăng ký quanh sync, `refreshShopAndBalances` nhường đường khi full sync cùng account đang chạy → hết double-fetch shop + stale-overwrite. `markSynced(["shop","balances"])` stamp ngay sau khi `buildAuthenticatedUser` ghi xong.
- **M2** `utils/data-sync.ts`: `fetchMatches` trả `Promise<boolean>`; `markSynced(["matches"])` chỉ khi fetch thành công.
- **M10** `utils/auth-session.ts`: `buildAuthenticatedUser` catch từng call — username bắt buộc (throw), shop/progress/balances fallback từ seedUser → không vứt entitlements token mới.
- **M11** `utils/auth-session.ts`: `loadAssets()`/`loadAgent()` bọc `.catch(() => null)` — valorant-api.com sập không chặn sync Riot.
- **L2** `utils/app-sync.ts`: `SYNC_TTL.matches` 5 → 30 phút, khớp store.

## ✅ Group B — useMatchStore (xong)
- **H6a** Delta-sync catch KHÔNG bump `lastUpdated` khi fail.
- **H6b** Delta-sync RETRY match `stats: null` (loại khỏi knownIds); retry REPLACE thay vì append.
- **H7** `force=true`: đợi delta xong rồi chạy full fetch; full đang chạy thì join. Tracker thêm `kind`.
- **M5** `fetchSeasonStats`: negative-cache 15 phút khi fail; PARTIAL results được chấp nhận (throw chỉ khi 0 detail).
- **M14** Re-check `authKey` sau mọi await ranh giới (loadAssets, getNetworkProfile) → flag không leak giữa sessions.
- **L4** `partialize` cap 200 matches (`MAX_PERSISTED_MATCHES`).
- **L8** Season stats `endIndex` inclusive chuẩn (`- 1`).

## ✅ Group C — ProfileScreen + profile-cache (xong)
- **H1 (ROOT CAUSE)** `hasValidCompetitiveRankCache` → semantics version-only; luôn stamp `rankCacheVersion` kể cả rank null (cả warm-cache internal lẫn ProfileScreen persist). Account không rank hết re-fetch full mỗi cold start.
- **M3** Ownership seed từ cache trước (union) thay vì rỗng.
- **M6** `fetchLoadoutData` đọc user/rank/cache qua REF → deps ổn định → effect không re-arm khi `setUser` nền.
- **M8** Guard in-flight chỉ chặn request thường; FORCE (PTR) đi tiếp.
- **L1** `fetchProfileWarmCache` forward `force`; in-flight key phân biệt force/cached.
- **L3 (1/2)** `getSessionAuthKey` delegate `getAccountSessionKey` (lowercase chuẩn toàn app).
- **L11** Comment effect chính đúng thực tế.

## ✅ Group D — AppWarmup + session recovery (xong)
- **H3** Recovery lỗi persistent giờ có exponential backoff (15s → 10 phút) + cap 5 lần liên tiếp; quá cap → suspend chờ sự kiện foreground/network-restored. Transient error không tính vào bộ đếm.
- **H4** Grace period 60s sau full sync (`getLastSync("shop")`): AppWarmup không còn renew + full-sync lần 2 ngay sau bootstrap.
- **M4** Foreground/token-expiring recovery check `shouldSkipFullSync()` — shop + matches còn fresh thì bỏ qua data sync (chỉ giữ session + chat).
- **M15a** Delayed fetchMatches resolve user TẠI THỜI ĐIỂM FIRE qua `useUserStore.getState()` — hết fetch sai account sau switch trong delay window. Bỏ `sessionUserRef`.
- **M15b** `reauthRequested` reset khi recovery thành công → lần token chết kế tiếp điều hướng /reauth bình thường.

## ✅ Group E — chat-service + chat-store (xong)
- **H8** `disconnectChatService({ keepSessionData })`: AppWarmup cleanup so sánh user id tại thời điểm cleanup — token renew (cùng account) chỉ ngắt socket, GIỮ friends/messages; đổi account/logout vẫn wipe.
- **M12** `initializingConnectionKeys` Set → Map<string, Promise>: caller gọi trong lúc init AWAIT promise đang chạy thay vì nhận undefined rồi throw giả "Could not connect".
- **M13** `resolveRosterNames` catch giữ nguyên `rosterNameResolveKey` → timer retry 2.5s hoạt động lại; callback retry reset key trước khi thử.
- **L6** Reconnect: cap `MAX_RECONNECT_ATTEMPTS = 8` + check `getNetworkProfile()` trước khi bắn — hết loop vô hạn khi offline.
- **L16** Chat store: dedup heuristic 2s chỉ áp cho tin INCOMING (tin outgoing có ID duy nhất được gửi lại bình thường); `addPartyMessage` sort theo timestamp; cap 500 tin/hội thoại.

## ✅ Group F — misc screens + utils (xong)
- **M7** Store action `mergeMatchDetails(matchId, patch)` đi qua LRU; entry bị evict → bỏ patch an toàn. `match_details/[id].tsx` gọi action thay vì setState trực tiếp (hết crash entry rác + LRU diverge).
- **M9** Leaderboard: credentials qua ref → effect init chỉ re-run khi `hasCredentials` đổi; lỗi fetch giữ list cũ (stale-while-error), không còn `setPlayers([])`.
- **L3 (2/2)** `history.tsx` dùng `getSessionAuthKey` chuẩn hóa thay vì nối chuỗi thô.
- **L5** Wishlist background-fetch init subscribe store (chạy lại sau hydrate) thay vì đọc 1 lần lúc mount.
- **L7** Combat session poll 10s gate bởi `isScreenFocused` — hết poll ngầm khi user ở tab khác.
- **L9** `getRiotClientConfig`: TTL cache 5 phút + in-flight dedup — data-sync và chat-service không còn fetch song song 2 lần lúc startup; chỉ cache kết quả thành công.
- **L10** Shop + Night Market countdown target dùng `useMemo` — hết trượt mốc khi re-render.
- **L12** `profileWarmupCache` evict giữ 6 account mới nhất; `clearProfileWarmupCache()` gọi trong `signOutRiotAccount`.
- **L13** Bootstrap cleanup reset `bootstrappedRef` — effect re-run không còn kẹt `isPreloading`.
- **L14** Wishlist: guard `checkShopInFlight`; notify "no hit" chỉ khi app ở nền; lỗi reauth (cookie hết hạn) không còn bắn thông báo lỗi.
- **L15** Bỏ hardcode `"KONA_Prime"` trong night_market.

## 🔧 Hạ tầng kiểm thử
- `tsconfig.json`: exclude `ECC/` (thư mục công cụ ngoài, không phải code app).
- `.eslintrc.js`: `ignorePatterns: ['ECC/']`.
- `jest.full.config.js`: `testPathIgnorePatterns` cho ECC/backup/test dirs.
- Test mocks cập nhật theo contract mới: `data-sync.test.ts` (beginFullSync/endFullSync, fetchMatches → boolean), `session-recovery.test.tsx` (getLastSync/shouldSkipFullSync), `account-session.test.ts` (mock profile-cache chặn import chain MMKV).
- `architecture-boundaries.test.ts`: ProfileScreen giữ trong budget 3750 dòng (nén comment, giữ nội dung).

---
*Kết quả cuối: typecheck ✓ · lint --max-warnings=0 ✓ · 254/254 tests ✓*
