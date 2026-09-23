# Act Recording Baseline — Design

**Ngày:** 2026-09-23
**Trạng thái:** approved for continuous execution by user message
`tiếp tục xử lí, cái gì lỗi bỏ qua và ghi lại vào báo cáo`

## 1. Mục tiêu và quyết định sản phẩm

VShop dừng hiển thị/cố phục dựng lịch Act trước thời điểm tính năng này được
khởi tạo cho từng tài khoản. Từ mốc đó, ứng dụng tự ghi lại các trận
Competitive quan sát được và giữ từng Act đã đi qua để xem về sau.

Vì người dùng yêu cầu tiếp tục mà không chọn lại hai phương án đã trình bày,
implementation dùng phương án đã được khuyến nghị:

- Act đang hoạt động tại thời điểm tạo mốc bắt đầu từ `0` trong Profile;
- chỉ trận có `GameStartTime >= startedAt` được tính và ghi vào kho Act;
- Act cũ và archive cũ không bị xoá vật lý, nhưng không được đọc vào UI hoặc
  thống kê mới;
- khi Riot mở Act mới, Act cũ đã được VShop ghi từ mốc vẫn còn trong selector.

Quyết định này có thể đảo ngược bằng migration khác vì dữ liệu legacy không bị
delete.

## 2. Biên hệ thống

Luồng phụ thuộc giữ đúng quy tắc repository:

```text
Profile/store action
  -> recording policy service
  -> Riot service / match archive repository
  -> MMKV baseline metadata + SQLite archive summaries
```

Không thay Riot endpoint, credential, cookie, full match-detail persistence,
purchase, party, queue hoặc loadout mutation.

## 3. Mô hình dữ liệu

Mỗi `authKey` có một record độc lập:

```ts
type MatchRecordingBaseline = {
  schemaVersion: 1;
  accountKey: string;
  startedAt: number;
  startSeasonId: string | null;
};
```

- `startedAt` được tạo đúng một lần bằng `Date.now()` và không lùi về quá khứ.
- `startSeasonId` được bind một lần khi xác định được Act active từ Riot content
  hoặc active option cache hợp lệ.
- Key không chứa credential; `authKey` tiếp tục dùng account-session key đã có.
- Native/web/test đều dùng `appStorage` cho metadata nhỏ này; match archive vẫn
  dùng SQLite native và storage adapter trên web/test.

## 4. Luồng khởi tạo và migration

1. `fetchMatches` và `fetchSeasonStats` đều gọi `ensureMatchRecordingBaseline`
   sau khi request scope xác nhận đúng account.
2. Lần đầu tạo baseline, Match store xoá các cache season legacy trong memory và
   persisted state (`seasonStats`, `seasonStatsById`, `seasonMatchesById`,
   `seasonOptions`) nhưng giữ global Match History.
3. Không delete row SQLite/MMKV archive cũ; policy mới khiến chúng không được
   publish.
4. Riot content được tải để tìm active Act, bind `startSeasonId`, rồi lọc options.
5. Nếu content lỗi, action giữ cache tốt hiện có, ghi lỗi vào report/runtime log
   đã sanitize và retry ở lần sau. Baseline timestamp vẫn tồn tại để không nhận
   trận cũ khi mạng quay lại.

## 5. Quy tắc lọc mùa và trận

Một season được phép hiển thị khi:

- `season.id === startSeasonId`; hoặc
- `Date.parse(season.startTime) >= startedAt`.

Đối với start season, cửa sổ thống kê bắt đầu tại:

```text
max(Riot Act start time, baseline.startedAt)
```

Đối với Act mở sau baseline, dùng toàn bộ cửa sổ Act chuẩn.

Archive observed matches chỉ nhận record Competitive có stats, season ID hợp lệ
và `GameStartTime >= startedAt`. Start-season archive legacy được lọc theo mốc và
không được dùng aggregate stats cũ. MMR per-season fallback bị tắt cho start
season vì số đó bao gồm phần Act trước baseline; future Act vẫn được dùng MMR
fallback khi detail đã hết retention.

## 6. Race, cache và lỗi

- Ensure/bind baseline được serialize theo account; hai request song song không
  tạo hai timestamp hoặc ghi đè `startSeasonId`.
- Response vẫn phải qua request scope hiện có trước khi publish.
- Cache/account khác không được đọc hoặc ghi baseline của nhau.
- Parse/storage lỗi trả `null` hoặc giữ record hợp lệ cũ; không crash UI.
- Các lỗi không chặn được bỏ qua theo yêu cầu người dùng và ghi vào
  `markdown/ACT_RECORDING_REPORT.md` với trạng thái `PASS`, `FAILED` hoặc
  `NOT_VERIFIED`; không đổi lỗi thành PASS.

## 7. UI

- Selector chỉ nhận các Act kể từ baseline; lần đầu thường chỉ có một Act nên
  hàng chip lịch sử ẩn tự nhiên.
- Khi Act mới xuất hiện, selector có từ hai item và hành vi swipe/tap đã xác minh
  trên fixture overflow.
- Empty/current Act hiển thị số `0` thật chỉ khi aggregate local xác nhận không có
  trận sau baseline; metric không có nguồn vẫn hiển thị `--`.

## 8. Kiểm thử và acceptance

- RED/GREEN cho parse, ensure idempotent, bind one-time, account isolation và
  malformed storage.
- RED/GREEN cho season filtering và start-window clamp.
- Match archive test chứng minh record trước baseline bị bỏ, record sau baseline
  được lưu.
- Match store test chứng minh legacy season caches bị xoá đúng một lần, start Act
  không dùng full-Act MMR, future Act vẫn hoạt động và stale response không ghi.
- Profile component test chứng minh một season không render lịch cũ; nhiều future
  season vẫn tap/swipe được.
- `pnpm run check`, Android export budget và `git diff --check` phải PASS.
- Device DEV demo xác minh selector một item và future-overflow fixture; live Riot
  session được ghi `NOT_VERIFIED` nếu token vẫn hết hạn.

## 9. Ngoài phạm vi

- Đồng bộ archive giữa nhiều thiết bị hoặc khôi phục sau khi xoá app.
- Backfill lịch sử trước baseline.
- Xoá vật lý archive legacy.
- Bắt request từ Valorant PC hoặc Tracker Network.
