# VShop startup redesign — 2026-10-03

## Accepted result

The user selected a **new icon + minimal loading status + actual-stage progress
interface**, superseding the earlier icon-only simplification. The shipped
source composition uses an original sculpted graphite/white cart mark, VShop
name, localized status and a thin progress rail on existing design tokens.
Preparation, session validation and core synchronization drive completed stages;
no timer invents a percentage. Optional/skipped work can lead directly to ready.

Entrance, stage changes and overlay exit use transform/opacity with shared motion
tokens and live Reduce Motion. There is no minimum dwell or repeated decoration.
Long startup retains status/progress alongside recovery actions. Real errors keep
retry, complete cached data and the existing update control. The DEV preview uses
the same update presentation with local callbacks; it cannot apply a real update.

Native release must succeed before removing the bootstrap gate/recording the
handoff metric. Native hide has a bounded three-attempt budget, in-flight
deduplication, lifetime cleanup, manual Retry and foreground recovery. Live
policy-approved mobile handoff targets do not reuse an early `/` snapshot.
Custom navigation headers render as React elements so their hooks remain in
their own component when the native stack hides/shows the header.

## Evidence ledger

Evidence directory: `C:/Users/kona/.codex/artifacts/vshop-startup-20261003`.

| Area | Evidence / outcome |
|---|---|
| Final typecheck and lint | `final-handoff-check.log`: passed; lint retains `--max-warnings=0`. |
| Final complete test run | Same log: **179 suites / 2487 tests passed**, 122.582s. No assertions or timeout limits weakened. |
| Integrated command | **FAIL** at production audit `braces` advisory1240992. Earlier attempts/mocks/timeouts remain in separate logs, not rewritten as successful. |
| Final Android export | `final-android-export.log`: PASS, total9.12/12MiB, Hermes7.82/8MiB, largest asset0.92/1.50MiB; disposable export is removed by the existing runner. |
| New native QA build | `new-design-build-retry.log`: SUCCESS14m17s. The first attempt failed on a locked generated Expo JAR; stopping the owned Gradle daemon and rebuilding resolved it. |
| Installed binary | `com.android.vshop.startupqa`, VShop QA4.2.0/code92, arm64; signer SHA256`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. APK SHA256`00CCE1248643A07C6C10B9E7F08E2EDABB6BCB6DDDB5B51E5AD13581F07DAB97`. |
| Device | Physical45218ba, model23013PC75G, Android15, 1080x2400. Main VShop4.1.10/code91 remains a distinct package; it was not overwritten. |
| Actual new design | `new-startup-final.png`: final typography/mark rendered on device; `new-startup-data.xml`: data stage2/3, localized accessibility value. `new-startup-session.png`: session stage1/3. |
| Recovery | `new-startup-recovery-final.png`: actual recovery render; local check-update reaches exact localized up-to-date status, Retry returns to visible progress. Explicit state waits replaced an initial too-early assertion. No real update was applied. |
| Native picker smoke | `native-final/after-native-results.json`: **5/5 PASS**,10 open/close cycles, background isolation/selected semantics, >=48dp Close, hardware Back, Unicode input/clear. An earlier attempt stopped when the fixture disappeared; it is not counted as pass. |
| Reduce Motion | Source tests cover immediate settle, live preference change, retired completions/unmount. Physical layout remains usable with Android transition animation disabled; original1.0 restored in `finally`. No video/frame proof of every animated property was collected. |
| Independent review | `startup-review.md`, `startup-final-review.md`, `startup-final-pass.md`: findings corrected, duplicate AppState import removed; later final source gates prove compilation. |

The installed QA binary supplies native modules/resources; final JavaScript is
served from the current local Metro source. This is a development-client test,
not an embedded production JavaScript APK. The gear in captures is Expo DEV
tools chrome, not part of the launch interface. Native OS splash fidelity and
native-to-React pixel alignment in a production binary remain **NOT VERIFIED**.
The handoff metric measures the JS interval through route/overlay/native-release
acknowledgement; it is not a process-start or measured first-rendered-frame TTI.
After copying the QA APK, ignored Android output was regenerated with the default
`com.android.vshop` identity (`final-restore-native.log`); the explicit QA flag
remains opt-in. Existing worktree edits were preserved; no commit/push occurred.

## Assets and provenance

Both runtime images are256x256 RGBA PNGs with actual alpha range0..254:

| Asset | Bytes | SHA256 |
|---|---:|---|
| Launch mark | 48,375 | `792F8907A439E02C300E79A5AC1B911676C5DFFB96F765832CB28AA5FCAF54D2` |
| Recovery cart | 35,327 | `2CCA81882460A011D2AF90815F8370A34B73750FECA46EC24CE6746191E95788` |

ImageGen originals and prompts are retained under `assets/generated/concepts`
and `assets/generated/prompts`; only downscaling/PNG encoding was applied before
runtime promotion. Existing launcher identity remains unchanged. The native
splash image change requires a new APK; no release or OTA was published.

## Measured limits

The ten-cycle QA picker sample has458 frames,45 janky(9.83%), p50/90/95/99
12/34/77/93ms, missed Vsync2 and GPU p955ms. PSS is1,182,332→1,151,242KiB.
This demonstrates observed debug behavior with remaining slow frames. It does
not establish 60/120fps, a leak diagnosis or a startup-performance improvement.
The prior30-cycle sample uses a different native package/build and workload;
do not report a percentage improvement between them.

Overall source coverage remains below the requested80% target (the prior stable
run reports73.12% statements,68.25% branches,69.10% functions,73.55% lines).
All-screen runtime, assistive-technology traversal, narrow/large-font layouts,
production frame traces and live network recovery remain explicit audit gaps.

## Security disposition

`braces <=3.0.3` remains affected with no published patched version in the
[official GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
checked2026-10-03. `security-review-braces.md` records confirmed Expo/Metro/Jest/
CLI dependency paths and no application import path found in its bounded source
review. Runtime-bundle absence and universal tooling safety are not proven.
No dependency/audit policy exception was added. Full `pnpm run check` remains
failed and release readiness is not claimed.
