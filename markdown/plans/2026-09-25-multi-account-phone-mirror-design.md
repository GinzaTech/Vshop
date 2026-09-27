# Multi-Account Phone-to-Web Data Mirror — Design

**Ngày:** 2026-09-25

**Trạng thái:** approved — người dùng ủy quyền agent tự review/approve spec,
implementation plan, code review và toàn bộ verification workflow

**Phê duyệt hội thoại:** người dùng chọn dữ liệu thật, yêu cầu chuyển tất cả
saved accounts và duyệt kiến trúc multi-account RAM vault bằng tin nhắn `duyệt`

**Workspace:** `C:\Users\kona\Desktop\Project\Vshop`

**Runtime mục tiêu:** Android VShop production-session hiện có → USB/ADB reverse
→ local pentest companion → Expo Web trên loopback

**Quan hệ với spec cũ:** spec này mở rộng và thay thế phạm vi bundle một active
account trong `2026-09-25-phone-session-handoff-design.md`. Fixed-argument ADB
bridge và desktop pentest companion hiện có tiếp tục được tái sử dụng.

## 1. Mục tiêu

Cho phép Expo Web local pentest phản ánh dữ liệu thật của toàn bộ saved Riot
accounts đang tồn tại trong VShop Android, đồng thời không đưa toàn bộ token và
cookie vault vào browser cùng lúc.

Khi hoàn tất, người dùng có thể:

1. Chạy `pnpm run web:pentest`.
2. Bấm `Nhập tất cả tài khoản từ điện thoại` trên web.
3. Companion chọn đúng một Android device, tạo ADB reverse và mở route handoff
   cố định trong APK pentest cùng production signer.
4. Điện thoại hiển thị số account, account active và yêu cầu người dùng xác nhận.
5. Companion nhận tối đa 6 account cùng snapshot app qua USB, giữ secrets chỉ
   trong RAM và trả cho web một manifest metadata không chứa credential.
6. Web mặc định mở account đang active trên điện thoại, hydrate cache thật rồi
   refresh read-only từ Riot.
7. Người dùng switch qua từng account trong manifest; browser chỉ nhận session
   của account đang active và xóa phiên account trước khỏi current-user store.
8. Profile, Store, Bundles, Night Market, Accessory Shop, balances, progress,
   owned skins, loadout, rank/MMR, Match History/Details, season stats,
   contracts, leaderboard, wishlist và profile cache hiển thị dữ liệu thật.

## 2. Hiện trạng có bằng chứng

- Android device `45218ba` đang authorized; package `com.android.vshop` cài bản
  `4.1.10 (91)` và non-debuggable.
- Native session/token/cookie được lưu trong encrypted MMKV/SecureStore;
  browser dùng tab-scoped `sessionStorage`. Hai runtime không chia sẻ storage.
- `components/LoginWebView.web.tsx` hiện chỉ hỗ trợ normal-browser auth,
  companion-controlled auth hoặc callback paste. Nó chưa có phone import UI.
- `buildAuthenticatedUser()` có thể dựng Riot user thật sau khi nhận access/ID
  token: fresh entitlements, live region, Riot ID, storefront, progress và
  balances; Match/Profile preload đã có generation/account guards.
- Desktop companion đã có loopback client session, capability auth, browser auth
  broker và fail-closed Riot proxy.
- Commit `874f058` mới chỉ cung cấp fixed-argument ADB bridge. Source chưa có
  `/v1/mobile-vaults`, phone sender route, vault client/hook hoặc desktop
  activation service. Vì vậy web hiện về `/reauth` và render `defaultUser` rỗng.
- Existing single-account handoff plan chưa hoàn tất Task 1, 3, 4 và 5.

## 3. Phạm vi và biên chính xác

### 3.1 Bao gồm

- Tất cả `SavedAccount` hợp lệ, tối đa `MAX_SAVED_ACCOUNTS = 6`.
- Access token, ID token, entitlements token hiện có và `RiotAuthCookie[]` của
  từng account trong phone→companion transfer.
- Active-account user snapshot, persisted Match cache, Profile warm caches,
  Wishlist và các preference không nhạy cảm được liệt kê trong schema.
- Metadata-only account selector trên web.
- Activate/switch account qua companion RAM vault.
- Cookie-backed browser reauthentication cho account có access token hết hạn.
- Forced read-only Riot sync sau hydrate/activate.
- Local-only signed pentest APK và runtime verification qua USB.

### 3.2 Không bao gồm

- Chat message bodies, party message bodies hoặc media/file cá nhân.
- Push notification token, Android permission, battery optimization, hardware
  state, KeyStore key hoặc MMKV encryption key.
- XMPP realtime tương đương native. Friend list/presence đang có trong RAM chỉ
  được coi là optional read-only snapshot nếu sau này được scope riêng; spec
  này không truyền chat store.
- Cloud/LAN/public companion, persistent Windows service hoặc credential file.
- Purchase, queue, party mutation, agent lock/select, quit game, loadout write,
  contract activation hoặc gửi chat.
- Production/preview feature. Handoff route và cleartext localhost permission
  phải absent/disabled trong ordinary builds.

## 4. Threat model

Hệ thống phải phòng các tình huống sau:

1. Trang web khác trên máy gọi localhost companion để lấy account vault.
2. Forged Host/Origin, capability theft, replay hoặc session fixation.
3. Pairing code/deep link bị chỉnh để chạy ADB command tùy ý.
4. Một account record khai ID của account A nhưng JWT thuộc account B.
5. Duplicate account IDs, oversized cookies/tokens/cache hoặc prototype keys.
6. Browser/XSS đọc tất cả account secrets cùng lúc.
7. Token/cookie lọt vào terminal, log, error, React tree, URL, ADB args, file,
   test snapshot hoặc analytics.
8. Stale request của account A ghi đè account B sau khi switch.
9. Cleartext permission hoặc sender route lọt vào production build thường.
10. APK signer mismatch dẫn tới uninstall/data loss.

Mọi failure ở security boundary phải fail closed bằng code ổn định; response
không trả raw error, stack, token, cookie, account ID hoặc callback URL.

## 5. Kiến trúc

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Android pentest build — same production signer                       │
│                                                                       │
│ encrypted useAccountStore ─┐                                         │
│ active useUserStore ───────┼─> guarded sender route                  │
│ Match/Profile/Wishlist ────┘      explicit phone confirmation         │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │ HTTP over adb reverse only
                                 │ pairing code + schema-bound payload
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Companion — 127.0.0.1 + RAM only                                     │
│                                                                       │
│ pending handoff → validated vault → opaque account handles            │
│                                  ├─ metadata manifest                 │
│                                  ├─ activate one account             │
│                                  └─ cookie-backed auth context        │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │ client capability + exact Origin
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Expo Web                                                              │
│                                                                       │
│ metadata mirror store ──> account selector                            │
│ selected account only ──> useUserStore/sessionStorage                 │
│ snapshot hydrate ───────> Match/Profile/Wishlist                      │
│ forced sync ────────────> existing read-only Riot gateway             │
└───────────────────────────────────────────────────────────────────────┘
```

## 6. Data contract

### 6.1 Phone claim envelope

```ts
type MobileAccountVaultEnvelopeV2 = Readonly<{
  schemaVersion: 2;
  capturedAt: number;
  source: Readonly<{
    packageName: "com.android.vshop";
    appVersion: string;
    versionCode: number;
  }>;
  activeAccountId: string;
  accounts: readonly MobileSavedAccountV2[];
  stateSnapshot: MobileStateSnapshotV2;
}>;

type MobileSavedAccountV2 = Readonly<{
  id: string;
  name: string;
  tagLine: string;
  region: string;
  lastUsedAt: number;
  accessToken: string;
  idToken: string;
  entitlementsToken: string;
  authCookies: readonly RiotAuthCookie[];
}>;
```

`activeAccountId` phải tồn tại đúng một lần trong `accounts`. Số account từ
1–6. Mỗi account được normalize theo existing `normalizeAccountId`; duplicate
sau normalize bị từ chối.

### 6.2 State snapshot

```ts
type MobileStateSnapshotV2 = Readonly<{
  activeUser: PublicUserSnapshotV2;
  matchCache: PersistedMatchSnapshotV2 | null;
  profileCaches: Readonly<Record<string, ProfileWarmCache>>;
  wishlist: Readonly<{
    skinIds: readonly string[];
    notificationEnabled: boolean;
  }>;
  preferences: Readonly<{
    screenshotModeEnabled: boolean;
  }>;
}>;
```

`PublicUserSnapshotV2` chứa identity, region, shops, balances, progress và
ownedSkinIds nhưng không lặp token/cookie. Match cache chỉ được hydrate nếu
`authKey` khớp normalized active account session key. Profile cache giữ tối đa
3 entry theo policy hiện có. Wishlist skin IDs phải là UUID/string hợp lệ, được
deduplicate và có trần. `notificationEnabled` chỉ phản ánh UI preference; web
không giả có native push permission.

### 6.3 Payload ceilings

- Uncompressed JSON only; không nhận gzip/brotli để tránh decompression bomb.
- Tổng phone-claim body tối đa `8 MiB`; companion dùng route-specific reader cho
  claim, còn client/proxy/auth endpoints giữ ceiling nhỏ hiện có.
- Mỗi JWT tối đa `32 KiB`; mỗi account tối đa 3 token fields.
- Cookie count/account tối đa `128`; cookie name/value/domain/path/expires có
  length ceiling và chỉ Riot auth domains được chấp nhận.
- Match/profile/wishlist collections dùng existing app caps; payload vượt trần
  bị từ chối toàn bộ, không partial-import secrets.
- Plain objects/arrays/primitives only; keys `__proto__`, `prototype` và
  `constructor` bị từ chối recursively.

## 7. Companion protocol

Mọi browser endpoint yêu cầu client-session capability hiện có, exact loopback
Origin/Host và `no-store`. Phone claim đi qua ADB reverse, không có browser
Origin, yêu cầu exact Host + pairing code và chỉ tồn tại trong pending window.

### 7.1 Create

```text
POST /v1/mobile-vaults
→ 201 { vaultId, status: "waiting_for_phone", expiresAt }
```

Companion tự sinh `vaultId` và pairing code 256-bit, chỉ lưu hash của pairing
code, gọi fixed-argument ADB bridge và không trả pairing code cho browser.

### 7.2 Claim from phone

```text
POST /v1/mobile-vaults/:vaultId/claim
X-VShop-Pairing-Code: <256-bit code>
Body: MobileAccountVaultEnvelopeV2
→ 204
```

Claim hợp lệ đúng một lần. Pairing code so sánh constant-time. Companion validate
toàn schema trước khi publish vault; raw body không vào logger/error.

### 7.3 Status and manifest

```text
GET /v1/mobile-vaults/:vaultId
→ { status: waiting_for_phone | ready | cancelled | failed | expired }

POST /v1/mobile-vaults/:vaultId/consume
→ { vaultSessionId, vaultCapability, expiresAt, activeHandle, accounts, snapshotManifest }
```

`accounts` chỉ gồm opaque handle, display name, tag line, region, last-used time
và trạng thái token (`ready` hoặc `needs_reauth`). Không trả PUUID, token hoặc
cookie. Consume pending handoff đúng một lần; kết quả tạo một RAM vault session
gắn với browser client-session/origin.

### 7.4 Activate one account

```text
POST /v1/mobile-vault-sessions/:vaultSessionId/accounts/:handle/activate
Authorization: Bearer <ordinary client capability>
X-VShop-Vault-Capability: <vault capability>
→ selected MobileSessionBundle + account-bound snapshot reference
```

Ordinary `Authorization` tiếp tục xác thực client session; vault capability dùng
header riêng để hai capability không ghi đè nhau. Response chỉ chứa secrets của
account được chọn. Companion không trả danh sách
secrets và không cho enumerate bằng raw account ID. Activation được phép nhiều
lần trong vòng đời vault để switch account, nhưng mỗi response no-store và chỉ
cho đúng browser client session đã consume vault.

### 7.5 Cookie-backed reauthentication

Nếu access token còn ít hơn safety window hoặc đã hết hạn:

1. Web tạo authorization URL bằng existing interactive-auth attempt
   (`state`/`nonce`).
2. Gửi URL + opaque account handle đến companion.
3. Companion tạo Playwright browser context riêng, seed chỉ cookie allowlisted
   của account đó và mở exact Riot authorization URL.
4. Callback được consume qua auth broker hiện có.
5. Web chạy existing strict callback validation, gồm state/nonce/subject.
6. Companion cập nhật cookie snapshot trong RAM nếu context nhận cookie mới.

Không dùng cookie của account A trong context account B. Context đóng khi hoàn
tất/cancel/timeout.

### 7.6 Cancel and cleanup

```text
DELETE /v1/mobile-vaults/:vaultId
DELETE /v1/mobile-vault-sessions/:vaultSessionId
```

- Pending handoff timeout: 2 phút.
- Vault idle timeout: 15 phút, bằng existing client-session idle window; mỗi
  authenticated vault request refresh cả hai cùng lúc.
- Vault hard lifetime: 2 giờ hoặc ngắn hơn nếu `web:pentest` dừng.
- Cleanup xóa Map entries, đóng browser contexts, hủy timer/request và remove
  ADB reverse mapping. Không ghi serialized vault ra filesystem.

## 8. Android sender build và route

### 8.1 Build flags

- `VSHOP_DESKTOP_HANDOFF_BUILD=1` bật local native plugin.
- `EXPO_PUBLIC_VSHOP_DESKTOP_HANDOFF=1` bật route/UI sender.
- Conditional plugin thêm localhost cleartext allowance chỉ cho build này.
- Ordinary app config snapshot phải chứng minh permission/route absent khi flag
  thiếu hoặc khác `1`.

### 8.2 Sender route

`app/session_handoff.tsx`:

- Reject nếu build flag tắt.
- Parse exact `id` và `code` là 64 hex chars; không chấp nhận field khác.
- Đọc stores trong memory sau hydration; không đọc file/database bằng bypass.
- Hiển thị số account, tên/tag active account, nguồn/destination localhost và
  cảnh báo secrets sẽ được chuyển vào RAM desktop.
- Yêu cầu explicit press `Gửi tất cả tài khoản sang desktop`.
- Disable + busy state trong lúc claim; retry chỉ sau khi status probe xác nhận
  vault vẫn waiting và chưa claim.
- Không render token/cookie hoặc raw request error.
- Sau success hiển thị metadata count/captured time, không giữ serialized body
  trong component state lâu hơn request lifecycle.

### 8.3 Install safety

- Build local release APK bằng production keystore đã có, không rotate/change.
- Verify package, version, SHA-256 và signer fingerprint trước install.
- So sánh signer APK mới với installed package certificate.
- Chỉ khi signer trùng mới chạy `adb -s 45218ba install -r <apk>`.
- Không dùng uninstall, clear-data, downgrade flag, root hoặc run-as.
- Sau install verify user/session vẫn tồn tại bằng app UI; nếu app về login thì
  runtime gate fail và dừng, không tiếp tục handoff.

## 9. Web import và state ownership

### 9.1 Metadata mirror store

Tạo một desktop-only mirror store giữ:

- `vaultSessionId` và vault capability chỉ trong JS memory.
- Account manifest metadata/opaque handles.
- Active handle, status và expiry.

Store không persist token/cookie. Reload tab làm mất vault capability và yêu cầu
handoff mới; đây là deliberate security boundary.

### 9.2 Selected account only

Khi activate account:

1. Increment existing session generation, cancel stale requests và disconnect
   chat service.
2. Nhận đúng selected session bundle từ companion.
3. Validate JWT structure, expiry, subject/account, region và manifest handle.
4. Request fresh entitlements token và live region.
5. Build full user với `buildAuthenticatedUser`.
6. Clear browser-only saved-account records từ interactive session cũ; không
   trộn chúng với transferred manifest.
7. Chỉ persist current selected user vào tab-scoped `sessionStorage`.
8. Previous current user secrets bị thay thế; all-account vault vẫn chỉ ở
   companion RAM.

Existing `useAccountStore` không được populate bằng toàn bộ transferred secrets
trên web. Khi mirror bắt đầu, web clear account records cũ trong tab rồi dùng
metadata mirror store cho selector; native saved-account flow không đổi. Selected
`useUserStore` session có thể tiếp tục sống trong tab sau khi vault hết hạn, nhưng
switch sang account khác khi đó yêu cầu handoff mới.

### 9.3 Snapshot hydration and authoritative refresh

Với phone-active account:

1. Hydrate validated public user snapshot để UI hiện ngay.
2. Restore Match cache chỉ nếu authKey/account khớp.
3. Restore matching Profile caches và Wishlist/preferences.
4. Build authenticated user và publish only after generation/subject guards.
5. Chạy forced read-only sync: shop/balances, matches, profile/loadout, rank và
   screen-specific readers.

Với account khác:

- Không reuse active account's Match/user cache.
- Dùng selected session để live fetch; matching Profile cache có thể hydrate nếu
  cache authKey khớp.

UI phân biệt `mobile snapshot`, `refreshed`, `stale but usable` và `unavailable`.
Một endpoint lỗi không xóa cache tốt; account switch giữa lúc request chạy không
cho response cũ ghi đè account mới.

## 10. UI flow

### Web

- `reauth` có action chính `Nhập tất cả tài khoản từ điện thoại` khi companion
  và ADB bridge available.
- Trạng thái: checking device, opening phone, waiting confirmation, importing,
  activating active account, syncing data, ready, expired, cancelled, failed.
- Sau ready, account management hiển thị manifest transferred accounts cùng
  badge `Điện thoại` và token status, không hiển thị PUUID/token/cookie.
- Switch account có disabled/busy state và rollback previous account nếu failed.

### Phone

- Screen hiển thị destination `Desktop localhost`, số saved accounts và active
  Riot ID.
- Một destructive-looking confirmation card giải thích toàn bộ sessions sẽ vào
  companion RAM và mất khi server dừng.
- User phải tap; không auto-send khi deep link mở.

## 11. Error contract

Public client codes mở rộng có giới hạn:

- `MOBILE_HANDOFF_DISABLED`
- `MOBILE_DEVICE_UNAVAILABLE`
- `MOBILE_DEVICE_AMBIGUOUS`
- `MOBILE_HANDOFF_EXPIRED`
- `MOBILE_HANDOFF_REPLAYED`
- `MOBILE_VAULT_REJECTED`
- `MOBILE_ACCOUNT_REJECTED`
- `MOBILE_ACCOUNT_NEEDS_REAUTH`
- `MOBILE_VAULT_EXPIRED`

Các code khác map thành `COMPANION_UNAVAILABLE`. UI dùng localized copy; server
không phản chiếu validation path/value chứa secret.

## 12. Testing strategy

### Pure/schema tests

- 1–6 accounts, active membership, duplicate normalized IDs.
- JWT subject mismatch, expired/near-expiry status, malformed token.
- Cookie allowlist/field bounds/count, payload size and dangerous object keys.
- Match/Profile cache account binding and collection caps.

### Companion tests

- Create/claim/status/consume/activate/cancel/expiry/replay.
- Forged Host/Origin/capability/vault capability/account handle.
- Browser cannot enumerate PUUID or retrieve all secrets.
- Vault isolation across two client sessions/origins.
- Cookie contexts isolated and closed on every terminal state.
- Canary secrets absent from logger, error, responses and temp files.

### ADB tests

- zero/offline/unauthorized/multiple/one device.
- Fixed args only; no shell; exact package/scheme/path/port.
- Reverse setup and cleanup on success/failure/timeout.

### Mobile tests

- Build flag disabled/enabled policy.
- Deep-link validation, explicit confirmation, loading/error/retry.
- Snapshot capture copies immutable data and strips actions/chat/system state.
- Claim payload never rendered/logged.

### Web tests

- Manifest-only selector, activate active/non-active account.
- Current-session-only persistence.
- Hydrate matching caches, reject mismatched authKey.
- Generation/race rollback and account switch while sync is in flight.
- Expired token cookie-backed auth, cancel and user-assisted login fallback.
- Profile/Store/History fake gateway integration for at least two accounts.

### Full gates

```text
pnpm run check
git diff --check
```

Plus special APK package/version/signer/hash checks and runtime security canary
scan. Tests never contact Riot or launch a real browser; runtime phase is
separate and authorized.

## 13. Runtime parity protocol

For every transferred account:

1. Record phone-visible Riot ID, region, balance, level, current shop counts,
   rank, loadout identifiers and match-history IDs/count without recording
   token/cookie.
2. Activate same opaque account on web.
3. Verify identity and account-scoped cache keys first.
4. Compare phone snapshot vs immediate web hydrate.
5. Wait authoritative refresh and compare values that are expected stable;
   timestamp-sensitive Shop/party/presence values are labeled accordingly.
6. Exercise Profile, Store, History and Match Details interactions.
7. Verify no cross-account data after rapid A→B→A switch.
8. Search companion/Metro/device logs and workspace files for canary secrets.

PASS requires observed phone send, web activation and populated real-data
screens. Source tests, ADB deep-link success or server status alone remain
`NOT VERIFIED`.

## 14. Acceptance criteria

- [ ] All valid saved accounts on phone appear exactly once in web manifest.
- [ ] Phone-active account is selected by default.
- [ ] Browser never holds all account secrets at once; vault remains companion RAM.
- [ ] Every account can activate with valid token or enters account-scoped reauth.
- [ ] Subject/account/region and stale-generation guards block substitution.
- [ ] Active snapshot hydrates matching Match/Profile/Wishlist/preferences only.
- [ ] Forced read-only refresh populates all supported real-data screens.
- [ ] Switching accounts never leaks user/cache data across account boundaries.
- [ ] No token/cookie appears in file, handoff/deep-link URL, ADB args, logs,
  errors or React tree. Riot OAuth callback fragment may exist transiently only
  inside the existing broker RAM contract and is never persisted/rendered/logged.
- [ ] Ordinary builds exclude route and cleartext allowance.
- [ ] Same-signer `install -r` preserves mobile data/session.
- [ ] Full source/security/Android export gates pass.
- [ ] Runtime phone→web parity is observed for every transferred account.

## 15. Stop conditions

Stop before device install or secret transfer if any condition holds:

- More than one ADB device or selected device not `device` state.
- APK package/version/signature cannot be proven.
- Signer differs from installed app.
- Companion binds non-loopback or exact Origin/Host checks fail.
- Payload schema/size/account/JWT/cookie validation fails.
- Any canary appears in logs/files/UI/ADB arguments.
- Ordinary Android config unexpectedly contains cleartext handoff permission.
- Source/full gate fails.

