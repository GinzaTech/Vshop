# VShop — Lịch trình và báo cáo kiểm thử toàn bộ ứng dụng

Ngày lập và chạy kiểm thử: **14/08/2026**  
Phiên bản nguồn: **4.1.1**  
Phạm vi: Android local development client, TypeScript/Jest, Android production export và các API đọc an toàn.

## 1. Mục tiêu và nguyên tắc

Tài liệu này là checklist dùng cho mỗi đợt regression/release của VShop. Phạm vi bao gồm:

- 26 file route/layout trong `app/`;
- 4 tab chính: Bundles, Store, Profile và More, cộng tab Night Market khi có dữ liệu;
- 10 lối tắt trong More;
- toàn bộ picker, filter, modal, tìm kiếm, sao chép, chia sẻ, chat và pull-to-refresh;
- 47 endpoint builder Riot, 2 thao tác ghi loadout dùng chung endpoint và 13 endpoint public `valorant-api.com`;
- thời gian phản hồi API, startup/TTI, FPS, tải ảnh, empty/error/offline state;
- accessibility, race condition, cache, session hết hạn và Reduce Motion.

Không smoke-test trực tiếp trên tài khoản thật các thao tác có thể thay đổi trạng thái: mua hàng, cập nhật loadout, queue/dequeue, lock/select agent, quit game, ready party, mời/xóa thành viên party, bật contract, gửi chat hoặc đổi identity. Các mục này dùng contract test/mock; chỉ test end-to-end bằng tài khoản staging riêng và có xác nhận.

## 2. Ngưỡng chấp nhận

| Nhóm | Mục tiêu | Cảnh báo | Không đạt |
|---|---:|---:|---:|
| Public API p95 | ≤ 1.500 ms | 1.501–2.500 ms | > 2.500 ms |
| Riot read API p95 | ≤ 2.500 ms | 2.501–5.000 ms | > 5.000 ms |
| Riot read API max | ≤ 8.000 ms | 8.001–10.000 ms | timeout > 10.000 ms |
| TTI cold production | < 2.000 ms | 2.000–4.000 ms | > 4.000 ms |
| Điều hướng nội bộ đã hydrate | < 500 ms | 500–1.000 ms | > 1.000 ms |
| UI animation | 55–60 FPS | 45–54 FPS | < 45 FPS |
| JS frame budget 60 Hz | ≤ 16,67 ms | 16,68–32 ms | > 32 ms liên tục |
| Pull-to-refresh | có spinner ngay, dữ liệu thật cập nhật | 2–5 giây | treo/không gọi API |

TTI/FPS cuối cùng phải đo trên production build, cold start, không gắn debugger. Dev launcher và Metro không được dùng làm số TTI release.

## 3. Lịch trình regression đầy đủ

### Wave 0 — Chuẩn bị, 20 phút

1. Đồng bộ branch nhưng giữ nguyên thay đổi local chưa liên quan.
2. Kiểm tra `package.json` và `app.json` cùng version.
3. Kiểm tra không có token, cookie, `.env`, APK, log hoặc cache bị stage.
4. Kết nối Android test device; ghi model, Android version, refresh rate và mạng.
5. Chuẩn bị ba trạng thái tài khoản: hợp lệ, hết hạn, và empty/demo.
6. Bật proxy/network throttling khi chạy wave resilience; không ghi auth header vào artifact.

### Wave 1 — Static gate và unit/contract, 30 phút

Chạy theo thứ tự:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test:ci
pnpm run test:api
pnpm exec expo export --platform android --output-dir <temporary-directory>
```

Điều kiện dừng: TypeScript/lint/test/export có bất kỳ lỗi nào.

### Wave 2 — Authentication, startup và session, 45 phút

| ID | Test | Kết quả mong đợi |
|---|---|---|
| AUTH-01 | Mở app lần đầu, chưa có session | Đi đến Setup; không chớp màn hình authenticated |
| AUTH-02 | Login hợp lệ | Lưu session và hydrate dữ liệu trước khi vào app |
| AUTH-03 | Login sai | Thông báo lỗi rõ, không lưu session hỏng |
| AUTH-04 | Cookie thiếu | Dừng ở luồng xác thực, không crash |
| AUTH-05 | Access token hết hạn từ Riot host | Phát session event và đi Reauth đúng một lần |
| AUTH-06 | 401/403 từ host không phải Riot | Không xóa session |
| AUTH-07 | Reauth thành công | Quay lại app, giữ lựa chọn/tab hợp lệ |
| AUTH-08 | Reauth thất bại | Giữ thông báo và cho thử lại |
| AUTH-09 | Logout | Xóa session nhạy cảm và về màn hình login |
| AUTH-10 | Force-stop rồi mở lại | Khôi phục session mới nhất, không dùng snapshot cũ |
| AUTH-11 | Mất mạng khi startup | Hiện cache/loading có kiểm soát, có retry |
| AUTH-12 | API chậm khi startup | Chỉ một loading shell, không chồng nhiều splash |
| AUTH-13 | API một phần thất bại | Dữ liệu tốt vẫn hiển thị, phần lỗi có fallback |
| AUTH-14 | Deep link khi chưa login | Lưu intent hợp lệ rồi xác thực; không lộ screen |
| AUTH-15 | Deep link sau login | Mở đúng route nếu route được router hỗ trợ |

### Wave 3 — Điều hướng và các screen, 90 phút

| ID | Screen/route | Các kiểm tra bắt buộc |
|---|---|---|
| NAV-01 | Primary navigation | Bundles, Store, Profile, More bấm được; selected state đúng |
| NAV-02 | Night Market tab | Chỉ xuất hiện khi có dữ liệu; bấm mở đúng screen |
| NAV-03 | More long-press | Collapse/expand navigation đúng, không mất route |
| NAV-04 | Android back | Đóng modal trước, sau đó pop route; không thoát bất ngờ |
| NAV-05 | Safe area/orientation | Không che status/navigation bar; chỉ Match Session dùng landscape |
| SCR-01 | `bundles` | Loading, dữ liệu bundle, countdown, item count, chọn bundle, đóng modal, empty/error/cache |
| SCR-02 | `shop` | Header/balance, All/Wishlist, countdown, 4 daily offers, ảnh/tên/giá, empty/error/cache |
| SCR-03 | `profile` | Header, balance, tabs, profile card, rank, collection, stats, region và mọi picker |
| SCR-04 | `settings`/More | 10 shortcut, notification, language, update, external link, copy ID, logout |
| SCR-05 | `equip` | Search, 4 category, owned item cards, empty search, refresh |
| SCR-06 | `accessories` | Search, category/accessory list, card/modal, empty/error |
| SCR-07 | `gallery` | Search, All/Wishlist, card, wishlist toggle, empty/error |
| SCR-08 | `agent` | Role filter, agent grid, agent detail, ability modal |
| SCR-09 | `crosshair` | Search, category, preview, copy code, empty/error |
| SCR-10 | `leaderboard` | Tất cả season chip, chọn từng season, search/clear, ranks, refresh, race |
| SCR-11 | `friends` | Online/offline grouping, chọn friend, mở chat, refresh |
| SCR-12 | `chat/[friendId]` | Back, history, input, keyboard, send mock/staging, refresh |
| SCR-13 | `history` | Match rows, paging, load more, refresh, mở detail, empty/error |
| SCR-14 | `match_details/[id]` | Back/close, tabs, share, sort, chart menu, round/player, refresh |
| SCR-15 | `contracts` | Active contract, progress/reward, expansion, activate chỉ mock/staging |
| SCR-16 | `item_upgrades` | Search/clear, expansion, sidegrade options, owned state, refresh |
| SCR-17 | `night_market` | Có ưu đãi/không có ưu đãi, countdown, item press, refresh |
| SCR-18 | `combat` | Session snapshot, party chat refresh, invite UI, join code UI, agent selection UI |
| SCR-19 | `combat_session` | Snapshot, players, stats views, reload, back, cleanup orientation |
| SCR-20 | `about` | Version/build info, diagnostics, reset dev toggles, refresh |
| SCR-21 | `language` | Đổi ngôn ngữ, giữ lựa chọn sau restart, fallback chuỗi thiếu |
| SCR-22 | `reauth` | Loading, retry, success/failure, back protection |
| SCR-23 | `setup` | Form/CTA, validation, keyboard, lỗi mạng, success |
| SCR-24 | Root/index | Hydration gate, redirect duy nhất, không flash screen |

### Wave 4 — Ma trận nút và tương tác, 90 phút

| ID | Nhóm nút | Test |
|---|---|---|
| BTN-01 | Bundle cards | Tap từng card, modal đúng bundle, backdrop/close hoạt động |
| BTN-02 | Shop filters | All/Wishlist selected state, dữ liệu và count đúng |
| BTN-03 | Shop item | Mở detail đúng item; không tự phát sinh purchase |
| BTN-04 | Profile tabs | Trang bị/Skin/Bộ sưu tập đổi nội dung không nhảy layout |
| BTN-05 | Profile stats tabs | Overview/agent/map/weapon/match đổi đúng và giữ scroll hợp lý |
| BTN-06 | Region picker | AP/EU/KR/NA/PBE valid; request cũ không ghi đè region mới |
| BTN-07 | Player card picker | Search/select/close/equip mock; ảnh và title cập nhật |
| BTN-08 | Player title picker | Search/select/close/equip mock; typography đồng đều |
| BTN-09 | Spray picker | Search/select/close/equip mock; slot đúng |
| BTN-10 | Weapon/skin picker | Filter, search, level/chroma, equip mock, long-press option |
| BTN-11 | Collection filter | Owned/all/category/wishlist đúng, không duplicate |
| BTN-12 | Rank season chips | Bấm toàn bộ season; divider không có sọc trắng; font weight đồng nhất |
| BTN-13 | More shortcuts | 10/10 shortcut mở đúng route |
| BTN-14 | Notification switch | Một thao tác chỉ phát một update; rollback khi lỗi |
| BTN-15 | Screenshot mode | Chỉ dev; state rõ và không xuất hiện production |
| BTN-16 | External links | Discord/credits/privacy/delete account mở URL đúng |
| BTN-17 | Copy Riot ID | Clipboard đúng định dạng, có feedback |
| BTN-18 | Check update | No update/update/error; không apply ngoài channel/version tương thích |
| BTN-19 | Logout | Có xác nhận nếu thiết kế yêu cầu, logout một lần |
| BTN-20 | Search fields | Gõ, xóa, Unicode, khoảng trắng, no-result ở mọi screen có search |
| BTN-21 | Copy crosshair | Clipboard đúng và có toast/feedback |
| BTN-22 | Friends row | Mở đúng friend ID; double tap không push hai route |
| BTN-23 | Chat send | Empty disabled; message mock/staging gửi một lần; retry an toàn |
| BTN-24 | History row | Mở đúng match ID; back giữ vị trí list |
| BTN-25 | History load more | Không fetch trùng, không duplicate row, hết trang dừng đúng |
| BTN-26 | Match detail controls | Mọi tab/menu/sort/round/player/share có selected state |
| BTN-27 | Agent role/filter | Mọi role có dữ liệu đúng; selected state rõ |
| BTN-28 | Agent ability | Modal đúng icon/mô tả; close/back hoạt động |
| BTN-29 | Contract expand | Expand/collapse mượt, reward không lệch |
| BTN-30 | Upgrade sidegrade | Mọi option render; mutation chỉ mock/staging |
| BTN-31 | Party invite code | Generate/copy/disable chỉ mock/staging; code không ghi log |
| BTN-32 | Join party code | Validation và lỗi UI; submit chỉ staging |
| BTN-33 | Ready/queue/quit | Contract/mock đầy đủ; end-to-end chỉ staging |
| BTN-34 | Agent select/lock | Contract/mock và chống double submit; end-to-end chỉ staging |
| BTN-35 | Combat reload | Snapshot mới thay dữ liệu cũ, request cũ bị bỏ qua |

### Wave 5 — Pull-to-refresh, 45 phút

Mỗi case phải kiểm tra đủ: gesture kéo được cả khi list rỗng, spinner bắt đầu/kết thúc, gọi dữ liệu thật, không gọi trùng, giữ cache khi lỗi, và không set state sau unmount.

| ID | Vị trí |
|---|---|
| REF-01 | Bundles |
| REF-02 | Store |
| REF-03 | Profile overview |
| REF-04 | Profile stats |
| REF-05 | More/Settings |
| REF-06 | Equip |
| REF-07 | Accessories |
| REF-08 | Gallery |
| REF-09 | Agent |
| REF-10 | Crosshair |
| REF-11 | Leaderboard |
| REF-12 | Friends |
| REF-13 | Chat |
| REF-14 | History |
| REF-15 | Match details |
| REF-16 | Contracts |
| REF-17 | Item upgrades |
| REF-18 | Night Market |
| REF-19 | Combat/party chat |
| REF-20 | Combat session |
| REF-21 | About/diagnostics |

### Wave 6 — API contract và latency, 60 phút

#### Riot API: 47 endpoint builder và 2 thao tác ghi loadout

Các endpoint đọc được chạy trên session hợp lệ với dữ liệu đã ẩn danh. Endpoint thay đổi trạng thái chỉ chạy URL/header/body contract test hoặc mock.

| ID | Endpoint key | Method test | Chế độ |
|---|---|---|---|
| API-R01 | auth | URL/header/body/status/timeout | mock; reauth staging |
| API-R02 | entitlements | URL/header/schema/latency | read-safe |
| API-R03 | storefront | required userId/schema/latency | read-safe |
| API-R04 | wallet | required userId/schema/latency | read-safe |
| API-R05 | playerxp | required userId/schema/latency | read-safe |
| API-R06 | weapons metadata | public URL/schema/latency | read-safe |
| API-R07 | offers | URL/schema/latency | read-safe |
| API-R08 | name | body/schema/latency | read-safe query |
| API-R09 | matchID | required userId/schema/latency | read-safe |
| API-R10 | lock | required matchId+agentId | mock/staging only |
| API-R11 | quit | required matchId | mock/staging only |
| API-R12 | player | required userId/schema | read-safe |
| API-R13 | player-v3 | required userId/schema | read-safe |
| API-R14 | mmr | required userId/schema/latency | read-safe |
| API-R15 | owned-items | required itemTypeId/schema | read-safe |
| API-R16 | match-history | paging/query/encode/schema/latency | read-safe |
| API-R17 | match-details | required matchId/schema/latency | read-safe |
| API-R18 | competitive-updates | paging/query/schema | read-safe |
| API-R19 | session | required userId/schema | read-safe |
| API-R20 | pregame-player | required userId/schema | read-safe |
| API-R21 | pregame-match | required matchId/schema | read-safe |
| API-R22 | select-agent | required matchId+agentId | mock/staging only |
| API-R23 | pregame-loadouts | required matchId/schema | read-safe |
| API-R24 | coregame-player | required userId/schema | read-safe |
| API-R25 | coregame-match | required matchId/schema | read-safe |
| API-R26 | coregame-loadouts | required matchId/schema | read-safe |
| API-R27 | coregame-quit | required matchId | mock/staging only |
| API-R28 | party-player | required userId/schema | read-safe |
| API-R29 | party | required partyId/schema | read-safe |
| API-R30 | party-ready | required partyId+userId/body | mock/staging only |
| API-R31 | party-remove | required partyId+userId | mock/staging only |
| API-R32 | party-join-queue | required partyId | mock/staging only |
| API-R33 | party-leave-queue | required partyId | mock/staging only |
| API-R34 | party-invite-code | required partyId | mock/staging only |
| API-R35 | party-join-by-code | required code/encode | mock/staging only |
| API-R36 | party-muc-token | required partyId/schema | read-safe |
| API-R37 | contracts | required userId/schema | read-safe |
| API-R38 | activate-contract | required userId+itemTypeId | mock/staging only |
| API-R39 | item-upgrades | schema/latency | read-safe |
| API-R40 | content | locale/query/schema/latency | read-safe |
| API-R41 | leaderboard | region/season/start/size/schema/latency | read-safe |
| API-R42 | config | region/schema/latency | read-safe |
| API-R43 | penalties | required userId/schema | read-safe |
| API-R44 | playerinfo | auth/schema | read-safe |
| API-R45 | riotgeo | body/schema/latency | read-safe query |
| API-R46 | pastoken | auth/schema | read-safe |
| API-R47 | riotclientconfig | auth/schema | read-safe |
| API-M01 | loadout update v2 qua `player` | required userId/body | mock/staging only |
| API-M02 | loadout update v3 qua `player-v3` | required userId/body | mock/staging only |

Áp dụng cho từng API-Rxx/API-Mxx: valid region, invalid region, thiếu tham số bắt buộc, URL encoding, headers đúng contract, 2xx schema, 4xx/5xx mapping, timeout, retry/dedup, stale-response protection và không ghi token vào log.

#### Public Valorant API: 13 smoke endpoint

| ID | Endpoint | Schema tối thiểu |
|---|---|---|
| API-P01 | `/v1/version` | `data.riotClientVersion` string |
| API-P02 | `/v1/weapons/skins` | `data` array |
| API-P03 | `/v1/buddies` | `data` array |
| API-P04 | `/v1/sprays` | `data` array |
| API-P05 | `/v1/weapons` | `data` array |
| API-P06 | `/v1/flex` | `data` array |
| API-P07 | `/v1/playercards` | `data` array |
| API-P08 | `/v1/playertitles` | `data` array |
| API-P09 | `/v1/maps` | `data` array |
| API-P10 | `/v1/competitivetiers` | `data` array |
| API-P11 | `/v1/bundles` | `data` array |
| API-P12 | `/v1/agents?isPlayableCharacter=true` | `data` array |
| API-P13 | `/v1/contracts` | `data` array |

Ngoài smoke: locale hợp lệ/không hợp lệ, 404 trả `null` ở optional lookup, skin-level ID rỗng bị chặn, ID động được trim+encode, timeout 15 giây và cache key ổn định.

### Wave 7 — Resilience, race và security, 60 phút

| ID | Test | Kết quả mong đợi |
|---|---|---|
| RES-01 | Offline trước request | Cache/empty state + retry; không crash |
| RES-02 | Mất mạng giữa request | Spinner dừng, cache tốt được giữ |
| RES-03 | 2G/latency 2–5 giây | Loading có phản hồi; không bấm gửi trùng |
| RES-04 | Timeout Riot 10 giây | Lỗi chuẩn hóa, request được hủy/kết thúc |
| RES-05 | Timeout public 15 giây | Fallback hợp lý, không xóa cache |
| RES-06 | 429 | Không retry storm; hiển thị thông báo phù hợp |
| RES-07 | 500/502/503 | Giữ cache, retry có giới hạn |
| RES-08 | JSON thiếu field | Type guard/default; không crash render |
| RES-09 | JSON sai type | Bỏ record lỗi hoặc error state có kiểm soát |
| RES-10 | Double tap | Một navigation/mutation duy nhất |
| RES-11 | Refresh đồng thời startup | Dedup hoặc request mới nhất thắng |
| RES-12 | Đổi season liên tục | Response cũ không ghi đè season mới |
| RES-13 | Đổi region liên tục | Response cũ không ghi đè region mới |
| RES-14 | Unmount khi request chạy | Không warning/setState sau unmount |
| RES-15 | App background/foreground | Timer/subscription đúng, không fetch storm |
| RES-16 | Log API | Không có auth header/token/cookie; ID được ẩn khi xuất report |
| RES-17 | Clipboard | Chỉ copy theo thao tác rõ ràng; có feedback |
| RES-18 | External URL | Chỉ scheme/domain cho phép |

### Wave 8 — UI, animation, accessibility và device matrix, 60 phút

| ID | Test | Kết quả mong đợi |
|---|---|---|
| UI-01 | Light/dark mode | Contrast và token Design System đúng |
| UI-02 | Font scale 100/130/160% | Không cắt chữ/nút |
| UI-03 | Vietnamese/English | Không overflow, fallback rõ |
| UI-04 | Small/large Android | Card/list/modal không lệch |
| UI-05 | 60/90/120 Hz | Animation ổn định, không phụ thuộc refresh rate |
| UI-06 | Reduce Motion ON | Tắt/giảm entrance, loop, decoration |
| UI-07 | Screen reader | Role/label/state và thứ tự focus đúng |
| UI-08 | Touch target | Vùng bấm tối thiểu hợp lý, không overlap |
| UI-09 | Keyboard | Input không bị che; back đóng keyboard trước |
| UI-10 | Network images | Placeholder/cache key/kích thước cố định, không layout shift |
| UI-11 | Blur Android | Có `blurTarget`, dùng `blurMethod`, không warning deprecated |
| UI-12 | Rank split join | Không sọc trắng, hai khối liền hoàn toàn |
| UI-13 | Rank typography | Không có một phần chữ đậm bất thường |
| UI-14 | Equipment card | Không còn mục bộ sưu tập, “Thẻ người chơi” đúng cỡ |
| UI-15 | Long list | FlatList virtualization, scroll không giật |
| PERF-01 | Production cold start × 5 | Ghi median/p95 TTI |
| PERF-02 | Warm start × 5 | Ghi median/p95 |
| PERF-03 | Bundles scroll 30 giây | ≥ 55 FPS, không tăng memory liên tục |
| PERF-04 | Store scroll 30 giây | ≥ 55 FPS |
| PERF-05 | Profile scroll 30 giây | ≥ 55 FPS |
| PERF-06 | More scroll 30 giây | ≥ 55 FPS |
| PERF-07 | Modal open/close × 20 | Không jank/leak |
| PERF-08 | Tab switch × 30 | Không re-fetch storm/leak |
| PERF-09 | Image-heavy screens | Không OOM; cache hit tăng ở lần hai |
| PERF-10 | Background 5 phút | Timer/listener cleanup; resume đúng |

## 4. Kết quả đã chạy trong phiên này

### 4.1 Automated gate

| Hạng mục | Kết quả |
|---|---|
| TypeScript strict | PASS |
| ESLint `--max-warnings=0` | PASS |
| Jest | **8/8 suites, 82/82 tests PASS** |
| Coverage bắt buộc `endpoints.ts`, `session-events.ts` | **100% statements/branches/functions/lines** |
| Android Expo production export | PASS, 2.664 modules, bundle Hermes 7,5 MB |
| Export tạm | 40 file, 10.084.209 bytes; đã dọn khỏi workspace/temp |

### 4.2 Public API smoke và latency

Đã chạy 3 vòng liên tiếp, tổng **39 request**, 39/39 PASS. Số dưới đây là trung bình của ba vòng; tất cả đều thấp hơn ngưỡng 1.500 ms.

| Endpoint | Avg ms | Min–max ms |
|---|---:|---:|
| version | 186 | 176–191 |
| weapon skins | 204 | 194–216 |
| buddies | 171 | 165–177 |
| sprays | 174 | 169–180 |
| weapons | 205 | 201–211 |
| flex | 124 | 109–132 |
| player cards | 160 | 153–166 |
| player titles | 135 | 129–139 |
| maps | 128 | 122–134 |
| competitive tiers | 118 | 109–130 |
| bundles | 140 | 132–145 |
| agents | 129 | 125–136 |
| contracts | 154 | 150–158 |

Trung bình chung xấp xỉ **156 ms/request** trong điều kiện mạng của phiên test.

### 4.3 Riot API latency từ dev client

Log được tổng hợp theo family, không xuất token/ID. Cửa sổ 2 giờ có 768 log record; do logger ghi một record lúc request và một record lúc response, cột `Sample` dưới đây là số response có timing thực tế.

| Family | Sample | Avg ms | p95 ms | Max ms | Nhận xét |
|---|---:|---:|---:|---:|---|
| account-xp | 12 | 362 | 1.060 | 1.060 | đạt |
| config | 22 | 478 | 298 | 6.318 | đạt p95, có outlier |
| content | 6 | 1.012 | 2.221 | 2.221 | đạt |
| loadout read | 10 | 139 | 215 | 215 | đạt |
| match-details | 156 | 479 | 1.174 | 1.740 | đạt |
| match-history | 7 | 958 | 1.789 | 1.789 | đạt |
| mmr | 27 | 745 | 1.789 | 6.950 | đạt p95, có outlier |
| name-service | 14 | 330 | 614 | 614 | đạt |
| other Riot read | 40 | 304 | 492 | 564 | đạt |
| storefront | 84 | 707 | 6.184 | 6.189 | **cảnh báo p95** |

Storefront chưa timeout nhưng p95 vượt mục tiêu 2.500 ms. Release regression cần đo lại trên mạng ổn định và theo dõi cache/dedup; không nên làm rỗng dữ liệu đang hiển thị khi lần refresh này chậm hoặc lỗi.

Các error record cũ chưa có duration nên không được dùng để tính latency. Logger đã được sửa để mọi request lỗi mới cũng ghi `durationMs`.

### 4.4 UI local trên thiết bị Android

- Bundles render bundle, countdown, item count và giá.
- Store render header/balance, All/Wishlist, countdown và đủ 4 daily offer; không còn màn hình trắng trong phiên test.
- Profile render player card, level, balance, rank, tabs và equipment cards.
- More render đủ 10 shortcut.
- Equip, Accessories, Gallery, Agent, Leaderboard và History đều có nội dung/empty state thay vì white screen trong các lần kiểm tra local.
- Overlay thiết bị quan sát khoảng **60,3–60,4 FPS** khi đứng yên. Đây chỉ là smoke signal; dropped-frame counter đã tích lũy từ trước và development client không đủ điều kiện kết luận FPS production.
- Cold-launch qua dev launcher dao động khoảng 2,84–4,48 giây nhưng dừng ở màn hình chọn development server, vì vậy số này **không phải TTI của VShop** và không được dùng làm release metric.

## 5. Lỗi đã sửa trong phiên này

### FIX-01 — Dynamic public skin-level ID không được validate

- Trước sửa: chuỗi rỗng/khoảng trắng tạo URL `weapons/skinlevels/` và vẫn gửi request.
- Sau sửa: trim ID, chặn ID rỗng bằng lỗi `skinLevelId is required`, encode ID động.
- Regression: test ID rỗng không gọi HTTP; test ID có slash/khoảng trắng được encode đúng.

### FIX-02 — Request lỗi không có thời gian phản hồi

- Trước sửa: `logAxiosError` không ghi `durationMs`, khiến report latency bỏ mất timeout/4xx/5xx.
- Sau sửa: tính duration từ metadata request, không cho số âm.
- Regression: request lỗi 503 được ghi method/status/error và duration 750 ms.

## 6. Việc cần chạy trước production release tiếp theo

1. Cài production build ký bởi EAS lên ít nhất một máy 60 Hz và một máy 90/120 Hz.
2. Chạy PERF-01 đến PERF-10; ghi cold TTI median/p95 sau 5 lần force-stop thật.
3. Chạy toàn bộ endpoint mutation trên tài khoản staging, không dùng tài khoản cá nhân.
4. Đo lại storefront tối thiểu 30 mẫu trên Wi-Fi và mạng di động; mở issue nếu p95 vẫn > 5 giây.
5. Chạy accessibility với TalkBack và font scale 160%.
6. Chạy offline/2G/429/5xx matrix và xác nhận mọi screen giữ cache tốt.
7. Chạy REF-01 đến REF-21 bằng gesture thực tế, gồm cả empty state.

## 7. Tiêu chí ký duyệt

Release chỉ được ký duyệt khi:

- tất cả static gate, unit, contract và export đều PASS;
- không có lỗi P0/P1; lỗi P2 có owner và kế hoạch;
- 47 Riot endpoint builder, 2 loadout mutation contract và 13 public smoke endpoint xanh;
- không live-test nhầm mutation trên tài khoản thật;
- TTI/FPS production đạt ngưỡng hoặc có bằng chứng/issue được chấp thuận;
- Bundles, Store, Profile, More, Night Market và mọi shortcut không white screen;
- pull-to-refresh thật sự gọi dữ liệu và hoạt động trong empty/error state;
- không có token/cookie/user ID thô trong artifact, log hoặc tài liệu bàn giao.
