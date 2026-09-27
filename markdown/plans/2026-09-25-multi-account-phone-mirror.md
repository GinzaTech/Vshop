# Multi-Account Phone-to-Web Data Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` to implement this plan task-by-task. Every implementation task follows RED → GREEN → refactor and records evidence without staging unrelated dirty-worktree files.

**Goal:** Chuyển toàn bộ saved Riot accounts và snapshot dữ liệu thật từ VShop Android qua USB vào companion RAM vault, cho Expo Web activate từng account, hydrate cache và refresh read-only mà không persist toàn bộ credential vault trong browser/filesystem.

**Architecture:** Một schema validator thuần bảo vệ phone payload trước khi companion publish vault. Companion bind loopback, dùng fixed-argument ADB bridge và giữ account secrets trong RAM; web chỉ nhận metadata manifest và session account đang active. Android sender chỉ tồn tại trong same-signer pentest build, còn web activation reuse session-generation, `buildAuthenticatedUser`, Match/Profile/Wishlist boundaries hiện có.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, React 19.2.3, Zustand 5, Node.js 22 `http` server, Playwright Core 1.63, ADB, Jest 29, strict TypeScript, pnpm 11.

**Spec:** `markdown/plans/2026-09-25-multi-account-phone-mirror-design.md`

## Global Constraints

- Chỉ dùng active workspace `C:\Users\kona\Desktop\Project\Vshop` và pnpm.
- Không stage/commit/push vì worktree có user-owned changes; task evidence nằm trong ignored ledger và plan checkboxes.
- Không in/persist/render token, cookie, pairing code, vault capability, raw callback hoặc PUUID manifest.
- Companion chỉ bind `127.0.0.1`; exact Origin/Host/client capability bắt buộc.
- Handoff pending 2 phút; vault/client idle 15 phút; hard lifetime 2 giờ.
- Tối đa 6 account, 8 MiB uncompressed phone claim, 128 cookies/account và exact schema v2.
- Browser không giữ all-account secrets; chỉ current selected user được tab-persist.
- Chat message/media/system permission/encryption keys bị loại khỏi snapshot.
- Riot proxy read-only mặc định; không smoke-test mutation trên account thật.
- Ordinary builds không có sender route hoặc cleartext localhost allowance.
- Special APK chỉ `install -r` sau package/version/hash/signer checks; signer mismatch là stop condition.
- New security boundaries đạt ít nhất 80% branch/function/line/statement coverage.
- Full completion cần `pnpm run check`, `git diff --check`, canary scan và runtime evidence.

## Review Focus

1. **All-secret disclosure:** manifest/selector/error không được trả PUUID/token/cookie; browser chỉ activate opaque handle — Tasks 1–3, 5–6.
2. **Account substitution/race:** JWT subject, normalized account ID, authKey và generation phải khớp trước hydrate/publish — Tasks 1, 5.
3. **Localhost/ADB injection:** exact Host/Origin/capability, fixed package/scheme/port/hex IDs, no shell — Tasks 2, 4.
4. **Build leakage/data loss:** ordinary config remains closed; APK signer/package verified before `install -r` — Tasks 4, 7.
5. **Secret persistence/logging:** vault RAM-only, route-specific body parsing, no callback/canary in logs/files/UI — Tasks 1–7.

---

### Task 1: Pure multi-account envelope validation and manifest projection

**Files:**
- Create: `scripts/lib/mobile-account-vault.cjs`
- Create: `__tests__/mobile-account-vault.test.js`

**Interfaces:**
- Produces `MobileVaultError`.
- Produces `validateMobileVaultEnvelope(value, options)` returning a deep-copied frozen vault.
- Produces `createVaultManifest(vault, handles)` returning metadata only.
- Produces `projectAccountSession(vault, handle, handles)` returning one account bundle.
- Task 2 consumes all four exports; no other layer reimplements schema validation.

- [x] **Step 1: Write RED validator tests**

Cover 1/6/7 accounts, duplicate normalized IDs, missing active account, malformed
JWT, subject mismatch, invalid region, dangerous keys, 8 MiB ceiling, token and
cookie bounds, non-Riot cookie domain, cache authKey mismatch, collection caps,
immutability and secret-free manifest.

```js
const validated = validateMobileVaultEnvelope(makeEnvelope(), { now });
expect(Object.isFrozen(validated.accounts[0])).toBe(true);
expect(JSON.stringify(createVaultManifest(validated, handles)))
  .not.toMatch(/accessToken|idToken|entitlementsToken|authCookies|puuid-canary/);
```

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/mobile-account-vault.test.js --runInBand
```

Expected: FAIL because `mobile-account-vault.cjs` does not exist.

- [x] **Step 3: Implement strict immutable validator**

Use manual allowlist validation with plain-object guards; do not add a runtime
schema dependency. Decode JWT payload without signature claims, require `sub`
equal normalized record ID, classify expiry, and reject unknown top-level keys.
Never place rejected values in `MobileVaultError.message`.

- [x] **Step 4: Run GREEN, coverage and lint**

```powershell
pnpm exec jest __tests__/mobile-account-vault.test.js --runInBand --coverage --collectCoverageFrom='scripts/lib/mobile-account-vault.cjs'
pnpm exec eslint scripts/lib/mobile-account-vault.cjs __tests__/mobile-account-vault.test.js --max-warnings=0
```

---

### Task 2: Companion RAM vault protocol and fixed ADB orchestration

**Files:**
- Modify: `scripts/lib/riot-pentest-companion.cjs`
- Modify: `scripts/start-web-pentest.cjs`
- Modify: `scripts/lib/riot-auth-browser.cjs`
- Test: `__tests__/mobile-account-vault-companion.test.js`
- Test: `__tests__/riot-pentest-companion.test.js`
- Test: `__tests__/riot-auth-browser.test.js`
- Test: `__tests__/web-pentest-startup.test.js`

**Interfaces:**
- Consumes Task 1 validator/projection and existing `createAndroidSessionHandoffBridge`.
- Extends `createRiotPentestCompanion` with injected `androidHandoff`.
- Produces `/v1/mobile-vaults`, claim/status/consume, vault-session activate and delete contracts.
- Extends auth browser `open` with optional validated `seedCookies` and `onCookies` callback.
- Task 3 mirrors exact JSON contracts.

- [x] **Step 1: Write RED protocol tests**

Start a real Node server on port `0`. Test exact Origin/Host, one claim, wrong
pairing code, replay, expiry, separate client isolation, safe manifest,
one-account activation, opaque handles, vault capability, idle/hard timeout,
cancel/close cleanup, route-specific 8 MiB claim vs existing body ceiling and
canary absence from logger/error/response.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/mobile-account-vault-companion.test.js --runInBand
```

- [x] **Step 3: Implement RAM maps and endpoint routing**

Store pairing/vault capabilities as SHA-256 digests, compare constant-time,
bind vault session to clientSessionId + origin, generate random opaque handles,
and never serialize the validated vault except the selected account response.
ADB `prepare()` is called internally after companion port is known; `cleanup()`
runs on every terminal path and server close.

- [x] **Step 4: Add cookie-isolated auth browser support**

Validate Playwright cookie fields before `context.addCookies`, isolate one
context/account, capture only allowlisted Riot cookies through `context.cookies`,
and close context/browser on callback, abort, timeout or exception.

- [x] **Step 5: Run GREEN and companion coverage**

```powershell
pnpm exec jest __tests__/mobile-account-vault-companion.test.js __tests__/riot-pentest-companion.test.js __tests__/riot-auth-browser.test.js __tests__/android-session-handoff.test.js __tests__/web-pentest-startup.test.js --runInBand --coverage
pnpm exec eslint scripts/lib/riot-pentest-companion.cjs scripts/lib/riot-auth-browser.cjs scripts/start-web-pentest.cjs __tests__/mobile-account-vault-companion.test.js --max-warnings=0
```

---

### Task 3: Typed web companion client and public error contract

**Files:**
- Modify: `services/pentest-companion/types.ts`
- Modify: `services/pentest-companion/client.web.ts`
- Modify: `services/pentest-companion/client.ts`
- Modify: `__tests__/pentest-companion-client.test.ts`

**Interfaces:**
- Adds `MobileVaultStatus`, `MobileVaultManifest`, `TransferredAccountSession` and methods `startMobileVault`, `getMobileVaultStatus`, `consumeMobileVault`, `activateMobileVaultAccount`, `cancelMobileVault`.
- Client validates every server response, never exposes unknown server fields and stores vault capability only inside client closure.
- Tasks 5–6 consume the interface, never call fetch directly.

- [x] **Step 1: Write RED client tests**

Cover request method/path/headers, manifest validation, opaque handles, secret
field rejection, activate response bounds, session expiry reset, cancel and
non-web fail-closed facade.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/pentest-companion-client.test.ts --runInBand
```

- [x] **Step 3: Implement typed methods and validation**

Keep vault capability in closure separate from ordinary companion capability;
send it only as `X-VShop-Vault-Capability`, map only documented codes and clear
vault state on cancel/expiry.

- [x] **Step 4: Run GREEN, typecheck and lint**

```powershell
pnpm exec jest __tests__/pentest-companion-client.test.ts --runInBand --coverage
pnpm run typecheck
pnpm exec eslint services/pentest-companion/types.ts services/pentest-companion/client.web.ts services/pentest-companion/client.ts __tests__/pentest-companion-client.test.ts --max-warnings=0
```

---

### Task 4: Guarded Android snapshot sender and conditional network plugin

**Files:**
- Create: `services/mobile-handoff/types.ts`
- Create: `services/mobile-handoff/snapshot.ts`
- Create: `services/mobile-handoff/policy.ts`
- Create: `app/session_handoff.tsx`
- Create: `plugins/withDesktopHandoff.cjs`
- Modify: `app/_layout.tsx`
- Modify: `app.json`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/vi.json`
- Test: `__tests__/mobile-handoff-snapshot.test.ts`
- Test: `__tests__/mobile-handoff-screen.test.tsx`
- Test: `__tests__/mobile-handoff-config.test.js`
- Test: `__tests__/phase3-visible-copy-i18n.test.ts`

**Interfaces:**
- Produces `captureMobileAccountVaultEnvelope()` from hydrated stores.
- Produces `validateMobileHandoffParams()` and build-flag policy.
- Route claims to fixed `http://127.0.0.1:49331` only.
- Conditional plugin changes Android network config only when both handoff flags equal `1`.
- Shared fixture contract tests keep the TypeScript envelope and CJS validator
  aligned without importing app TypeScript into the Node companion.

- [x] **Step 1: Write RED snapshot/policy/config tests**

Test action stripping, deep copies, account cap, active membership, chat/system
exclusion, exact endpoint construction, 64-hex params, ordinary config closed,
flagged config localhost-only, i18n parity and explicit-confirmation semantics.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/mobile-handoff-snapshot.test.ts __tests__/mobile-handoff-screen.test.tsx __tests__/mobile-handoff-config.test.js --runInBand
```

- [x] **Step 3: Implement snapshot and guarded route**

Wait for user/account store hydration, capture immutable data, render only count
and active Riot ID, require tap, send pairing code in header, clear serialized
reference after request and show generic localized errors.

- [x] **Step 4: Implement conditional plugin**

Use Expo config-plugin APIs and deterministic Android resource/manifest edits.
Default app config must remain byte-equivalent for handoff-specific fields.

- [x] **Step 5: Run GREEN, Android prebuild snapshots and lint**

```powershell
pnpm exec jest __tests__/mobile-handoff-snapshot.test.ts __tests__/mobile-handoff-screen.test.tsx __tests__/mobile-handoff-config.test.js __tests__/phase3-visible-copy-i18n.test.ts --runInBand --coverage
pnpm run typecheck
pnpm run lint
```

---

### Task 5: Desktop mirror store, account activation and cache hydration

**Files:**
- Create: `hooks/useMobileMirrorStore.ts`
- Create: `services/accounts/transferred-session.ts`
- Create: `hooks/useMobileAccountMirror.ts`
- Modify: `hooks/useAccountStore.ts`
- Modify: `utils/app-sync.ts`
- Test: `__tests__/transferred-session.test.ts`
- Test: `__tests__/mobile-account-mirror.test.tsx`

**Interfaces:**
- Metadata-only mirror store owns manifest/status/activeHandle in memory.
- `activateTransferredAccount(handle)` validates selected bundle, calls existing
  `invalidateSessionOperations()`, clears browser saved-account records, builds
  authenticated user, restores only matching caches and triggers forced sync.
- Exposes hook actions `start`, `cancel`, `activate` and stable status union for UI.

- [x] **Step 1: Write RED activation/race tests**

Cover active default, A→B→A, subject mismatch, expired session, prior-account
rollback, stale request completion, Match authKey mismatch, Profile cache match,
Wishlist hydration, current-user-only persistence and forced sync.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/transferred-session.test.ts __tests__/mobile-account-mirror.test.tsx --runInBand
```

- [x] **Step 3: Implement mirror store and activation service**

Do not place transferred account arrays in `useAccountStore`. Use existing
generation/session guards around every await; restore previous user/cache on
failure only if no newer switch began.

- [x] **Step 4: Run GREEN, coverage, typecheck and lint**

```powershell
pnpm exec jest __tests__/transferred-session.test.ts __tests__/mobile-account-mirror.test.tsx __tests__/account-session.test.ts __tests__/session-recovery.test.tsx --runInBand --coverage
pnpm run typecheck
pnpm run lint
```

---

### Task 6: Reauth import UI and metadata-only account selector

**Files:**
- Create: `components/MobileAccountMirrorPanel.web.tsx`
- Create: `components/MobileAccountMirrorPanel.tsx`
- Modify: `components/LoginWebView.web.tsx`
- Modify: `app/(authenticated)/settings.tsx`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/vi.json`
- Test: `__tests__/mobile-account-mirror-ui.test.tsx`
- Test: `__tests__/login-webview-web.test.tsx`
- Test: `__tests__/account-info-screens.test.tsx`

**Interfaces:**
- Consumes Task 5 hook only; component never accesses raw companion client or secrets.
- Reauth exposes import action/status/cancel/retry.
- Settings shows transferred manifest with opaque handles and token readiness, and activate buttons with busy/selected accessibility state.

- [x] **Step 1: Write RED UI tests**

Test semantic buttons, live status, no PUUID/token/cookie rendering, account count,
active state, switch failure rollback copy, disabled/busy states and native
fallback absence.

- [x] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/mobile-account-mirror-ui.test.tsx __tests__/login-webview-web.test.tsx __tests__/account-info-screens.test.tsx --runInBand
```

- [x] **Step 3: Implement UI and localized copy**

Keep the existing browser-login path available as fallback. The import panel
must not render companion URLs, account IDs or secret-shaped strings.

- [x] **Step 4: Run GREEN and accessibility/i18n regressions**

```powershell
pnpm exec jest __tests__/mobile-account-mirror-ui.test.tsx __tests__/login-webview-web.test.tsx __tests__/account-info-screens.test.tsx __tests__/core-accessibility.test.ts __tests__/phase3-visible-copy-i18n.test.ts --runInBand
pnpm run typecheck
pnpm run lint
```

---

### Task 7: Full gates, same-signer APK, install and real multi-account parity

**Files:**
- Modify: `markdown/plans/2026-09-25-multi-account-phone-mirror.md` with evidence only.
- Modify: `markdown/DESKTOP_PENTEST_COMPANION.md` if runtime commands/behavior changed.
- Modify: `CHANGELOG.md` for completed local pentest behavior.

**Interfaces:**
- Consumes Tasks 1–6 and existing ignored credentials/APK paths.
- Produces source/security/build/runtime evidence; does not publish OTA/production.

- [ ] **Step 1: Final security self-review**

Review all changed boundaries for secrets, Origin/Host/capability, replay,
account isolation, route/build leakage and cleanup. Add RED tests for every
Critical/Important finding before fixing.

- [ ] **Step 2: Run full source gates**

```powershell
pnpm run check
git diff --check
```

- [ ] **Step 3: Build special local release APK**

Set both handoff flags, use production profile/signing credentials already
ignored, wait for `FINISHED` plus artifact URL, download locally without adding
to Git and verify package/version/hash/alignment/signer.

- [ ] **Step 4: Compare installed signer and install safely**

Use `adb -s 45218ba`; verify exactly one authorized device, installed package
certificate equals candidate signer, then `install -r`. Never uninstall/clear.

- [ ] **Step 5: Run real handoff**

Start `web:pentest`, create vault, establish reverse/open phone route, wait for
the required user tap, consume manifest and activate every account. Compare
phone/web identity, balances, shop counts, rank/loadout/match IDs and cache keys.

- [ ] **Step 6: Leak/cleanup verification**

Search Metro/companion/device logs and workspace for canary patterns, cancel or
expire vault, ensure browser contexts/reverse mappings/processes close, and
delete downloaded credential JSON/keystore only after build artifact/signature
evidence is secured.

- [ ] **Step 7: Record honest completion state**

Mark each acceptance criterion PASS/FAIL/NOT VERIFIED. Source/build/ADB status
must never substitute for observed multi-account phone→web data parity.

