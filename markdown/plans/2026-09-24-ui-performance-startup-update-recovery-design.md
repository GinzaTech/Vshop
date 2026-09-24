# UI Performance and Startup Update Recovery Design

**Date:** 2026-09-24  
**Status:** Proposed — awaiting user review  
**Workspace:** `C:\Users\kona\Desktop\Project\Vshop`  
**Target:** Android production runtime first; preserve iOS/web boundaries  
**Build policy:** native Android build runs locally because EAS Android quota is exhausted

## 1. Intent

VShop must feel consistently responsive across its primary navigation, with
special attention to the observable stall when entering Profile from another
tab. A user who cannot reach the authenticated UI because bootstrap, rendering,
or a stale JavaScript bundle fails must still be able to check for and apply a
compatible update from the loading or error surface.

This work has two inseparable outcomes:

1. Reduce navigation and Profile interaction jank using measured native/device
   evidence rather than shorter animation durations alone.
2. Add a route-independent update recovery path that remains usable before
   Settings, Profile, or authenticated data has loaded.

## 2. Current evidence

Production `4.1.9 (90)` with OTA group
`5ba85a7f-a273-45a0-8ccc-90c13c1fc97a` was measured on Android device
`45218ba` after startup reached steady state.

| Warm transition | Janky frames | P95 | P99 |
|---|---:|---:|---:|
| Bundles → Profile | 6.52% | 121 ms | 150 ms |
| Shop → Profile | 6.82% | 101 ms | 125 ms |
| Night Market → Profile | 8.89% | 69 ms | 125 ms |
| Settings → Profile | 7.27% | 22 ms | 27 ms |
| Bundles → Profile, repeat | 8.70% | 113 ms | 150 ms |

The dominant symptom is a small number of very long frames during Profile
entry. Most frames remain near 20–21 ms; therefore the design must remove
native attach/layout/draw spikes instead of merely hiding them behind a shorter
transition.

Current architecture contributing to the spike:

```text
tab press
  -> BottomTab navigator shift transition
  -> detached Profile native screen is attached
  -> PrimaryTabScene focus/accessibility state changes
  -> Profile hero + three pager pages + hidden player dashboard attach/layout
  -> Profile focus effect publishes system chrome state
```

`navigation.preload()` warms the React/module side but
`detachInactiveScreens` still removes inactive native screens. Profile also
pre-mounts a hidden dashboard after an idle callback, increasing the native
tree that must be attached on return.

## 3. Non-goals

- Do not redesign the visual language, colors, typography, or Profile data
  hierarchy.
- Do not replace Reanimated, Expo Router, React Navigation, Skia, Zustand, or
  Morphicons.
- Do not perform live purchases, queue actions, agent locks, party mutations,
  loadout mutations, or chat sends during smoke tests.
- Do not lower Android export budgets or weaken lint/test/security gates.
- Do not call a debug-signed Gradle APK a production release.
- Do not publish an OTA until source gates and device-safe review are complete.

## 4. Selected performance architecture

### 4.1 Primary scene retention

On Android, the five primary routes remain mounted and attached after their
first preload. This removes native attach cost from warm navigation. iOS keeps
its existing behavior unless measurement proves the same change is beneficial.

Primary routes:

```text
bundles
shop
profile
night_market
settings
```

Secondary routes remain lifecycle-bounded. The implementation must not retain
every secondary screen indefinitely merely to optimize the primary five. If the
existing single navigator cannot express that boundary safely, primary routes
move into a focused nested navigator while secondary routes stay in the outer
stack/tab surface.

The first implementation may use Android primary-scene retention in the
existing navigator only if device memory evidence shows no unbounded retention
after visiting secondary screens. Otherwise the nested boundary is mandatory.

### 4.2 Transition behavior

- Preserve spatial continuity with the existing 220 ms, maximum 32 dp shift.
- Keep animation work on the UI thread.
- Animate only transform, opacity, and approved colors.
- Never animate width, height, top, left, margin, or padding each frame.
- A route confirmation must not restart an indicator animation begun on press.
- Rapid tab presses replace the pending target; semantic route state never
  waits for animation completion.
- Reduce Motion disables scene and icon morph animation while preserving final
  state and navigation correctness.

### 4.3 Floating tab active icon

The active indicator icon must represent the pending destination immediately,
then reconcile with confirmed navigation state. It must not remain visually
stuck on the previous Profile icon after the indicator moves to another tab.

The state machine is:

```text
confirmed route icon
  -> user presses destination
  -> pending indicator icon + indicator motion
  -> navigation confirms destination
  -> pending state clears, confirmed icon remains
  -> prevented/cancelled navigation restores confirmed icon
```

Only the compact indicator shell may re-render on this state change; scenes and
tab buttons must not re-render solely to update the active icon.

### 4.4 Profile render scheduling

Profile is divided into three workload classes:

1. **Immediate shell:** header, compact hero, current equipment tab shell,
   floating navigation relationship.
2. **Focused idle work:** hidden player dashboard, charts, season panels, and
   non-visible Profile tab data.
3. **On-demand work:** picker contents, export sheet, expensive collection
   lists, and player dashboard if the user requests it before idle preload.

Rules:

- No focused-idle mount may begin during a navigator transition.
- Entering Profile renders the immediate shell first.
- Dashboard preload begins only after Profile transition completion and an idle
  slot; it is cancelled on blur.
- If the user requests player-data mode before preload finishes, mount the
  dashboard immediately, wait one animation frame for layout, then begin the
  existing coordinated morph.
- Hidden dashboard and equipment layers preserve state but do not run repeated
  animation or fetch work.
- Profile fetch effects use account/session keys rather than broad user object
  identity.
- Offscreen Profile updates must not repaint the tab scene unless visible data
  actually changed.

### 4.5 System chrome updates

`useSystemChromeStore` setters become equality-aware. Publishing the currently
active tone is a no-op and must not notify subscribers or rerender the root.

Profile focus continues to own its required top-inset/navigation tones, but
entering equipment mode when the default tone is already active must not create
an additional root render during navigation.

### 4.6 Lists, images, and charts

- Preserve FlatList virtualization; do not replace lists with ScrollView maps.
- Set stable keys, dimensions, and cache keys for network images.
- Pause expensive hidden chart/list work.
- Do not add memoization without a measured render or identity problem.
- Existing Skia charts remain native/GPU-backed; do not move chart geometry to
  synchronous render paths.

## 5. Update recovery architecture

### 5.1 Boundary

Update recovery must not depend on:

- authenticated navigation;
- Riot tokens/session restoration;
- Profile or Settings rendering;
- Zustand account data;
- React Native Paper Portal;
- a successful data sync.

It may depend only on React Native primitives, Expo application metadata,
`expo-updates`, safe external linking, localization, and shared design tokens.

### 5.2 Recovery service

A dedicated update recovery service exposes a typed state machine:

```ts
type RecoveryUpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "downloading" }
  | { kind: "restarting" }
  | { kind: "up-to-date" }
  | { kind: "native-update"; releaseUrl: string }
  | { kind: "error"; message: string };
```

The recovery check prioritizes OTA availability directly through
`expo-updates`. A GitHub release lookup is fallback metadata for native updates,
not a prerequisite for checking a recovery OTA.

OTA flow:

```text
checkForUpdateAsync
  -> unavailable: show up-to-date/native-release result
  -> available: fetchUpdateAsync
  -> isNew: transition to restarting, reloadAsync
  -> not new/error: remain on recovery UI with safe next action
```

All failures return safe messages without tokens, URLs containing credentials,
or raw upstream payloads.

### 5.3 Loading/bootstrap recovery

The root loading surface receives an independent watchdog. Recovery controls
appear when either condition is true:

- bootstrap reports maintenance/unavailable; or
- the user has remained on the loading overlay for 8 seconds.

Available actions:

- Retry startup.
- Use the latest complete same-account cache, when valid.
- Check for app update.
- Open the native release page when a newer native version is required.

The update action remains visible even when there is no usable Riot cache.
Checking/downloading/restarting states disable duplicate presses and announce
progress through an accessibility live region.

### 5.4 ErrorBoundary recovery

The full-screen ErrorBoundary fallback includes the same update recovery
control using plain React Native views. The fallback supports:

- Try rendering again.
- Check/apply update.
- Open native release when required.
- Return to the bootstrap route only when navigation is usable.

The update action must work when the authenticated tree, Profile, Settings, or
Paper Portal failed to render.

### 5.5 Loop prevention

Persist the last update ID that failed during startup recovery, along with a
bounded failure count. The app must not repeatedly fetch/reload the same failed
update in one recovery cycle.

- Manual retry remains possible.
- A different update ID clears the prior failure guard.
- Successful startup clears stale failure metadata.
- Update failure never deletes valid session/cache data.

## 6. Accessibility and interaction requirements

- Every recovery action has `accessibilityRole="button"` and a localized label.
- Status changes use `accessibilityLiveRegion="polite"`; terminal errors use an
  alert-compatible announcement.
- Touch targets are at least 44 dp.
- Loading skeleton pulse and all repeated decoration stop under Reduce Motion.
- Recovery layout reserves space so buttons appearing do not create abrupt
  content jumps.
- Navigation, tab order, and Android back behavior remain predictable.

## 7. TDD and test ownership

### 7.1 Navigation/performance contracts

Tests must pin:

- Android primary scene retention policy.
- Secondary lifecycle/memory boundary.
- transition options and Reduce Motion behavior;
- pending active-icon state and cancelled navigation rollback;
- preload pause during transition and resume after transition end;
- Profile dashboard work never starts during navigation;
- system chrome setters do not publish identical values.

### 7.2 Recovery update contracts

Tests must cover:

- OTA available, unavailable, download success, download returns `isNew=false`,
  check failure, download failure, reload failure;
- development/Expo Go/web disabled behavior;
- native release fallback;
- watchdog hidden before 8 seconds and visible after 8 seconds;
- loading surface update action with and without cache;
- ErrorBoundary update action without navigator/Portal dependencies;
- duplicate press suppression;
- failed-update loop guard and success cleanup.

### 7.3 Coverage

New recovery service/controller/helper modules require at least 80% branch,
function, line, and statement coverage. Existing remediated-domain thresholds
must not decrease.

## 8. Device measurement protocol

All performance claims use a production or release-equivalent build on device
`45218ba`. Cold-start/reload frames are excluded from warm navigation metrics.

1. Launch and wait until Profile/data sync is stable.
2. Visit each primary route once to warm image/module caches.
3. Reset `dumpsys gfxinfo com.android.vshop` immediately before each target
   interaction.
4. Measure all 20 directed transitions among the five primary tabs.
5. Measure at least five warm transitions from each other tab into Profile.
6. Measure Profile equipment ↔ player data and Overview ↔ Details in both
   directions.
7. Record process PSS/RSS before and after ten full navigation cycles.
8. Filter logcat by package PID for JS errors, FATAL, ANR, and SIGSEGV.
9. Repeat with Android Reduce Motion enabled.

## 9. Acceptance criteria

### Performance

- Median Profile-entry janky frames: at most 5%.
- Profile-entry P95: at most 32 ms.
- No repeated 100–150 ms warm-entry frames.
- No blank frame, double-content frame, or stale active-tab icon.
- Primary navigation state remains correct under rapid presses.
- Memory stabilizes after repeated cycles; no monotonic growth caused by retained
  scenes.

### Recovery

- A loading screen stuck for 8 seconds exposes update recovery.
- Bootstrap maintenance/unavailable exposes update recovery immediately.
- ErrorBoundary exposes update recovery without authenticated navigation.
- Compatible OTA can be checked, downloaded, and reloaded.
- Native-update fallback opens only the trusted release URL.
- Same failed update cannot auto-loop reloads.
- Retry/cache behavior remains available and no valid cache/session is deleted.

### Quality gates

- `pnpm run check` passes.
- Android export remains at or below 12 MiB total and 8 MiB Hermes.
- `git diff --check` and secret scan pass.
- Independent code review reports no Critical/High/Medium findings.
- README, CHANGELOG, architecture docs, and implementation evidence are updated.

## 10. Local native build and release policy

Because EAS Android quota is exhausted, final Android validation uses a local
native build.

Required procedure:

1. Generate/update native Android files from `app.json` and Expo plugins.
2. Resolve release signing from an existing authorized release keystore or an
   explicitly downloaded project credential.
3. Never commit keystore, passwords, `gradle.properties` secrets, APKs, build
   directories, or credential exports.
4. Build the release variant locally with Gradle and the same production
   environment/Metro optimization flags.
5. Inspect APK manifest, package, version, signature, SHA-256, and 16 KiB native
   alignment where applicable.
6. Install with pinned ADB serial `45218ba` and repeat the device protocol.

If release credentials are unavailable, a local debug/development APK may be
used only for diagnostics and must be labeled non-production. Completion of
source work does not authorize presenting that diagnostic APK as the final
production artifact.

## 11. Rollback strategy

- Navigation changes remain isolated behind primary-tab configuration and can
  revert without changing domain data.
- Recovery UI calls typed update service boundaries; disabling the new UI does
  not change normal Expo Updates behavior.
- No storage schema migration is required except the bounded failed-update
  marker, which must tolerate missing/invalid data and can be safely removed.
- If retained scenes exceed the memory budget, revert retention and proceed to
  the nested primary navigator alternative rather than weakening performance
  acceptance criteria.

## 12. Open verification items

- Exact release-keystore availability on the local host will be checked during
  implementation planning; no credential content will be printed.
- The memory ceiling will be established from the current production baseline
  before scene-retention code is committed.
- iOS behavior remains source-tested unless an iOS runtime becomes available.
