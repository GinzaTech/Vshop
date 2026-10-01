# Native Navigation Backdrop Refraction Implementation Plan

**Status:** implementing, following the user's “Cứ chạy tiếp đi”. Physical
device acceptance remains pending; ADB currently lists no device.

## Scope and binding constraints

The user rejected blur/gradient-only glass and chose to retain the parameters in
`C:/Users/kona/Downloads/README-bottom-tabbar-liquid-glass-codex.md`. Refract real
page content beneath the moving lens; do not substitute a snapshot of icons.
Keep the outer white 0.88, Android gray 0.92, 54/50dp heights, 14dp side margins,
1.065 magnification, existing MorphIcon identity, spring, crossfade and hit areas.
Testing target is physical `45218ba` only. No emulator, account mutations,
publication, destructive Git operations or changes to the two protected UI files.

## Architecture

A local Expo Android module provides a page target and decorative lens view.
The target retains its normal hardware display list in a RenderNode. It does
not allocate a page bitmap or export pixels to JS, disk or a service. The lens
draws a reference to that node into a small padded lens-sized RenderNode, with
the source-to-lens global transform applied before an AGSL RuntimeShader.
Only this small node gets the shader effect. Existing icons/labels remain sharp
and accessible above it. Existing native blur remains below the outer capsule.

Android API 33+ and hardware rendering are required. Older Android, old installed
binaries without the module, iOS, web, Reduce Motion, hidden/background screens,
invalid targets/transforms and renderer failures preserve the existing material.
The native target records during normal drawing; source invalidations and native
pre-draw transform changes update the lens without a timer or JS frame loop.
Detach/disable releases display lists and listeners. SurfaceView/video pixels
are not guaranteed by normal View drawing and are not claimed as supported.

Primary references checked: Android RenderNode, RenderEffect.createRuntimeShaderEffect
and AGSL documentation; installed Expo 57 module/view adapters; BlurView 3.1.0
hardware path. No new third-party rendering dependency is required.

## Tasks and acceptance

1. [x] RED/GREEN JS policy/bridge tests: API and binary availability, missing
   target, disabled/background/reduced state, decoration semantics and platform
   fallback. Target wraps pages only, never its consuming lens.
2. [x] Implement local module, bounded geometry/shader and lifecycle. Add JVM
   unit tests for bounds/validation and native build verification. Never infer
   AGSL compilation or pixel correctness from mocked JS/native source tests.
3. [x] Integrate the page-only target with the existing shell and lens without
   replacing active AppIcon or changing navigation behavior. Run regression
   tests for persistence, rapid retarget, prevented presses and accessibility.
4. [ ] Fresh independent review, targeted coverage, `pnpm run check`, Android
   export/budget, Gradle dev build, diff check. Preserve unrelated dirty files.
5. [ ] Reconnect/unlock physical phone, same-signer dev install, actual shader
   startup and scroll/tab video, fallback/reduced-motion lifecycle, warm A/B
   frame measurements. No visual/performance completion claim before evidence.

## Review focus

- Source/consumer cycles, stale IDs, hidden page exposure and detached targets.
- Matrix ordering, density/stretch compensation and padded crop bounds.
- Native invalidation feedback loops, listener cleanup, background GPU work.
- Shader compilation/failure handling and old-binary/web safe loading.
- No double tint or duplicate icons; unchanged 0.92 material and touch semantics.

## Execution ledger

- Ruling: replace the previous unimplemented icon-strip snapshot design with
  real page display-list sampling. The latest continuation follows the stated
  full-backdrop direction. Cost: a new same-signer development build is needed.
- Ruling: retain this checkout and ledger (companion workflow scripts are not
  installed), no commit. Existing dirty work and protected UI files stay intact.
- Pre-flight: target produces a native tag and retained page node; lens consumes
  only that tag. Both live under the shell but the lens is outside the target.
- Device preflight: ARTEMIS/ADB confirms no connected device. Unit/native build
  work can proceed; no new device-interaction test claims are made.
- JS policy/bridge: 27 tests PASS after missing-module RED; shell integration
  regression failed before wrapping pages, then passed with the committed tag.
- Kotlin geometry: initial unresolved-class RED then 3 JVM tests PASS; added
  invalid affine mapping cases, unresolved-method RED then 4 tests PASS.
- Native source compile + ARM64 development assembly: PASS (772 Gradle tasks,
  41s), log `C:/Users/kona/AppData/Local/Temp/vshop-refraction-build-20260930.log`.
  This does not prove AGSL compilation on the phone or rendered pixels.
- Architecture review applied: preserve Yoga child coordinates, invalidate the
  normal page after discarding its referenced node, fallback on source capture
  exceptions, reject singular/perspective transforms, update source structure
  through normal traversal, never notify consumers merely because drawing ran.
- Full gate PASS: 161 suites / 2,260 Jest tests, strict types, zero-warning lint,
  documented production audit policy and Android export (10.42 MiB total,
  7.95 MiB Hermes, largest asset 1.25 MiB). The temporary export was cleaned.
  Log: `C:/Users/kona/AppData/Local/Temp/vshop-refraction-full-check-20260930.log`.
- Scoped JS policy/bridge/fallback coverage: 100% statements/branches/functions/
  lines (27 tests). This is not native GPU coverage. Global project coverage is
  70.22% lines, still below the requested 80%; do not report global coverage met.
- Signed pre-review candidate (not installed):
  `.codex-tmp/builds/VShop-4.1.10-development-91-refraction-candidate1-arm64.apk`,
  SHA-256 `3da8f0cec8aa2a1658d31b5ec5ca9980f205d48ec783604f8cf5345703b5bda0`.
  `apksigner verify` matches the pulled physical-phone backup certificate;
  `zipalign -c -P 16 4` PASS. Debuggable, `com.android.vshop`, 4.1.10/code91,
  ARM64-only. Keep the prior development APK intact for a same-signer rollback.
- Fresh independent review: no P0/P1 found in inspected source; two P2 lifecycle
  findings are accepted for the fix pass: an unchanged mapping after invalidity/
  target rebind must schedule one draw, and aggregate target hiding must release
  its extra display list. Candidate1 is pre-fix and must not be installed.
  The native recording diagnostic will not be labelled proof of GPU success.
- Fix pass completed: lifecycle policy regressions demonstrated 3 failures under
  the old decisions, then passed for one-shot rebind/recovery and aggregate
  visibility cleanup. A further failed-first source-publication case now wakes
  a static consumer once when a new page node becomes ready, never every draw.
  Nine JVM policy/geometry tests PASS. Android callback/GPU behavior is still
  unverified; these tests do not simulate a hardware View tree.
- Final native build PASS (772 tasks, 35s):
  `C:/Users/kona/AppData/Local/Temp/vshop-refraction-candidate2-native-20260930.log`.
  Final unchanged-JS gate PASS (161 suites/2,260 tests, same export budget):
  `C:/Users/kona/AppData/Local/Temp/vshop-refraction-final-check-20260930.log`.
  `git diff --check` PASS. Both protected user-owned UI files retain their hashes.
- Current install candidate, superseding candidate1:
  `.codex-tmp/builds/VShop-4.1.10-development-91-refraction-candidate2-arm64.apk`,
  SHA-256 `045f4cd9530216ec1eac05b50da6ceefab528a799370724f043f7c0e2578532c`.
  Same-signer verification against phone backup and 16 KiB alignment PASS.
  **NOT INSTALLED**: latest ADB discovery remains empty. Do not claim shader
  startup, GPU output, visual match, native coverage or frame performance verified.
- Remaining gate: reconnect/unlock physical `45218ba`, install candidate2 using
  `install -r` only after fresh signer/readiness checks, inspect real pixels and
  interaction/video/frame metrics. Do not launch an emulator or publish an OTA.

## Physical continuation after reconnection

- Physical `45218ba` returned authorized/awake/unlocked, Android 15, battery91%.
  Pulled the currently installed base APK to
  `C:/Users/kona/AppData/Local/Temp/vshop-physical-before-refraction-20260930.apk`;
  signer matches candidate2. `install -r` succeeded, data preserved, localhost
  Metro/reverse8081 launched the development app. Initial white startup lasted
  through a 34s Metro bundle; the app then rendered without AndroidRuntime error.
- Native `VShopGlass` reported commands recorded, with its explicit GPU-pixels
  disclaimer. Actual screenshots show the app/cards/bar, but this alone is not
  proof of correct refraction/displacement or frame performance.
- First navigation run selected Bundles then failed at Shop with a bottom-edge
  test tap. A freshly guarded semantic center click selected Shop immediately.
  Fix the harness's point, then rerun; do not classify this as a product tap bug.
- Physical screenshot + source confirm Night Market reserves bar clearance on
  the OUTER scene, clipping all scrolling artwork above the bar. Move that same
  safe clearance into the ScrollView's content padding so the last item remains
  reachable while content can travel under the glass. Preserve all geometry,
  tint, icon animation and refresh behavior. Add RED/GREEN scene/route tests
  before implementation, then inspect the changed page on this same phone.
- Night Market clearance correction implemented after 4 behavioral failures
  (outer viewport padding + content clearance at 3 safe insets). Scene, route
  and navigation tests pass; empty-state refresh remains wired to real reads.
  Final gate: 162 Jest suites / 2,264 tests, type/lint/audit/export PASS at
  `C:/Users/kona/AppData/Local/Temp/vshop-night-market-clearance-check-20260930.log`.
  Export stayed 10.42 MiB total / 7.95 MiB Hermes; temporary output was removed.
- Harness now uses the actual semantic bounds' center with UIAutomator2 click,
  keeping readiness checks. Five failed-first host tests and all 15 Python tests
  pass. The patched full phone navigation run is still pending.
- Runtime screenshot caveat: the captured Bundles bar shows a moon-like active
  glyph after leaving Night Market. Do not mark icon fidelity verified; check a
  clean repeat after the repair interval on the phone before deciding whether
  this is persistent MorphIcon behavior or a transitional observation.
- Phone focus subsequently changed to Zalo. Guard blocked further input; the
  same VShop PID 18550 remained alive, no new scoped AndroidRuntime error was
  observed. Asked the user for a five-minute VShop foreground window and stopped
  device input rather than stealing focus. Current native APK is installed;
  corrected Night Market JS is available through Metro, not yet visually checked.
- Scoped independent review of the Night Market change found no actionable
  regression in clearance placement, retained fade/accessibility, empty refresh
  or safe insets. Physical last-item clearance remains a separate pending check.

## User-requested test at 21:05 (Asia/Bangkok)

- Physical navigation harness with center clicks PASS for selection/geometry on
  all five tabs. Evidence directory:
  `C:/Users/kona/AppData/Local/Temp/vshop-phone-test-20260930-2105/navigation`.
  Screenshots show the correct settled active glyph for each tab in this run;
  the earlier moon-like Bundles glyph was not reproduced in these five captures.
- DEV/instrumented warm run reported 118 frames / 96 janky (81.36%), median48ms,
  P95 150ms. Do not call performance accepted or convert this to production FPS.
  This run does not prove sub-300ms interrupt timing.
- User called out the Bundle gray haze and missing hold-to-collapse navigation.
  Source confirms Bundle uses its artwork as a private blur background (45)
  plus gray frost0.72; the visible haze is not proof of glass refraction.
- CONFIRMED SOURCE REGRESSION: old HEAD nav has collapsed state, Settings long
  press, and `primary-navigation-expand`; current FloatingTabBar has none.
  User expects a 500ms hold. HEAD used1000ms, but any restoration must follow the
  user's current500ms requirement rather than silently restore the old threshold.
  Five-tab selection PASS did not cover this lost feature. No fix is claimed.
- A follow-up physical hold probe was blocked by the foreground guard before
  input because VShop no longer owned focus. No long-press runtime result is
  claimed from that rejected probe. No purchase, party or live loadout writes.
- Additional read-only regression audit: HEAD's navigation test exercised
  Settings `onLongPress`, disappearance of expanded tabs, and pressing
  `Expand navigation` to restore them. Current `authenticated-navigation.test.tsx`
  instead explicitly expects Settings `onLongPress` to be undefined. Therefore
  the green suite encoded the lost behavior; restoration must replace this
  assertion with 500ms collapse/expand and release-without-navigation coverage.
  Ownership haze is separate in BundleItem (`ownedOverlay` opacity0.55 and a
  green check); removing Bundle's artwork backdrop must not remove that state.
  Product changes await the bounded-design confirmation requested in chat.
