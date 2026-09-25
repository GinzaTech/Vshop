# Phone-to-Desktop Riot Session Handoff — Design

**Ngày:** 2026-09-25

**Trạng thái:** approved for self-review and execution by user

## 1. Mục tiêu

Cho phép VShop production session đang tồn tại trên Android được chuyển một lần
qua USB sang Expo Web pentest, không hiển thị token, không dùng root/run-as,
không ghi token xuống file và không phát hành tính năng này cho production.

Thiết bị hiện tại là `45218ba`, VShop `4.1.10 (91)`, non-debuggable. APK local
và APK đang cài byte-identical, cùng signer SHA-256
`736f72bc0a3c6a33b4a774115f52f540192448f0105585653ddaa4c93a53c462`.

## 2. Kiến trúc

```text
Expo Web tab
  -> create one-time mobile handoff (capability protected)
  -> companion creates id + pairing secret + 2 minute expiry
  -> fixed-argument adb bridge:
       adb -s SERIAL reverse tcp:49331 tcp:COMPANION_PORT
       adb -s SERIAL shell am start ... vshop://session_handoff?id=...&code=...
  -> production-signed local pentest APK opens guarded phone route
  -> user taps “Send session to desktop”
  -> phone POSTs minimal token bundle through USB reverse
  -> companion validates code/schema, RAM-only, consume once
  -> web validates JWT subject/account + expiry
  -> buildAuthenticatedUser refreshes entitlements/profile through read-only gateway
  -> activateUser + sessionStorage
```

## 3. APK strategy

- Build a local-only release APK with the same production keystore.
- Add build flags `VSHOP_DESKTOP_HANDOFF_BUILD=1` and
  `EXPO_PUBLIC_VSHOP_DESKTOP_HANDOFF=1`.
- Conditional Expo plugin permits cleartext only for this special local build;
  ordinary production/preview builds remain unchanged.
- Install with `adb -s 45218ba install -r`; matching signer preserves app data,
  SecureStore and encrypted MMKV session.
- APK, credentials JSON and keystore remain ignored and are never pushed.
- Delete downloaded credential material after successful signed artifact copy.

## 4. Handoff protocol

- Browser-protected `POST /v1/mobile-handoffs` creates handoff and invokes ADB.
- Phone-only `POST /v1/mobile-handoffs/:id/claim` accepts no browser Origin and
  requires exact Host, 256-bit pairing secret, one claim and strict token bundle.
- Browser `GET /v1/mobile-handoffs/:id` polls status.
- Browser `POST /v1/mobile-handoffs/:id/consume` returns bundle once and deletes it.
- Browser `DELETE` cancels and removes reverse mapping.
- Timeout: 2 minutes. Maximum bundle: 64 KiB. No cookies are transferred.

Bundle fields:

```ts
type MobileSessionBundle = Readonly<{
  schemaVersion: 1;
  accountId: string;
  accessToken: string;
  idToken: string;
  region: string;
  issuedAt: number;
}>;
```

Desktop decodes access-token subject locally, requires it to equal `accountId`,
requires reusable expiry, then calls `buildAuthenticatedUser`. The phone's
entitlements token is deliberately not trusted/transferred; desktop requests a
fresh one from Riot through the gateway.

## 5. Security boundaries

- No root, run-as bypass, process memory dump, logcat token or clipboard token.
- ADB process uses `spawn` args, never shell command concatenation.
- Exactly one authorized device; zero or multiple devices fail closed.
- Package name and deep-link scheme/path are constants.
- Pairing secret never appears in logs; ADB deep link contains only one-time
  handoff id/code, never Riot credentials.
- Claim response contains no token and uses `no-store`.
- Token bundle lives only in phone request memory, companion RAM and web tab
  session storage after validation.
- Read-only Riot proxy remains default.
- Route and cleartext permission are absent/disabled in ordinary builds.

## 6. Acceptance

- Policy/protocol/ADB/mobile/web tests use canaries and meet 80% coverage.
- Production APK signer matches installed certificate before install.
- `adb install -r` preserves package data and app opens authenticated.
- Handoff is one-time, account-bound, expires and leaves no token file/log.
- Desktop Profile/store/history load through the gateway without CORS.
- Full source gate and Android export pass.
- Runtime evidence is `NOT VERIFIED` until phone user confirms send and desktop
  receives/validates the session.
