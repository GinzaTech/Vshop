# Phone-to-Desktop Riot Session Handoff — Implementation Plan

**Trạng thái:** approved for native execution and self-review

**Spec:** `markdown/plans/2026-09-25-phone-session-handoff-design.md`

## Global constraints

- TDD RED→GREEN; pnpm; strict TypeScript; 80% coverage for new boundaries.
- Never print or persist Riot token/callback/cookie/credential values.
- Never use root/run-as bypass or arbitrary ADB shell input.
- Never stage `credentials.json`, `credentials/`, APK, Android build output.
- Ordinary production build behavior and network security stay unchanged.

## Task 1 — Companion mobile-handoff protocol

- [ ] RED tests for create/status/claim/consume/cancel, expiry, replay, wrong
  code, wrong account schema, oversized tokens and canary redaction.
- [ ] Add strict `MobileSessionBundle` validation and in-memory handoff map to
  `scripts/lib/riot-pentest-companion.cjs`.
- [ ] Add matching typed browser client methods and tests.
- [ ] Coverage/lint/typecheck; commit protocol files only.

## Task 2 — Fixed-argument ADB bridge

- [ ] RED parser tests for zero/unauthorized/offline/multiple/one device.
- [ ] Implement `scripts/lib/android-session-handoff.cjs` with injected spawn:
  device list, fixed port reverse, fixed package deep link and cleanup.
- [ ] Reject user-controlled serial/port/package/URL fragments; code/id hex only.
- [ ] Test no shell and no secret output; Edge/companion tests remain green.

## Task 3 — Guarded Android sender route and build plugin

- [ ] RED component/policy tests proving disabled without build flag.
- [ ] Add `app/session_handoff.tsx`: validate deep-link id/code, show account ID
  only, require explicit tap, POST minimal bundle, never log token.
- [ ] Add conditional Android network plugin enabled only by
  `VSHOP_DESKTOP_HANDOFF_BUILD=1`; ordinary config snapshot unchanged.
- [ ] Add route/i18n/accessibility tests and Android export regression.

## Task 4 — Desktop import and activation

- [ ] RED web UI tests for “Import from connected phone”, pending, consume,
  timeout/cancel/replay and no rendered/logged token.
- [ ] Add client methods and web handoff hook.
- [ ] Add `completeTransferredSession`: strict bundle, JWT expiry, account subject
  match, `buildAuthenticatedUser`, save/activate, no cookie snapshot.
- [ ] Validate Profile/store/history through fake gateway integration.

## Task 5 — Build, install and runtime evidence

- [ ] Self-review source/security; run full `pnpm run check`.
- [ ] Build with ignored downloaded production credentials and handoff flags.
- [ ] Verify APK package/version, SHA-256 and signer fingerprint.
- [ ] `adb install -r` on `45218ba`; verify data/session preserved.
- [ ] Start `web:pentest`, create handoff, configure reverse/open route, user taps
  confirm, desktop consumes and loads authenticated reads.
- [ ] Verify no token in logs/files, clean reverse/process teardown.
- [ ] Delete downloaded credential JSON/keystore after build and record evidence.

## Review focus

1. Token exposure in errors, logs, React tree, ADB args or files.
2. Handoff replay/expiry/account substitution.
3. Arbitrary ADB command/deep-link injection.
4. Cleartext permission leaking into normal builds.
5. Signer mismatch/data loss during install.

## Current evidence

- Device `45218ba` connected and authorized.
- Installed app `4.1.10 (91)` is non-debuggable; `run-as` fails as expected.
- Installed APK and local production APK are byte-identical and signer-identical.
- Existing EAS production credential was downloaded without rotation/change into
  ignored `credentials.json` + `credentials/android/keystore.jks`.
- Runtime handoff remains `NOT VERIFIED` until Tasks 1–5 complete.
