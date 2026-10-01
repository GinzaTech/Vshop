# VShop — Response API và khả năng dữ liệu

Ngày khảo sát: 2026-09-30. Nguồn: registry `services/riot/endpoints.ts`, các service Riot/public, parser storefront và kiểu response hiện có. Phần runtime bên dưới sẽ ghi những endpoint đã thực sự bắt response; bảng contract không phải bằng chứng mọi endpoint đều hoạt động trên tài khoản.

## Cách ghi dữ liệu trong bản dev

Response diagnostics được bật riêng bằng `EXPO_PUBLIC_API_RESPONSE_LOGGING=1` khi chạy Metro ở chế độ development. HTTP response từ Riot/public clients được ghi sau khi che thông tin xác thực; response gốc tiếp tục đi tới service/UI nguyên trạng. Cache, ảnh tải bởi `expo-image`, XMPP/chat socket và WebView không phải response Axios nên không xuất hiện trong bản ghi này.

Bản ghi JSONL được lưu trong cache riêng của ứng dụng tại `api-responses/responses.jsonl`, xoay sang `responses.prev.jsonl`. Mỗi file tối đa 20MiB; body tối đa 2MiB, độ sâu 24, 100.000 node; hàng đợi tối đa 500 record/8MiB. Chỉ đưa bản đã lọc ra thư mục host ngoài Git để dùng lại. Ghi log không có tác dụng hồi phục response đã xảy ra trước khi bật capture. Các response bị giới hạn kích thước/độ sâu phải mang thông tin truncation/omission để không bị nhầm là dữ liệu đầy đủ. `capture-loss` ghi mất record/lỗi ghi đĩa nếu xảy ra.

Native flush dùng File API append cho batch mới, không đọc/ghi lại toàn bộ log trên mỗi lần flush. `durationMs` là khoảng thời gian đo tại HTTP interceptor Riot, không phải thời gian bấm tới UI/game PC; public client chưa gắn request timing nên không có trường này. Production, web và khi chưa bật flag không ghi file.

Không lưu token, cookie, authorization, mật khẩu, khóa kết nối/phiên hoặc request config. Endpoint sinh token chỉ giữ thông tin cấu trúc/status. Asset/item ID cần thiết cho mapping skin vẫn được giữ; private player/session identifiers bị che theo policy của recorder. Đừng coi bản đã lọc là response nguyên bản byte-for-byte.

Policy trước khi publish: tên field không thuộc contract đã nhận diện được đổi
thành marker, không giữ nguyên các dictionary key có thể chứa opaque credential.
Tên/mô tả tự do chỉ giữ trong response catalog công khai `valorant-api.com`;
enum được kiểm tra theo giá trị cho phép. Invite/room code và private/signing key
bị che kể cả khi là số; URL che name/tag/code sau khi nhận diện từng segment đã
decode, không tách nhầm dấu `/` được encode trong một segment. Dữ liệu field mới
không được suy đoán là an toàn: cần bổ sung policy có test khi mở rộng contract.

Tắt flag ngừng ghi mới nhưng không tự xóa lịch sử. `clearApiResponses()` là thao
tác xóa tường minh trong native dev và vẫn hoạt động khi flag đã tắt; nó hủy batch
cũ rồi xóa sau I/O đang chạy. Policy mới không tự sửa/xóa archive cũ trên host;
mọi archive vẫn ở ngoài Git và cần đánh giá riêng trước khi chia sẻ.
Nếu xóa thất bại, promise của lệnh clear báo lỗi chung (không lộ đường dẫn riêng)
để caller không nhầm là dữ liệu đã bị xóa; hàng đợi I/O vẫn dùng được cho lần sau.

## API có thể cung cấp những gì

| API/nhóm endpoint | Thông tin có thể khai thác từ contract nguồn | Ứng dụng dữ liệu |
|---|---|---|
| Storefront v3 — `/store/v3/storefront/{player}` | Skin shop ngày, bundle hiện hành, item type/item ID, giá base/discounted, thời gian còn lại; Night Market và accessory khi có trong response | Bundle/shop card, so giá thật, timer, nối item với asset |
| Wallet — `/store/v1/wallet/{player}` | Số dư theo UUID currency (VP/Radianite/KC) | Balance và đơn vị tiền |
| Offers — `/store/v1/offers` | Offer ID, giá theo currency, phần thưởng/item trong offer | Catalog giá và mapping offer |
| Owned items — `/store/v1/entitlements/{player}/{type}` | `Entitlements` hoặc `EntitlementsByTypes`, `ItemID`, `ItemTypeID`; IDs level/chroma/phụ kiện được sở hữu | Dấu đã mua; nối level/chroma UUID với skin cha |
| Player loadout v2/v3 — `/personalization/v*/players/{player}/playerloadout` | Vũ khí, `SkinID`, `SkinLevelID`, `ChromaID`, buddy/charm; identity card/title/viền cấp; v3 có active expressions và dynamic options | Trang bị hiện tại. Một skin đang trang bị không phải toàn bộ inventory |
| Account XP — `/account-xp/v1/players/{player}` | Cấp/XP và tiến trình account theo response hiện có | Hồ sơ/cấp tài khoản |
| Name service — `/name-service/v2/players` | `GameName`, `TagLine` cho player IDs được tra | Tên người chơi; không phải inventory |
| MMR — `/mmr/v1/players/{player}` | `QueueSkills`, competitive tier, RR, seasonal wins/games/losses/draws, highest tier và latest update khi upstream trả | Rank hiện tại/cao nhất, thống kê theo Act |
| Competitive updates — `/mmr/v1/players/{player}/competitiveupdates` | Lịch sử thay đổi RR/tier và thời điểm trận | Đồ thị RR, đối chiếu match history |
| Match history — `/match-history/v1/history/{player}` | Match IDs, queue/start time và metadata phân trang theo response | Danh sách trận; cần match details để dựng scoreboard |
| Match details — `/match-details/v1/matches/{match}` | Map/mode, players/teams, scores/stats và round-level data tùy response | Chi tiết trận, KDA, economy, round timeline |
| Pregame player/match/loadouts | Match trước trận, map/mode, agent selection và loadout của lobby | UI chọn agent và lobby. Trạng thái phụ thuộc người chơi đang trong pregame |
| Coregame player/match/loadouts | Trận đang chạy, trạng thái, map/mode, players/teams, agent/loadouts; connection fields là nhạy cảm | Live match UI; recorder phải che connection secrets |
| Party player/party | Tổ đội hiện tại, members, ready state, queue/settings và eligible state khi upstream có | Party panel. Đọc party không đồng nghĩa được phép join/leave/queue |
| Session — `/session/v1/sessions/{player}` | Client version/platform/session metadata được upstream cung cấp | Diagnostics phiên/nền tảng; che private session IDs |
| Contracts — `/contracts/v1/contracts/{player}` | Tiến trình contract/agent/battlepass theo response | Trang tiến trình/phần thưởng |
| Item upgrades — `/contract-definitions/v3/item-upgrades` | Định nghĩa các nâng cấp skin và yêu cầu liên quan | Đối chiếu level/chroma; không tự nâng cấp |
| Content service v3 | Season/Act/event IDs và trạng thái nội dung | Chọn Act/season cho thống kê |
| Leaderboard | Danh sách rank/điểm/người chơi của competitive season/shard | Leaderboard có pagination; không đại diện toàn bộ lịch sử cá nhân |
| Config/client config | Cấu hình/feature/version theo Riot client hoặc shard | Khả năng nền tảng/feature flags |
| Penalties/restrictions | Hạn chế/penalty mà response tài khoản trả | Thông báo khả năng matchmaking nếu có dữ liệu |
| Riot auth/userinfo/geo/PAS/entitlements-token/MUC-token | Xác thực, region hoặc token/session channel | Recorder chỉ lưu overview đã che; không dùng làm kho credentials |
| Public `valorant-api.com/v1` | Weapons/skins/levels/chromas, bundles và artwork variants, agents/roles/abilities, buddies/sprays/flex/cards/titles, maps, competitive tiers, phiên bản | Nối IDs Riot với tên, hình ảnh, rarity/tier và dữ liệu mô tả đa ngôn ngữ |

API public không biết người chơi đã mua gì. Kiểm tra đã mua cần response ownership của tài khoản: UUID item trong inventory có thể là UUID level/chroma, khác UUID skin hiển thị. Giá `0` trong ảnh demo không được dùng thay giá thật của Riot.

Bundle hiện đối chiếu riêng SkinLevel/SkinChroma, PlayerCard, PlayerTitle, Spray,
Flex và Buddy. Storefront giữ `itemTypeId`/`entitlementItemIds` trước khi đổi sang
UUID ảnh hiển thị (Buddy có alias cấp). Response mới kiểm tra Subject/ItemTypeID
nếu có, chỉ lấy nhóm requested type; token/account/generation cũ không được áp
vào UI. Profile cache cùng tài khoản vẫn là seed theo category đã có; dữ liệu
cache lịch sử không được coi là bằng chứng đã kiểm lại toàn bộ provenance.

## Runtime evidence

Đã bật capture trên dev app `com.android.vshop`, thiết bị `45218ba`, chạy từ checkout hiện tại bằng `npm start` → `a`. Snapshot archive tại thời điểm 2026-09-30 khoảng 13:07 (+07):

- `C:/Users/kona/AppData/Local/CodexApiResponses/Vshop/2026-09-30/responses-final.jsonl`: 468 record, 35.628.955 byte, 21 nhóm URL/method đã che identifiers, 0 dòng JSON lỗi, 0 capture-loss. Có 2 response public weapons bị truncation do giới hạn body; không coi đó là catalog đầy đủ.
- Native append và trường timing đã xuất hiện trong dữ liệu thiết bị. Archive trước đó `responses-initial.jsonl` và `responses-hardened.jsonl` được giữ ngoài Git; không gộp chúng thành tổng request duy nhất vì có thể trùng.
- Các đọc 200 quan sát được: Party player/detail, storefront, wallet, inventory, loadout v3, account XP, MMR/competitive updates, match details, names, content, client config, public bundles/weapons. Auth/PAS/entitlements-token chỉ có schema/overview che credentials.
- Party response thực tế có `Version`, `Members`, `State`, `Accessibility`, `CustomGameData`, `MatchmakingData`, `EligibleQueues`, `QueueIneligibilities`, `InviteCode`, restrictions/invites. Presence XMPP hiện tại có metadata Valorant lồng ở `playerPresenceData` (card/cấp) và `matchPresenceData` (activity); chỉ ba display fields được đưa vào friend store, không lưu blob.
- Pregame/core-game player đọc 404 trong snapshot cuối khi tài khoản không có trận ở hai trạng thái này. 404 này là absence, không phải lỗi network; không suy ra endpoint không hoạt động. Tracker live/pregame đã được quan sát riêng khi người dùng chơi, nhưng chọn/lock agent bằng VShop chưa được tool smoke-test.

Mẫu timing chỉ các HTTP đọc ở snapshot trên:

| Nhóm | Số response có timing | Median | P95 |
|---|---:|---:|---:|
| Party detail | 83 | 109ms | 139ms |
| Party discovery/player | 82 | 176ms | 242ms |
| Pregame player (404) | 82 | 162ms | 229ms |
| Coregame player (404) | 82 | 162ms | 235ms |
| Match details | 73 | 220ms | 414ms |

Không dùng bảng này để khẳng định latency Start/Ready hoặc nhanh bằng ValBuddy: đó là request khác và cần đo từ một lần bấm thật. Người dùng đã xác nhận tìm trận phản hồi ngay sau sửa; các mutation không được tự gọi chỉ để benchmark. Tính năng Ready dùng optimistic display và rollback khi Riot từ chối, quyền Start vẫn lấy dữ liệu đã xác nhận.

Kiểm tra native sau redesign mã phòng: panel đã hiển thị một `InviteCode` thật từ Party API. Nút Chia sẻ mở sheet Android với mã hiện tại và được đóng bằng Back, không chọn người nhận/không gửi nội dung. Đây không phải HTTP request và không xuất hiện trong archive JSONL; không dùng nó làm bằng chứng API join/invite đã được thử trên tài khoản thật.

## Phạm vi thao tác

Capture quan sát request app thực sự phát sinh và các flow đọc dữ liệu. Các endpoint mua hàng, chọn/lock agent, quit game, đổi loadout, ready/join/leave party hoặc queue là thao tác thay đổi tài khoản; logger không tự gọi chúng để làm đầy catalog.
