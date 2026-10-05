# UI test results — 2026-10-03

## Verdict and evidence boundary

The full UI audit remains active. Final post-typography typecheck/lint and **179/179 suites / 2487/2487 tests PASS in 122.582s**; separate final Android export PASS. Bounded physical startup/recovery evidence and native-final **5/5 PASS / 10 cycles** are recorded. **Overall check/security audit remain FAIL** at braces 1240992. Broad 26-route runtime/release/assistive-technology and 80% coverage requirements remain unmet or unverified; no total UI validation claim.

This updater reconciled retained logs, screenshots, XML and main's ledger; it ran no fresh tests, build/export or device action. Final typography, local recovery callbacks and source watchdog/native-release/AppState fixes now have final evidence. Development QA native resources plus JS served by Metro are not an embedded production-JS APK. Native OS splash fidelity/release performance and all live network recovery remain NOT VERIFIED.

## Accepted startup brief supersedes the old visual criterion

The user explicitly selected **icon + minimal status + real phase progress + smooth motion**, replacing the old icon-only normal-mode criterion. The governing [startup-redesign plan](../plans/2026-10-03-startup-redesign.md) requires an original cart mark, VShop name, concise localized status, a progress rail and completed-stage count. Progress follows completed prepare/session/core-data/ready stages, never elapsed-time or fabricated network percentage; retry may return to an earlier phase. Motion uses existing opacity/transform tokens and live Reduce Motion, without added dwell/perpetual effects, while preserving actionable recovery and native-to-JS splash alignment.

The [48,375-byte mark](../../assets/generated/production/startup/vshop-launch-mark-v1.png) and full VShop title are visible in [new-startup-final.png](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-final.png); the clipping defect seen in earlier phase captures is closed for the recorded device configuration. Session 1/3 and data 2/3 preview rendering/source mapping are observed. [Recovery-final capture](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-recovery-final.png) and main's explicit-wait checks verify local update status and Retry back to progress. The preview/local transport does not prove every live Riot recovery branch.

Evidence root: [vshop-ui-audit-20261003](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003). Startup correction evidence root: [vshop-startup-20261003](C:/Users/kona/.codex/artifacts/vshop-startup-20261003). These are local retained artifacts, not repository deliverables. Source attribution follows [UI_INVENTORY](UI_INVENTORY.md), defect IDs follow [UI_BUG_REPORT](UI_BUG_REPORT.md), and case IDs follow [UI_TEST_PLAN](UI_TEST_PLAN.md).

## Gate history and current pending gates

| Check | Observed result | Evidence / limitation |
|---|---|---|
| Initial full gate | 165 suites passed / 1 failed; 2366 tests passed / 1 failed | [baseline-check.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/baseline-check.log): party invite timeout; unchanged isolated rerun is recorded in [baseline-timeout-recheck.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/baseline-timeout-recheck.log). |
| Prior integrated `pnpm run check` | **FAIL**: 173 suites passed / 1 failed of 174; 2449 tests passed / 1 failed of 2450 | [final-check.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/final-check.log): `core-accessibility.test.ts` still expected loading-only Combat refresh semantics. Typecheck and zero-warning ESLint completed before Jest; the chained gate stopped at Jest. |
| Corrected core accessibility contract | **PASS — source assertion**, 18/18 | [core-accessibility-green.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/core-accessibility-green.log); [review](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/core-accessibility-review.md). The same labelled Pressable must expose button role, busy/disabled and actual disabled as `loading \|\| refreshing`, and `onPress={onRefresh}`. |
| Assertion mutation proof | **PASS**, 12/12: accepts current source and rejects 11 deliberately regressed fixtures | [core-accessibility-mutations.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/core-accessibility-mutations.log). Includes loading-only, refreshing-only and AND expressions in all three state/disabled positions plus wrong labels. Product source was not mutated. |
| Historical first startup integrated source run | **PASS** for typecheck, zero-warning lint and Jest: **177/177 suites, 2469/2469 tests** | [startup/final-check.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/final-check.log), summary lines 2135–2136. Predates the accepted redesign; not the latest final gate. |
| Historical first startup production audit / unresolved security state | **FAIL**, exit 1: high advisory **1240992**, braces, not allowlisted | Same log, lines 2140–2150. [Official GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), checked 2026-10-03: affected <=3.0.3, patched versions None. The [external security review](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/security-review-braces.md) found tooling reachability and no scoped app-runtime path; packaged exclusion and exploitability remain unverified. No fix or policy exception exists. |
| Historical concurrent-build redesign gate | **FAIL**, two failed/177 passed of 179 suites; one failed/2476 passed of 2477 tests | [new-design-final-check.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-design-final-check.log): Party exceeded 5000ms; ui-qa failed initialization. Main attributes the Party timeout to concurrent native build load. This failed result is retained, not relabelled by later targeted passes. |
| Earlier targeted new-design source attempt | **FAIL**, four passed/one failed suite, 25 passed tests | [new-design-tests.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-design-tests.log): ui-qa suite failed to initialize Worklets (loadUnpackers undefined). Passed test count does not make a failed suite run green; this is not final verification. |
| UI-QA mock correction / mixed targeted rerun | **UI-QA and LoadingScreen suites PASS; combined run FAIL** | Main reports a full inline Reanimated mock correction. [new-design-regression-rerun.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-design-regression-rerun.log): two suites passed/one failed; 42 tests passed/one failed of 43. Party timeout remained in that mixed run. The 42 passed tests are not a standalone clean full gate. |
| Party after native build | **PASS**, 22/22, one suite | [party-after-build.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/party-after-build.log). Main reports no assertion or timeout changes; this is later isolated recovery evidence, not a whole-app result. |
| Final post-typography source check / overall gate | **Typecheck/lint/Jest PASS; overall FAIL at audit** | [final-handoff-check.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/final-handoff-check.log): 179/179 suites, 2487/2487 tests, 122.582s. Audit braces 1240992 remains unexpected and exits 1. Prior stable-final-check.log is a preceding snapshot, not the latest final gate. |
| Historical code92 QA build | **PASS — earlier build observed** | [qa-build.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/qa-build.log): BUILD SUCCESSFUL in 18m; prior APK artifact existed at 83,490,832 bytes. A shared artifact filename is not an immutable hash or proof of latest redesign contents. |
| Historical code92 QA install / identity | **INSTALL REPORTED BY MAIN; prior runner identity recorded** | Main reported 4.2.0/code92/com.android.vshop.startupqa/arm64. [Prior runner JSON](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-qa/after-native-results.json) records versionCode=92/versionName=4.2.0. This updater ran no install/metadata check; matching package/version alone cannot prove latest source/asset parity. |
| Latest redesigned QA APK build | **PASS — build observed**, after first attempt FAIL | [new-design-build.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-design-build.log) failed at locked Expo classes.jar in 1m 51s; [new-design-build-retry.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-design-build-retry.log) now records BUILD SUCCESSFUL in **14m 17s**. Latest [redesign QA APK](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/vshop-startup-redesign-qa-4.2.0-92.apk) is 83,723,412 bytes. |
| Latest artifact hash / reported install | **Artifact SHA256 verified; install/signer recorded by main** | APK SHA256 00CCE1248643A07C6C10B9E7F08E2EDABB6BCB6DDDB5B51E5AD13581F07DAB97. [Main startup ledger](STARTUP_REDESIGN_RESULTS.md) records com.android.vshop.startupqa 4.2.0/code92/arm64 and signer fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c. This updater performed no installed-package/signer check; final JS is served through Metro. |
| Fresh physical native fixture acceptance | **5/5 PASS, 10 cycles** | [native-final JSON](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-native-results.json), physical serial 45218ba, com.android.vshop.startupqa 4.2.0/code92, JS via Metro. Final typography/local recovery have separate final capture and post-fix source evidence; no 30-cycle or release acceptance inferred. |

The initial 17-test accessibility suite and corrected 18-test suite have different totals because the Combat contract became a separate assertion. Both [RED](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/core-accessibility-red.log) and GREEN are retained; the correction strengthens the contract rather than dropping its state requirements.

## Source regression results (C01–C27)

**SOURCE OBSERVED** means the named Jest suite passed in retained logs with mocked transport or source contracts. It does not mean that a screen or interaction passed on a device. The prior full log contains passes for all suites named below; targeted logs give more specific defect evidence. Counts from overlapping runs are not additive.

| Cases / defects | Correct suite name(s) under `__tests__/` | Evidence and observed scope |
|---|---|---|
| C01 / UIQ-01 | `collection-checker-export.test.tsx` | [coverage.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/collection-checker-export/coverage.log): 16/16; batching, capture readiness, cancellation and retry. Native capture/save remains unverified. |
| C02–C04 / UIQ-02–04 | `profile-fetch-hook.test.tsx` | [profile-final-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/profile-final-green.log): five related suites, 106/106; account/credential/generation ordering, cold failure/retry, warm cache and spinner ownership. |
| C05–C07 / UIQ-05–07 | `profile-picker-responsive.test.tsx`, `ui-qa.test.tsx`, `picker-modal-focus.test.tsx` | [final-overlay-regression.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/final-overlay-regression.log): six suites, 33/33; [review-fixes-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/review-fixes-green.log): six suites, 29/29 including focus lifecycle. Browser/native scope is recorded separately below. |
| C08 / UIQ-08 | `profile-pager-resize.test.tsx` | [pager-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/pager-green.log): three suites, 20/20; width/selection/offset ownership. |
| C09–C13 / UIQ-09–13 | `primary-tab-preload.test.tsx`, `authenticated-navigation.test.tsx`, `liquid-navigation-scenes.test.tsx`, `root-motion-policy.test.tsx` | Final block of [nav-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/nav-green.log): five suites, 63/63, including `motion-preference.test.tsx`. C13 is specifically `root-motion-policy.test.tsx`. |
| C14 / UIQ-14 | `item-upgrades-lifecycle.test.tsx` | [data-flow/uiq-11-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/data-flow/uiq-11-green.log), [scoped-regression.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/data-flow/scoped-regression.log): account/session/request ownership and stale response rejection. |
| C15 / UIQ-15 | `account-info-screens.test.tsx` | [data-flow/uiq-15-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/data-flow/uiq-15-green.log): local About edits survive stale refresh fields. |
| C16 / UIQ-16 | `leaderboard-screen-lifecycle.test.tsx` | [data-flow/uiq-12-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/data-flow/uiq-12-green.log): 19/19, season cache attribution and failed selection. |
| C17, C24 / UIQ-17,24 | `match-details-screen.test.tsx` | [owned-profile-match-combat-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/owned-profile-match-combat-green.log): twelve suites, 244/244; usable cache after refresh failure and measured/retargeted round anchors. Earlier [match-round-anchor-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/match-round-anchor-green.log) still contains a failure and is not used as final pass evidence. |
| C18 / UIQ-18 | `media-popup.test.tsx` | [final-overlay-regression.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/final-overlay-regression.log), [review-fixes-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/review-fixes-green.log): obsolete callback ownership and recovery. |
| C19–C20 / UIQ-19–20 | `combat-screen-lifecycle.test.tsx`, `combat-data-hooks.test.tsx`, `combat-session-insights.test.ts` | [owned-profile-match-combat-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/owned-profile-match-combat-green.log): disappearing player Back handling, retry revision, removal of settled failed helper cache entries; pending dedup and successful caches remain. |
| C21 / UIQ-21 | `mobile-handoff-screen.test.tsx` | [data-flow/uiq-13-type-regression.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/data-flow/uiq-13-type-regression.log): 4/4; explicit retry and busy guard with mocked handoff. |
| C22 / UIQ-22 | `accessories-countdown.test.tsx` | [data-flow/uiq-14-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/data-flow/uiq-14-green.log): 2/2, stable deadline under rerender/account change; region-only change lacks a separate case. |
| C23 / UIQ-23 | `match-detail-accessibility.test.tsx` | [owned-profile-match-combat-green.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/owned-profile-match-combat-green.log); [match-combat-results.md](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/match-combat-results.md): Loadout uses team equipment aggregate; Total remains its alias under the existing data contract. No separate upstream quantity is invented. |
| C25 / UIQ-25 | `agent-modal-accessibility.test.tsx` | [final-overlay-regression.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/final-overlay-regression.log): close callback, ability labels/roles/selection. |
| C26 / UIQ-26 | `paper-back-action.test.tsx` | [final-overlay-regression.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/final-overlay-regression.log): explicit Back icon contract; W06 verifies browser glyph. |
| C27 / UIQ-27 | `liquid-glass-surface.test.tsx` | [final-overlay-regression.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/final-overlay-regression.log): web decorative semantics and native prop boundary. |

The external data-flow ledger uses its own earlier UIQ numbering. Its `uiq-11` maps to report UIQ-14 (upgrades), `uiq-12` to UIQ-16 (leaderboard), `uiq-13` to UIQ-21 (handoff), `uiq-14` to UIQ-22 (accessories), and `uiq-15` to UIQ-15 (About). This mapping preserves the canonical bug report IDs.

Latest [final-handoff-check.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/final-handoff-check.log) reports all-files coverage **73.12% statements / 68.25% branches / 69.1% functions / 73.55% lines**, still below 80%. Historical scoped collection/profile/data-flow coverage does not satisfy this global target. Passing all tests and export does not close the coverage or all-screen runtime requirement.

## Historical browser execution (W01–W08)

All eight entries in the historical [web-results.json](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/web-results.json) are PASS on the actual Expo web QA route, http://127.0.0.1:8081/ui-qa?demo=1, with local transport. They do not verify the newly accepted startup composition, phase progress or motion.

| ID | Recorded observed behavior |
|---|---|
| W01 | Fixture rendered and interactive. |
| W02 | Modal opens, focuses Close and hides background. |
| W03 | Vietnamese and emoji query shows empty state. |
| W04 | Clear restores both title options. |
| W05 | Dismiss restores trigger focus. |
| W06 | Back glyph renders without placeholder. |
| W07 | Shift+Tab and Tab wrap within the sheet. |
| W08 | Escape dismisses and restores trigger focus. |

Supporting captures: [web-fixture-after.png](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/web-fixture-after.png), [web-picker-after.png](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/web-picker-after.png). Browser keyboard evidence does not establish TalkBack behavior. Pixel latency is explicitly **NOT MEASURED** in the result.

## Native execution (N01–N05): retain each run's identity

Historical device serial 45218ba; recorded Android 15; 1080×2400 override from 1440×3200, density 420 dpi (2.625 px/dp), font scale 1.0. The older evidence uses development package com.android.vshop and installed client 4.1.10/code91 with then-current JS via Metro. The startupqa attempt below is a separate package/binary observation.

The saved [after-host-before-focus-extraction.json](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-host-before-focus-extraction.json) records **5 PASS / 0 FAIL / 0 BLOCKED** and N05 samples: 30. This is the historical snapshot used for the performance report. It predates focus extraction and both startup revisions, including the accepted icon/status/phase/motion design. **It is not a current native five-pass result; final-source/design parity remains NOT VERIFIED.**

| ID | Historical snapshot result / observed scope |
|---|---|
| N01 | PASS: weapon picker opens. |
| N02 | PASS: background QA controls excluded, selected skin exposed, Close target checked. The retained [picker XML](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-weapon-picker.xml) shows “Đóng” bounds [868,669][994,795]: 126×126 px = 48×48 dp at recorded density; one selected skin is present. |
| N03 | PASS: Android Back dismisses picker. |
| N04 | PASS: title Unicode query/clear and keyboard/modal Back sequence. |
| N05 | PASS: 30 open/Back cycles completed; frame and PSS summary retained. This is not a pixel timing measurement or a leak verdict. |

The run history contains materially different results and must not be merged into a fictional final all-pass run:

| Artifact | Recorded result | Interpretation |
|---|---|---|
| [after-first-native-results.json](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-first-native-results.json) | 4 PASS / 1 FAIL; N02 background controls exposed; N05 30 samples | Earlier fixture state failed isolation. |
| [after-second-native-results.json](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-second-native-results.json) | 4 PASS / 1 FAIL; same N02 issue; N05 30 samples | Another earlier failing snapshot, not a baseline improvement measurement. |
| [after-host-smoke-results.json](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-host-smoke-results.json) | 4 PASS / 1 BLOCKED; N05 “Local QA fixture missing; no input permitted” | Fixture guard prevented completion. |
| [after-native-results.json](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-native-results.json) | 4 PASS / 1 BLOCKED; N05 “Remote end closed connection without response” | Later retained attempt did not complete cycles. Its configured `cycles: 30` is not 30 successful samples. |

Other supporting captures: [after-fixture.png](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-fixture.png), [after-weapon-picker.png](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-weapon-picker.png), [after-after-cycles.png](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-after-cycles.png). Shared capture filenames are not immutable source hashes for every attempt; result JSON identities govern attribution. Initial [native-baseline.log](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native-baseline.log) failed with the device offline. No comparable before-patch baseline exists.

### Earlier interrupted startupqa attempt

[startup/native-qa/after-native-results.json](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-qa/after-native-results.json), supported by [native-qa-run.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-qa-run.log), records package com.android.vshop.startupqa, versionName=4.2.0 and versionCode=92: **zero PASS / one FAIL / four BLOCKED**. N01 timed out waiting for the weapon picker; N02–N05 are BLOCKED with “Local QA fixture missing; no input permitted.” Main reports that the device switched to another app during the runner. The raw FAIL is retained; the interrupted/guarded attempt alone does not establish a product regression or successful current UI acceptance.

That earlier runner's configured cycles=30 is not 30 completed samples. Its interruption led to a quiet-window request and does not by itself establish a product defect. It is now superseded for bounded fixture acceptance by the separate native-final 5/5 PASS, 10-cycle run below, while the failure history remains retained.

## Fresh physical QA and startup phase evidence

[native-final/after-native-results.json](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-native-results.json) records five PASS/zero FAIL/zero BLOCKED, N05 samples=10/cycles=10, on physical 45218ba/com.android.vshop.startupqa 4.2.0/code92, with new JS via Metro reported by main. This is distinct from code91/main-package/30-cycle history. Final typography/local recovery are evidenced separately below; this is a development-client observation, not a production release.

| Case | Fresh observed result |
|---|---|
| N01 | PASS — weapon picker opens. |
| N02 | PASS — guarded background/selection/close checks. [Picker XML](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-weapon-picker.xml) exposes selected QASkinA and Close bounds [868,669][994,795]. This does not establish complete TalkBack traversal. |
| N03 | PASS — Android Back dismisses picker. |
| N04 | PASS — Unicode title search/clear and keyboard/modal Back sequence. |
| N05 | PASS — **10 actual completed cycles**. The original 30-cycle stress target is not executed on this new scenario. Pixel latency remains NOT MEASURED. |

Supporting fresh artifacts: [fixture](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-fixture.png), [picker](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-weapon-picker.png), [after cycles](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-after-cycles.png) and [native-final-run.log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final-run.log).

Physical [session capture](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-session.png) shows the new mark, session status and **1/3**. Physical [data capture](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-data.png) shows data status and **2/3**; its [XML](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-data.xml) exposes startup-preview-screen, startup-brand-image, phase label and progress accessibility text. Source [phase mapping](../../constants/Startup.ts:6) maps prepare/session/data/ready to completed 0/1/2/3 stages; [root bootstrap](../../app/_layout.tsx:475) enters session before renewal and data before sync. Preview rendering and source mapping do not prove all actual Riot network/session/retry paths were exercised.

Verified fresh [raw gfxinfo](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-gfxinfo.txt) matches JSON: **458 frames, 45 janky (9.83%), p50/p90/p95/p99 12/34/77/93 ms, missed Vsync 2, GPU p95 5 ms**. PSS endpoints are **1,182,332 → 1,151,242 KiB**. See [UI_PERFORMANCE_REPORT](UI_PERFORMANCE_REPORT.md): these are independent diagnostics, not an improvement percentage, memory-fix proof or release guarantee.

### Pending final follow-up and separate export

Final [startup capture](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-final.png) shows full VShop, closing the earlier clipped title on the recorded device. [Recovery-final capture](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-recovery-final.png) shows localized status/actions; main's [startup ledger](STARTUP_REDESIGN_RESULTS.md) records exact localized up-to-date status after the local update callback and Retry back to visible progress using explicit state waits. No real update was applied. Final post-fix type/lint/Jest is PASS; native OS splash/release fidelity and all live network recovery remain NOT VERIFIED.

## Per-screen device coverage and remaining acceptance

The following matrix keeps all 26 inventoried routes visible. Source suites are **observed in prior logs**; helper/contract coverage does not imply every screen control was exercised. Device status applies to the route acceptance in the plan, not to reused components seen inside QA.

| Route / case | Source evidence observed in prior full log (suite stem) | Device acceptance / explicit gap |
|---|---|---|
| / — R01 | startup-cache, root-bootstrap-route | PARTIAL: physical startup preview 1/3 and 2/3, final full title, local recovery/Retry verified. Actual full cold/resume/auth/cache/live network recovery matrix NOT RUN; native OS splash fidelity unverified. |
| /setup — R02 | login-recovery | NOT RUN: first-run flow, keyboard/footer and real human login. |
| /reauth — R03 | riot-interactive-login, login-webview | NOT RUN: expired/add/switch account and native WebView/retry. |
| /language — R04 | phase3-visible-copy-i18n | NOT RUN: radio selection, persistence, long text and native Back. |
| /session_handoff — R05 | mobile-handoff-screen | NOT RUN: native retry/Back; real transfer excluded. |
| /ui-qa?demo=1 — R06 | ui-qa, ui-qa-boundary | PARTIAL route coverage: N01–N05 PASS/10 cycles; startup phase/final typography/local recovery previews verified. Historical W01–W08 PASS. All fixture states, 30-cycle stress and production parity unverified. |
| /bundles — R07 | bundle-card, bundle-ownership | NOT RUN: actual offers/cache/empty/error/refresh and Back. |
| /shop — R08 | glass-shop-gallery-cards, wishlist-recovery | NOT RUN: real screen refresh, wishlist/media and navigation. |
| /night_market — R09 | night-market-glass-clearance | NOT RUN: revealed/empty states, countdown and refresh. |
| /profile — R10 | profile-fetch-hook, player-info-view | NOT RUN: full account/pager/hero/Act flow, seven pickers/chroma and export. QA reuses picker components only. |
| /settings — R11 | account-session, recovery-update-ui | NOT RUN: account menus, recovery, secondary routes and tab collapse. |
| /equip — R12 | account-info-screens | NOT RUN: native search and equipment/skin preview. |
| /accessories — R13 | accessories-countdown, account-info-screens | NOT RUN: native offer list/countdown typing/refresh. |
| /gallery — R14 | gallery-filter, account-info-screens | NOT RUN: native grid/filter/search/preview. |
| /agent — R15 | agent-modal-accessibility, account-info-screens | NOT RUN: actual grid/role filters and modal traversal; locale/cache mismatch remains suspected. |
| /crosshair — R16 | account-info-screens | NOT RUN: native query/preview/clipboard integration. |
| /leaderboard — R17 | leaderboard-screen-lifecycle | NOT RUN: native Act/query/refresh and failed season switch. |
| /combat — R18 | combat-screen-lifecycle, party-screen | NOT RUN: native no-game/party/pregame, transitions and retry; live mutations excluded. |
| /combat_session — R19 | combat-data-hooks, combat-store, screen-orientation | NOT RUN: live roster/intel, player disappearance, landscape entry and portrait restoration; no live match proof. |
| /friends — R20 | friend-search, friend-presence | NOT RUN: native presence/row navigation; live invite excluded. |
| /chat/[friendId] — R21 | xmpp-buffer | NOT RUN: native keyboard/message list and TLS-connected behavior; send excluded. |
| /history — R22 | match-archive, match-card | NOT RUN: native pagination/refresh/empty/error and detail navigation. |
| /match_details/[id] — R23 | match-details-screen, match-detail-accessibility | NOT RUN: native scoreboard/performance/round anchor and Back, including high-font layout. |
| /contracts — R24 | account-info-screens | NOT RUN: native progress/empty states; in-app entry not discovered. |
| /item_upgrades — R25 | item-upgrades-lifecycle | NOT RUN: native search/expand/owner switch; in-app entry not discovered; live upgrade excluded. |
| /about — R26 | account-info-screens | NOT RUN: native config/status/local override refresh; in-app entry not discovered. |

Cross-screen gaps: TalkBack focus/traversal for every modal kind, large font scales, narrow/tablet native bounds, gesture versus button system navigation, live Reduce Motion interruption, overlapping tab/scroll interactions, authenticated read-only network recovery and release frame measurements. The QA fixture establishes a limited interaction path; broad accessibility, all-screen runtime correctness and total UI validation remain **NOT VERIFIED**.
