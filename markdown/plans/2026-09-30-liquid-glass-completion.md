# Liquid glass, unfinished loadout and device completion

**Status:** active
**Current device instruction:** The user's latest request stops emulator testing and moves subsequent runtime QA to the physical phone. Use only `45218ba` (23013PC75G / ARM64) after verifying availability. Historical emulator evidence below remains valid only for its stated environment; do not resume emulator testing from the older goal wording.

## Approved physical navigation optical refinement

The user reports the real phone's bar still looks flat. The physical before image
is `C:/Users/kona/AppData/Local/Temp/vshop-phone-glass-qa-20260930/navigation-before-material-refinement.jpg`.
The native hierarchy confirms both `navigation-blur-target` and
`primary-tab-backdrop-blur` exist. The user explicitly chose **keep the exact
Markdown values, only add missing effects**, rejecting reduced opacity.

- Keep the white outer 0.88 material, Android lens 0.92 material, gray/white/red
  palette, 54dp capsule, 50dp lens, five equal slots, icon/label sizes, spring,
  1.065 magnification and scene timing. No dark background or new dependency.
- Add the actual spec section 17 vertical lens highlight (white 0.72 → 0.16 → 0),
  rendered beneath sharp glyphs/text. Add section 5.3's very light inner separator.
- Add section 18's subtle red/blue lens-edge fringe only while progress is
  between 0.12 and 0.92, peak composed opacity 0.18/0.10. No fringe at rest or
  under Reduce Motion; no infinite/entrance shimmer or per-frame blur changes.
- Preserve the existing duplicate-row pseudo-refraction; add at most 1.5dp
  direction-aware optical offset during travel, compensated consistently for
  clone/glyph and zero at rest/Reduce Motion. No full-screen snapshot shader.
- Add deterministic material/progress tests, keep all active-icon persistence
  and rapid-retarget tests, and verify before/after plus motion on `45218ba`.
  Scope: navigation material/tokens only; other card/API code is unchanged.

### Follow-up findings and scope confirmation

- Physical navigation harness passes selection/geometry on all five tabs and an
  eight-press retarget sequence at the user's existing 1080x2400 / density420
  override, font1.0/animation1.0. Evidence is under
  `C:/Users/kona/AppData/Local/Temp/vshop-phone-glass-qa-20260930/navigation-optics/`.
  Its DEV frame sample is poor (27/29 janky) and is not an FPS success claim.
- Initial optical implementation added specular gradient, transient edge fringe
  and a bounded 1.5dp offset; 61 related tests and typecheck/lint passed, new
  optics coverage was 100% lines / 87.5% branches. Video
  `navigation-optics-motion.mp4` was recorded on the physical phone, not emulator.
- The user rejected this as still not liquid glass. Do not call blur plus
  magnification/decoration full refraction or mark that requirement complete.
- Inspection of installed `react-native-svg` 15.15.4's `extractGradient` found it
  overwrites rgba alpha with stopOpacity (default 1). New tests exercising its
  actual native serialization reproduced alpha 1 instead of 0.72 and clear
  stops becoming opaque. Explicit `GLASS_SVG_OPACITY` values now fix the lens and
  the existing shared card gradient, without changing the approved CSS material
  values. The two regressions went RED→GREEN; related tests pass 51/51. This
  fixes unintended white paint, not the missing per-pixel refraction itself.
- A Skia strip-refraction implementation plan exists at
  `2026-09-30-native-lens-refraction.md`, awaiting review. It samples only the
  actual icon/label strip; it does NOT refract the page background. An explicit
  async question asks which of those two outcomes the user wants before choosing
  that limited plan or a true backdrop-rendering architecture. No shader capture
  implementation has been started, and no easier strip-only substitute has been
  presented as completed full-background liquid glass.
- Post-alpha complete gate passed: 159 suites / 2,200 tests, typecheck, zero-warning
  lint, audit policy and Android export (10.42 MiB total / 7.95 MiB Hermes /
  1.25 MiB largest asset). Global lines remain 69.87%, not app-wide 80%.
  Log: `C:/Users/kona/AppData/Local/Temp/vshop-glass-alpha-full-check-20260930.log`.
  Both protected-file hashes still match and `git diff --check` is clean.
  The current material/alpha changes are source-verified; the user's actual
  liquid-glass/refraction requirement remains open, pending the explicit scope
  choice and subsequent shader implementation/physical verification.
**Authorization:** The user explicitly resumed work on 2026-09-30 with the active goal to extend liquid glass broadly, finish pending work and run the full test scope on an emulator. This supersedes the earlier stop for this work; the stopped handoff remains a historical record.

## Scope and design

- Finish serialized/coalesced Profile loadout writes and nonblocking selection, including reads/cache/lifecycle reconciliation described in the existing Profile plan. Keep the four compact expression slots.
- Implement the floating Liquid Glass tab bar from `C:/Users/kona/Downloads/README-bottom-tabbar-liquid-glass-codex.md`, preserving the current icon animation system. Preserve existing VShop route functions; map the reference's five equal visual slots to the existing five primary routes. Keep empty Night Market navigable as an honest empty screen so the bar stays five slots and does not resize with API data.
- Extend a shared light liquid-glass material across weapon/shop cards, Profile collection/equipment cards, Bundle surfaces, existing GlassCard consumers and appropriate supporting panels. Audit actual consumers rather than only renaming a flat white background. Use translucent/frosted layers, specular rim/highlight, soft shadow and readable content; native blur where a valid target exists and lightweight optical layers for repeated tiles.
- Palette anchors: white `#FFFFFF`, muted glass `#ECEEF0`, dark foreground `#11181C`, reference navigation red `#C72232`, Valorant branding red `#FF4655`, secondary text `#687076`. The reference red protects small-label contrast on the gray lens. Material-specific transparency/highlights live in DesignSystem; typography keeps the app font and existing hierarchy.
- Layout: large art stays clear above its frosted content surface; compact price/ownership remain readable. The navigation is a separate persistent lower capsule with moving magnifying lens and delayed screen crossfade.
- Motion: UI-thread Reanimated, existing MorphIcon paths/triggers retained, static blur/shadow, Reduce Motion support. No per-frame React state or looping shimmer across lists.

## Work ownership

1. Loadout worker: queue, registry, Profile mutation/fetch/picker integration, loadout service/cache validation and meaningful race/contract tests. No card material or navigation edits.
2. Shared glass/card worker: glass primitives and targeted card/panel adoption; no Profile mutation/fetch or navigation edits.
3. Navigation worker: persistent tab bar/lens and scene timing; no API or shared-card internals.
4. Main: shared design tokens, emulator setup/exploration, integration review, verification, diagnostics and final evidence.

## Required outcomes and evidence

- [x] Latest per-field loadout selections remain visible and editable during request latency; no concurrent full-payload PUT for one owner, no obsolete Version, and no old result/cache/confirmation overwriting newer intent. Source race/receipt tests and physical isolated normal/reduced QA support these client-side claims, not real Riot application latency.
- [x] Definitive and ambiguous failures preserve or roll back only the correct current field revisions. Auth/token/generation/retained callbacks/unmount are covered by source tests; physical isolated failure rollback passed in both motion modes. No real account mutation smoke test is introduced.
- [x] Four actual expression slots share one row, with accessible labels/targets and working selectors. Final physical open/close rerun passed all4 without equipment changes; see the regression repair plan for bounds/evidence.
- [ ] Weapon skin cards and the identified shared surfaces visibly use the new glass material, while prices, artwork, ownership and input hit targets remain clear.
- [ ] Tab bar meets the provided geometry, lens movement/stretch/magnification, active tint, delayed 110–150ms crossfade, rapid retarget, persistent state, safe area and Reduce Motion requirements. Existing icon animations remain functional.
- [ ] Device exploration and executable interaction checks cover affected screens and interrupted/rapid transitions, local/fixture loadout behavior, refresh, empty/error states, font scaling, scroll retention and accessible state. The latest required target is the physical phone; earlier emulator evidence is historical only. Record screenshots/video and real frame measurements; do not equate static tests with FPS.
- [ ] Full `pnpm run check`, Android export/budget, appropriate scoped coverage, independent code review and clean diff checks pass after writers stop. Record global coverage honestly.
- [ ] Update project docs/evidence with exact source/build/runtime distinctions. No production publishing is implied.

## Environment notes

- Current emulator debug build exposed an existing signing-plugin bug: release configuration eagerly calls `file(null)` without production secrets, even for Debug. Repair the authoritative Expo plugin, permit unsigned release configuration while configuring Debug, and explicitly fail actual release packaging when production signing variables are missing. Do not substitute a debug signer for production.
- Initial emulator at discovery was `Medium_Phone_API_36.1`. The user has since stopped emulator testing and selected physical phone `45218ba`.
- ARTEMIS autonomous LLM execution currently lacks a provider key. Its emulator/observation tools and direct ADB can still support deterministic local testing; do not extract credentials or put them in chat.
- A referenced video was not attached with the navigation Markdown. Validate the explicit written requirements; direct video-fidelity claims require the reference itself.
- The reset tool requires explicit confirmation for each redemption. General permission to auto-reset at 5% cannot replace that confirmation.

## Current execution evidence

- AVD `Medium_Phone_API_36.1` initially remained offline with a live QEMU process; WHPX acceleration was usable. ADB self-heal alone did not resolve it. A cold boot (no data wipe) reached ready in 33 seconds at `emulator-5554`, Android 16.
- Temporary AVD fastboot settings were backed up to `C:/Users/kona/AppData/Local/Temp/vshop-avd-config-before-glass-qa-20260930.ini`; restore the two original fastboot preferences after QA. The AVD data was preserved.
- Native Debug 4.1.10 / code 91 / x86_64 build passed: 747 Gradle tasks, 9m04s. Artifact `.codex-tmp/builds/VShop-4.1.10-development-91-x86_64.apk`, SHA256 `1A80AB9A4305F9630FD9371EFB1B799EE2015A50F155B55B6DF55605D200F113`.
- Installed app was Debug 4.1.0 / code 79. Both certificate SHA256 values were `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; `adb -s emulator-5554 install -r` returned Success. This proves same-signer installation, not the new UI or API behavior.
- Signing prerequisite regression: 6 tests passed. Real Gradle Debug configuration/build works without production signing variables; an `assembleRelease --dry-run` with them absent fails with the expected explicit credential error, retaining fail-closed release behavior.
- Small navigation label contrast is protected by a test against the gray lens using the reference `#C72232` red.
- ARTEMIS direct hierarchy observation works on the emulator without the autonomous-agent provider key. Main can execute deterministic ADB flows and inspect their actual result.
- Resume gate: the completed full check log reports 157 suites / 2,181 tests, global lines 69.82% (not 80%), Android export 10.42 MiB total / 7.94 MiB Hermes / 1.25 MiB largest asset. Protected viewport/refresh hashes remain unchanged.
- Ruling: use the existing project plan as the execution ledger because the selected skill's companion scripts are absent. Continue in the user-selected dirty checkout; do not relocate or discard the existing work.
- Emulator QA found stale ARTEMIS helper hierarchy after a modal close (ADB UIAutomator and pixels confirmed the close). Switch executable observations to the existing UIAutomator2 backend, retaining ARTEMIS's grounded exploration. Refuse any action without local fixture markers and an explicit verified emulator serial.
- Ruling: isolated QA transport latency is now 5,000ms rather than 1,500ms, leaving an observation window on this slow instrumented emulator. This is not production timing or a latency claim. The displayed note derives from the same tested constant. Record actual nonblocking state before ACK; never infer it from eventual server success.
- Independent review (Goodall) found a P1 cache-to-queue provenance race: an invalidated force GET could substitute old cache, clear uncertainty after a lost ACK, and replay a queued v2 full-payload write over an already applied field. Two integration regressions (v2/v3) were observed RED before fixing force invalidation to return `null`. A third combined-hook regression was observed RED before forbidding ordinary cached reads from resolving uncertainty. Related tests now pass 76/76; strict typecheck passes. Fresh force reads still recover and preserve both fields.
- Native isolated loadout run with OS Reduce Motion enabled: PASS, four cells share bounds y=1481..1762; title picker was observed while first PUT was in flight; final server/display skin C + title B agree; maxInFlight=1; injected skin failure rolls back only skin. Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-glass-qa-20260930/loadout-reduced/local-ui-report.json` and three PNGs. This does not establish ordinary-motion responsiveness or real Riot timing.
- Ordinary-motion harness repeatedly observed controls not updating reliably. Reduced Motion changes both animation and native-card blur, so the cause is not established. Temporary A/B probe uses `variant="bundle"` only in QA previews (native blur off, motion on); restore store previews after the probe. SurfaceFlinger reports host NVIDIA RTX 3060 Ti translation, not SwiftShader/software rendering.
- A/B result: with ordinary motion and static-only QA preview glass, second-picker-during-save passed. The test then sampled the previous idle state before the C selection had rendered (later native observation confirmed C + title B, Version 4). The harness now explicitly waits for the chosen skin and picker dismissal before assessing idle. Store/native-blur previews were restored. This result alone does not identify blur as the cause of ordinary-motion instability.
- Ordinary-motion final local loadout run: PASS in 60.125s with original store/native-glass previews restored and Android animator preference restored to its original absent/default value. Same four checks pass, including actual title picker while first PUT remains in flight. Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-glass-qa-20260930/loadout-native-final/local-ui-report.json` and its three PNGs. Harness waits for mounted option nodes and selected value + picker dismissal, rather than treating the previous idle state as completion. This tests nonblocking behavior, not a sub-100ms response time or real-game application.
- Scrolled native skin material was captured at `C:/Users/kona/AppData/Local/Temp/vshop-glass-qa-20260930/glass-preview.png`; synthetic price/ownership and disabled preview input remain explicitly labelled. A CPU-profiler attempt returned no artifact; it is not performance evidence.
- Post-review full gate: `pnpm run check` exited 0 with 158 suites / 2,185 tests. Global coverage: statements 69.56%, branches 65.58%, functions 65.32%, lines 69.85%; do not report app-wide 80%. Queue lines 100% / branches 92.78%, cache lines 100% / branches 87.75%; the broader fetch module remains 79.55% lines / 68.23% branches and still needs coverage work. Android export is 10.42/12 MiB total, 7.94/8 MiB Hermes, 1.25/1.50 MiB largest asset. Its unique temporary directory was automatically removed and absence verified. `git diff --check` passes, protected viewport/refresh hashes are unchanged. Log: `C:/Users/kona/AppData/Local/Temp/vshop-glass-check-after-review-20260930.log`.
- Native Profile demo and Settings selected states render the real persistent bar. At density 420, capsule bounds `[37,2185][1043,2327]` correspond to ~54dp height and ~14dp side margin; all five actual routes have near-equal touch bounds. `navigation-settings.png` shows the white capsule, gray lens, red selected Settings glyph/text and preserved vector icons. Whole-flow, larger-font and frame assertions remain separate.
- Runtime visual finding: settled Night Market screenshot still shows Shop red outside the lens (`navigation-night-market-settled.png`). Fix the material composition so the base row is always neutral and red icon/label clones exist only inside the traveling clip; keep the single active MorphIcon, magnification and lens animation. This enforces the reference's active-color-under-lens relationship without relying on stale per-icon opacity overlays. Add a regression test, then repeat native capture before claiming visual completion.
- Tint fix: regression was observed RED (base row contained duplicated red/neutral icons), then passed after restricting red clones to the lens and keeping five neutral base icons. Related navigation tests pass 52/52 and strict typecheck passes. Native recheck `navigation-tint-fixed.png` now shows only Night Market red; Shop is neutral. The active MorphIcon remains mounted, and the lens/clone transforms are retained.
- Final source gate after tint fix: `pnpm run check` exited 0; 158 suites / 2,186 tests, global lines 69.84% (branches 65.59%, statements 69.56%, functions 65.31%). Android export 10.41 MiB total / 7.94 MiB Hermes / 1.25 MiB largest asset. Log: `C:/Users/kona/AppData/Local/Temp/vshop-glass-check-final-nav-20260930.log`.
- Native navigation selection/geometry harness now passes all five actual routes and the eight-press retarget sequence, with a UIAutomator device-info freshness check before each tree. Evidence: `navigation-tint-fixed-run/navigation-report.json` under the same external QA folder. This result proves selection/geometry, not every scene's data/gesture behavior. Earlier failed runs remain preserved; later manual pixels confirmed the empty Night Market route does open.
- Frame evidence does not prove smoothness: the first scripted sample overlapped source checks and returned only 9 app frames (100% flagged janky); a quiet capture repeat returned only 2 app frames with emulator GPU outliers. A completed `navigation-motion.mp4` contains 87 encoded frames over 17.523589s; it is variable-frame-rate recording with static periods, not a 4.96 FPS app measurement. Do not claim 60 FPS or performance improvement. More controlled native profiling is required.
- Temporary Android animator setting was removed, returning to its original absent/default value. The AVD's two fastboot preferences were restored to `forceColdBoot=no`, `forceFastBoot=yes` after checking the saved original; running emulator data and APK are retained. No phone actions, shutdown, production publish, commit or push were performed.

## Remaining verification at this checkpoint

- Inspect full Profile content/scroll retention, secondary headers/Back, popup accessibility and font scaling on the emulator, rather than treating selected-tab flags as full E2E proof.
- Complete all four native expression-slot interactions; current native pass proves their common-row geometry, while callback/equip coverage is currently source-level.
- Review bundle ownership overlays with available owned data without inventing purchases or sending live mutations. Bundle/Shop cached data renders were observed, but freshness and all ownership states were not established by screenshots.
- Improve fetch-module and app-wide coverage toward the required threshold; current global coverage is explicitly below 80%.
- Collect interpretable, controlled frame/animation evidence and complete reference fidelity checks; no supplied reference video exists to support a video-perfect claim.
- Source and local-transport behavior pass, but real Riot/PC apply latency is not tested automatically. Keep the goal active; no completion claim yet.

### Independent progress while shader scope awaits confirmation

- Expanded behavioral coverage of `useProfileFetch`: cold/warm idle delays,
  cancellation, no-auth reset, missing-session inputs, metadata failures/unmount,
  partial refresh and stats lifecycle. The new suite found a real RED case:
  ownership/rank cache publication could trigger hydration that replaced an
  unconfirmed fallback choice when no registry queue existed.
- Main reproduced that failure plus six stale-owner/auth cleanup cases. Hydration
  now preserves fallback pending display only in the same account/region/token/
  generation and clears it when that authority changes or auth is lost. The cache
  still receives only server authority. 60 related tests pass; hook coverage is
  96.33% statements, 85.08% branches, 96% functions and 97.89% lines. This closes
  the touched-hook coverage gap, not the global app-wide coverage gap.
- Physical JS profiling attempt used the installed inspector contract. Generic
  `Profiler.enable` is unsupported; the installed RN inspector uses `Tracing`.
  A `Tracing.start/end` round accepted commands but no completion event arrived
  within the bounded collection window, so no complete CPU profile was produced.
  Do not diagnose blur/shader from this failed profiler attempt. The socket was
  closed after stopping its trace; there is no active profiling run.
- Existing phone gfxinfo rows all carry OEM flag 32 and the exported header's
  FrameInterval/FrameStartTime columns contain timestamp/interval-like values in
  the opposite order. Keep the raw data and native summary; do not derive a
  precise FPS from those mislabeled-looking columns or from VFR video frame count.
- Independent read-only review of the hydration fix found no new actionable
  issue, including owner change without a cache, same-owner ownership refresh,
  queue precedence, retired callbacks and effect replay. Full post-fix gate
  exited 0: 159 suites / 2,232 tests, typecheck, lint, audit policy, Android export
  10.42/12 MiB total, 7.95/8 MiB Hermes and 1.25/1.50 MiB largest asset.
  Global lines are 70.17%, still below 80%. Log:
  `C:/Users/kona/AppData/Local/Temp/vshop-hydration-final-check-20260930.log`.
- Physical Profile selector check passes: all four real Flex slot controls share
  y=1779..2061, each opens the corresponding slot picker, dismisses successfully,
  and leaves the displayed equipment unchanged. No option was selected, no equip
  was sent. Re-runnable script: `scripts/verify-android-profile-selectors.py`.
  Evidence: `C:/Users/kona/AppData/Local/Temp/vshop-phone-glass-qa-20260930/profile-selectors/profile-selectors-report.json`.
  This proves geometry/open-close, not a real Riot mutation or full TalkBack audit.

## Physical-device handover

- ADB discovery: one authorized physical phone `45218ba` and the prior emulator. No Python navigation/loadout test or scrcpy recording process remains live. The emulator disconnected before cleanup commands; no emulator restart is requested.
- Phone package is development `com.android.vshop` 4.1.9 / versionCode 90 / ARM64, with DEBUGGABLE set. The current 4.1.10 development artifact is x86_64-only and must not be installed on this phone.
- Phone foreground is the call UI. Do not capture it or bring VShop over the call until the user confirms availability. A concise async availability question has been sent; local build preparation can continue independently.
- Prepare ARM64 Debug 4.1.10 / code 91 from the authoritative Expo/native configuration, verify same signer before any data-preserving install. No uninstall/data clear, no real Riot mutation smoke test, and no automatic power/sleep/shutdown action.
- User confirmed the phone is ready; foreground moved from call UI to launcher before any VShop action. Device is Android 15, physical 1440x3200 / density 560 with pre-existing overrides 1080x2400 / density 420. Font scale and animator duration scale are both 1.0. Do not change those overrides.
- Installed Debug code 90 APK was backed up read-only to `C:/Users/kona/AppData/Local/Temp/vshop-physical-before-20260930.apk`. Its certificate SHA256 is `736f72bc0a3c6a33b4a774115f52f540192448f0105585653ddaa4c93a53c462`, matching the existing EAS-signed project artifact and the configured local keystore certificate (verified without exposing passwords). The generated default Android debug key does NOT match; never install its raw output over the phone package. Sign only the scoped development artifact using the matching existing credential, then verify the signed output before installation.
- ARM64 build in progress: `:app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain --max-workers=4`; log `C:/Users/kona/AppData/Local/Temp/vshop-arm64-dev-build-20260930.log`. Build success and installation are not yet claimed.
- ARM64 build completed successfully in 3m41s (747 tasks). Signed scoped Debug artifact `.codex-tmp/builds/VShop-4.1.10-development-91-arm64.apk` with the already configured matching key, using password environment references only. SHA256 `F4211FCEFB5A80E57C626117DDFFBF5B54131235B97842277B31C44042C27D13`; certificate match and zipalign 16KiB verification pass. Manifest is 4.1.10/code91, DEBUGGABLE, ARM64-only. `adb -s 45218ba install -r` returned Success and installed package metadata was rechecked. No uninstall or data clear occurred.
- Device launch reached VShop MainActivity, but the old Metro PID 1912 accepted TCP without answering even the host-local `/status` check. Graceful shutdown did not respond; the exact workspace/Expo command line was verified before stopping only that task-owned PID. A new offline-start Metro session is being prepared; phone runtime behavior is not yet verified on this installation.

## Re-running the isolated native interaction test

1. Use the user-selected physical phone `45218ba`, awake and unlocked. Start the development client/Metro and wait for the project to open, reverse port 8081 to that exact serial, then open the physically verified warm link `vshop://ui-qa?demo=1`. Require both the Local QA marker and transport-stats node before input. Do not restart emulator testing or log into another account for this test.
2. Use the installed ARTEMIS Python runtime, which already contains UIAutomator2:

   ```powershell
   & C:/Users/kona/Tools/artemis/.venv/Scripts/python.exe -B -X utf8 scripts/verify-android-local-ui.py --serial 45218ba --allow-physical --output C:/Users/kona/AppData/Local/Temp/vshop-local-ui-new-run --adb C:/Users/kona/AppData/Local/Android/Sdk/platform-tools/adb.exe
   ```

3. Inspect exit status and `local-ui-report.json`, not screenshot existence alone. The script fails closed without the local QA marker and evidence node, uses semantic bounds, and records pending/confirmed fields and max concurrent writes. Its 5s transport is synthetic; it cannot establish Riot latency.
4. Keep screenshots/logs outside Git. Normal-mode and Reduce Motion runs are separate evidence; restore Android settings after probing.

## Device-readiness hardening

- A later read confirmed the phone was Dozing with an active lock screen. The
  attempted Agent/Back observations lacked an awake/unlocked check before every
  input, so they remain INCONCLUSIVE, not a confirmed navigation bug. Temporary
  `[VShopBackProbe]` logging was removed; no app navigation behavior was changed.
- Added `scripts/lib/android_ui_guard.py` to all three UI harnesses. Before
  reads, taps and captures it requires awake state, known-unlocked window policy,
  exact VShop focus and resumed activity. It rejects ambiguous/missing metadata,
  stale underlying app activity behind an overlay, and lookalike package names.
  Device readiness failures are reported separately from product failures.
- Ten offline unit tests pass, including a RED→GREEN exact-package-prefix
  regression. Readiness checks deliberately add command overhead, so the guarded
  eight-tab sequence is not labelled proof of sub-300ms interruption.
- The shared guard has 100% statement/branch coverage (26 statements, 8 branches,
  zero missed), measured with the already installed Python coverage tool. An
  earlier stdlib trace invocation discovered zero tests and was not accepted as
  coverage evidence. Coverage data is outside Git at
  `C:/Users/kona/AppData/Local/Temp/vshop-ui-guard-20260930.coverage`.
- The user confirmed unlocking; a fresh preflight then passed. Subsequently the
  physical serial disappeared entirely. ARTEMIS safe ADB restart completed but
  `adb devices -l` still returned no attached devices. No emulator was launched.
  The user has been asked to reconnect the cable/debugging connection. Stop all
  device actions until a fresh ready/focus check passes again.
- Full post-guard gate exited 0: 159 Jest suites / 2,232 tests, typecheck, lint,
  audit policy and Android export 10.42 MiB total / 7.95 MiB Hermes / 1.25 MiB
  largest asset. Python's 10 guard tests are additional, not included in the
  Jest count. Log: `C:/Users/kona/AppData/Local/Temp/vshop-device-guard-full-check-20260930.log`.
  No temporary Back probe remains and no production navigation fix was made from
  the inconclusive device observations.

## Native page refraction continuation

The user's “Cứ chạy tiếp đi” continued actual page-background refraction, not
the earlier unimplemented icon-strip snapshot proposal. The source, review,
failed-first lifecycle fixes and signed candidate2 are tracked in
[the native refraction plan](2026-09-30-native-lens-refraction.md). Existing
material values and MorphIcon behavior remain unchanged. The local Android
module and 9 JVM tests build; the JS gate passes 161 suites / 2,260 tests and
Android export budget. ADB still has no physical device, so candidate2 has not
been installed, rendered refraction and frame metrics remain NOT VERIFIED, and
this completion plan is not marked finished. No emulator or production release
was used to substitute for the required phone evidence.

Latest physical follow-up supersedes that disconnected checkpoint: candidate2
was same-signer installed successfully when `45218ba` returned. The app rendered
and logged native backdrop command recording. The first navigation harness run
failed at Shop with its edge tap; a guarded center click succeeded. The harness
has been corrected and tested offline. A real Night Market viewport issue was
then fixed with failed-first source tests (move clearance from the outer scene
to scroll content). Latest source gate passes 162 suites / 2,264 tests. Phone
focus moved to Zalo, so inputs stopped pending the user's availability; complete
visual/interaction/frame validation, including active glyph fidelity, is still
open. Details and artifact paths remain in the native-refraction plan.

The user subsequently approved repairing the gray Bundle haze and lost
500ms collapse gesture, then requested stronger outlines and ownership badges
for non-skin Bundle items. These changes are implemented and tracked in
[the regression repair plan](2026-09-30-glass-regression-repair.md). Final normal
physical checks confirm white outlined Bundles, real owned card/spray/Buddy
checks, unowned items unmarked, and collapse/expand plus five-tab navigation.
The final Reduced Motion device attempt timed out before exercising collapse;
its system setting was restored. Production performance and the broader plan's
remaining checks are not declared complete by these scoped results.

Further guarded physical checks verified collapse/expand and each primary tab
under Reduce Motion across separate runs, with system scale restored1.0. The
uninterrupted full reduced run remains marked blocked at its foreground check;
no continuous timing/performance claim is made. All4 actual Profile selectors
also passed again. Physical isolated loadout QA remains pending because its
explicit marker was not reached; no real-account mutation was substituted.

That QA setup checkpoint is now superseded: with the project open, the warm
`vshop://ui-qa?demo=1` link reached both required markers. The physical isolated
fixture passed all4 checks in normal and reduced modes. The earlier triple-slash
attempt and its different runtime state do not isolate a URI parser defect.
See the regression repair plan for exact reports, timing, restored settings and
remaining broad visual/accessibility/performance gates.
