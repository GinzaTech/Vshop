# UI performance report — 2026-10-03

## Current measurement and scope

Fresh physical QA evidence is available for **com.android.vshop.startupqa 4.2.0/code92**, serial 45218ba, with source JS through local Metro as reported by main. [native-final JSON](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-native-results.json) records **5/5 PASS and 10 completed picker open/Back cycles**. The [raw gfxinfo](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/native-final/after-gfxinfo.txt) identifies PID 1356 and the QA package, and agrees with the JSON.

This is a bounded development/fixture diagnostic, not a release or all-screen benchmark. This updater ran no new test/build/export/device action. Final post-typography source tests and corrected physical startup/recovery evidence are now recorded separately; no new cycle-performance rerun after the Text change is invented. Native OS splash fidelity, measured timing/event delivery and production performance remain NOT VERIFIED.

The accepted [startup redesign](../plans/2026-10-03-startup-redesign.md) is icon + minimal status + real phase progress + smooth motion. Physical session 1/3/data 2/3 preview states and [final startup](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-final.png) show the new mark/full title. Preview/source mapping does not prove every live Riot recovery path. See [main startup ledger](STARTUP_REDESIGN_RESULTS.md) for final watchdog/native-release/AppState fixes and bounded recovery evidence.

## Independent recorded scenarios: no baseline delta

The old [code91 snapshot](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-host-before-focus-extraction.json) and [old raw dump](C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/native/after-gfxinfo.txt) are retained separately. The two columns below are observations of different packages/binaries, source states and cycle counts, **not a matched before/after pair**. No improvement percentage is established.

| Metric | Fresh QA-package/code92 scenario | Historical main-package/code91 scenario |
|---|---|---|
| Package / version | com.android.vshop.startupqa, 4.2.0/code92 | com.android.vshop, 4.1.10/code91 |
| JS / scenario | New source via Metro; local fixture/public preview art | Then-current source via Metro; earlier fixture/source |
| Completed cycles | **10** | **30** |
| Native case results | Five PASS | Five PASS in pre-focus-extraction snapshot |
| PID in raw dump | 1356 | 1205 |
| Rendered frames | **458** | 2165 |
| Janky frames | **45 (9.83%)** | 450 (20.79%) |
| Legacy janky frames | 69 (15.07%) | 1773 (81.89%); distinct legacy metric |
| Frame duration p50 | **12 ms** | 13 ms |
| Frame duration p90 | **34 ms** | 31 ms, verified in old raw dump |
| Frame duration p95 | **77 ms** | 65 ms |
| Frame duration p99 | **93 ms** | 89 ms |
| Missed Vsync | **2** | 245 |
| Slow UI thread count | 40 | 450 |
| Slow bitmap uploads | 0 | 2 |
| Slow issue draw commands | 0 | 155 |
| Frame deadline missed | 45 | 450 |
| GPU p50 / p90 / p95 / p99 | **4 / 5 / 5 / 8 ms** | 4 / 5 / 7 / 9 ms |
| Process PSS endpoints | **1,182,332 → 1,151,242 KiB** | 1,196,828 → 1,284,339 KiB |
| PSS difference within that run only | -31,090 KiB | +87,511 KiB |
| Pixel latency | NOT MEASURED | NOT MEASURED |
| Cold-start-to-usable-screen / JS-UI FPS | NOT MEASURED by this cycle run | NOT MEASURED by this cycle run |

Both PSS differences are endpoint subtraction inside the corresponding process run, not a memory improvement comparison. A decrease in the fresh run does not prove a leak was fixed; the old increase does not by itself establish a leak. There is no retained matched heap/native allocation or post-idle recovery series.

The fresh high-input-latency counter is 505 (old 3317). These Android counters are not counts of failed user taps and cannot be divided by frame totals to infer touch latency. Frame/GPU percentiles are Android aggregates over the recorded flow; hierarchy waits introduce pacing and are not pixel timing measurements.

## Interpretation and residual performance risk

The fresh **9.83% janky-frame fraction with p95/p99 77/93 ms** leaves a smoothness risk in this development scenario, despite functional N01–N05 passing. GPU p95 of 5 ms does not attribute frame tails to JS, UI work, image decode, blur or shaders. No synchronized trace or release-build comparison exists.

The fresh sample set is 10 cycles. The earlier plan's 30-cycle stress target remains **NOT RUN on the new QA scenario**; the old package's 30 cycles cannot fill that gap. Longer session/large-list/primary-tab/real Profile/landscape behavior and sustained memory plateau remain unverified.

The initial old baseline failed with an offline device; first/second old attempts failed accessibility isolation, and later old/initial startupqa attempts were interrupted or blocked. Those attempts are history, not a valid performance baseline. The fresh native-final result supersedes interrupted startupqa evidence for this bounded fixture path only.

## Final startup rendering evidence

Earlier phase captures exposed title clipping; [new-startup-final.png](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-final.png) now shows full VShop. [new-startup-recovery-final.png](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-startup-recovery-final.png) and main's explicit-wait checks verify localized local update status and Retry-to-progress. These are bounded preview/local callback checks, not a real update or all-network recovery test. Final post-fix source tests pass.

Progress is mapped to actual bootstrap phases rather than elapsed time/network percentage. Physical preview-state rendering and source mapping are separate from live network proof. Main records usable layout at Android transition animation scale 0, with original 1.0 restored; source live Reduce Motion branches pass. No timing/event/video proof of every animated property is collected. Native OS splash/release fidelity remains NOT VERIFIED.

## Source, artifact and export status

- Final post-typography [source log](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/final-handoff-check.log): typecheck/lint and **179/179 suites, 2487/2487 tests PASS in 122.582s**, then audit FAIL. Overall check remains FAIL. All-files coverage 73.12/68.25/69.1/73.55% is below 80%. Earlier stable-source log remains historical.
- Redesign [native build](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/new-design-build-retry.log): successful in 14m 17s. The retained [APK](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/vshop-startup-redesign-qa-4.2.0-92.apk) SHA256 is **00CCE1248643A07C6C10B9E7F08E2EDABB6BCB6DDDB5B51E5AD13581F07DAB97**. Installation is main-reported; runner records package/version and JS via Metro. A native artifact hash alone does not identify final served JS or later Text edits.
- [Final Android export](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/final-android-export.log) **PASS**, completion supplied by main and exported output observed: total **9.12/12 MiB**, JS/Hermes **7.82/8 MiB**, largest asset **0.92/1.50 MiB**. Export/budget success does not establish device or release-performance acceptance.
- [Security review](C:/Users/kona/.codex/artifacts/vshop-startup-20261003/security-review-braces.md) adds reachability context, not remediation. Security audit remains FAIL.

## Remaining performance acceptance

| Required evidence | Current state |
|---|---|
| Matched release before/after scenario | NOT RUN; no improvement percentage claim. |
| Native OS splash fidelity / release handoff | NOT VERIFIED. |
| Post-Text source and physical typography/local recovery | COMPLETE for bounded scope: final type/lint/Jest and physical full title/local recovery checks verified; all-network recovery remains unverified. |
| Real Riot bootstrap/offline/session-renewal/retry branches | Source mapping observed; all-network runtime recovery NOT VERIFIED. |
| Reduce Motion and interrupted navigation | Source live branches PASS; physical layout usable with transition scale 0/restored 1.0. Timing/event/video proof and full navigation interruption acceptance NOT VERIFIED. |
| New QA 30-cycle stress run and sustained memory recovery | NOT RUN; 10-cycle functional pass does not substitute. |
| Large font/narrow/tablet, tabs/scroll/landscape and full 26-route coverage | Broad device/performance gaps remain unchanged. |

See [UI_TEST_RESULTS](UI_TEST_RESULTS.md) for case-level evidence and [UI_FINAL_REVIEW](UI_FINAL_REVIEW.md) for bounded acceptance. Fresh fixture passes and debug metrics do not establish total UI validation or a release guarantee.
