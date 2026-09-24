# UI Performance and Startup Update Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove warm Profile-entry attach stalls, validate smoothness across the complete primary-tab matrix, and provide an update/recovery path on loading and ErrorBoundary surfaces before authenticated navigation is usable.

**Architecture:** Keep Android primary scenes warm, stage Profile-only heavy work outside navigator transitions, and make system-chrome writes idempotent. Add a route-independent recovery-update core plus a small shared recovery control consumed by LoadingScreen and ErrorBoundary. Build Android `4.1.10 (91)` locally with the authorized production signer through an Expo config plugin; fail closed when release credentials are unavailable.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, Expo Router/React Navigation bottom tabs, Reanimated 4.5.1, Zustand 5, expo-updates, AsyncStorage, Jest, pnpm, Android Gradle, ADB.

**Spec:** `markdown/plans/2026-09-24-ui-performance-startup-update-recovery-design.md`

**Execution status (2026-09-24):** Tasks 1–5 source/TDD complete. Task 6
measurement harness and baseline complete; final matrix waits for the new APK.
Task 7 source, metadata, production signer, local Gradle build, signature and
16 KiB alignment complete; device install waits for ADB serial `45218ba` to
reconnect. Task 8 source gate passes 91 suites / 956 tests and export budgets
10.18/12 MiB total, 7.71/8 MiB Hermes, 1.25/1.50 MiB largest asset; final
device evidence and whole-branch review remain open.

## Global Constraints

- Use `pnpm`; keep TypeScript strict and do not add `any`.
- Follow `route -> component/store -> service/helper`; no transport or update logic duplicated in screens.
- Motion uses `constants/Motion.ts`, runs on the UI thread, and respects `ReduceMotion.System`.
- Animate transform/opacity/approved colors only during navigation; no frame-by-frame layout properties.
- New recovery code must preserve valid session/cache data on every failure.
- Never execute live purchase, queue, party, agent-lock, chat, or loadout mutations during validation.
- New recovery modules require at least 80% branch/function/line/statement coverage.
- Android export remains at most 12 MiB total and 8 MiB Hermes; do not change thresholds.
- Native release metadata becomes app/package `4.1.10`, Android `versionCode 91`, iOS `buildNumber 43`.
- A local APK is production only when its signer certificate matches the existing authorized VShop production APK. Never release the generated debug-signed Gradle variant.
- Keystore, credentials JSON, passwords, APKs, native build outputs, screenshots, and device logs stay ignored and uncommitted.
- Do not publish OTA, create a GitHub release, upload an APK, or push until the user explicitly requests that external action for this change.

## Review Focus

1. **Rapid tab presses:** the active indicator must show the latest accepted destination and roll back when navigation is prevented — pinned in Task 2 tests.
2. **Retained-scene memory:** Android warm scenes must plateau after repeated navigation and secondary screens must not create monotonic growth — pinned in Task 1 policy tests and Task 6 device evidence.
3. **Profile cold dashboard:** an immediate player-data request must mount one frame before morphing without racing focus cleanup — pinned in Task 3 tests.
4. **Broken update loop:** the same update ID must not repeatedly download/reload after failed startup — pinned in Task 4 tests.
5. **Recovery without app tree:** LoadingScreen and ErrorBoundary update actions must work without Profile, Settings, Paper Portal, or Riot state — pinned in Task 5 component tests.

---

### Task 1: Retain Android primary scenes without weakening secondary lifecycle

**Files:**
- Modify: `utils/primary-tab-motion.ts`
- Modify: `app/(authenticated)/_layout.tsx`
- Modify: `__tests__/authenticated-navigation.test.tsx`
- Modify: `__tests__/primary-tab-preload.test.tsx`

**Interfaces:**
- Produces `getPrimaryTabNavigatorPolicy(platform: string)` with `detachInactiveScreens` and primary/secondary freeze policy.
- Keeps `createPrimaryTabScreenOptions(viewportWidth)` and `PRIMARY_TAB_REDUCED_MOTION_OPTIONS` stable for Task 2.
- Task 3 relies on `transitionStart`/`transitionEnd` continuing to pause idle work.

- [ ] **Step 1: Write the RED Android retention tests**

Extend the authenticated navigation harness so `MockTabs` captures navigator
props, then add:

```tsx
it("keeps Android primary scenes attached after preload", () => {
  expect(getPrimaryTabNavigatorPolicy("android")).toEqual({
    detachInactiveScreens: false,
    secondaryFreezeOnBlur: true,
  });
});

it("keeps non-Android detachment unchanged", () => {
  expect(getPrimaryTabNavigatorPolicy("ios").detachInactiveScreens).toBe(true);
});

it("passes the Android retention policy to Tabs", () => {
  act(() => { renderer = TestRenderer.create(<AuthenticatedLayout />); });
  expect(latestTabsProps.detachInactiveScreens).toBe(false);
});
```

Extend preload coverage so a transition target cancels an idle mount and only
resumes after its matching `transitionEnd`.

- [ ] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/authenticated-navigation.test.tsx __tests__/primary-tab-preload.test.tsx --runInBand
```

Expected: FAIL because the navigator policy helper does not exist and Android
still passes `detachInactiveScreens=true`.

- [ ] **Step 3: Implement the platform policy**

Add to `utils/primary-tab-motion.ts`:

```ts
export function getPrimaryTabNavigatorPolicy(platform: string) {
  return {
    detachInactiveScreens: platform !== "android",
    secondaryFreezeOnBlur: platform === "android",
  } as const;
}
```

In authenticated layout:

```tsx
const navigatorPolicy = getPrimaryTabNavigatorPolicy(Platform.OS);

<Tabs
  detachInactiveScreens={navigatorPolicy.detachInactiveScreens}
  // existing props remain unchanged
/>
```

Keep all five primary screens on `freezeOnBlur: false`. Apply
`freezeOnBlur: navigatorPolicy.secondaryFreezeOnBlur` to secondary screens so
visited secondary trees stop render work while inactive. Do not change route
names, hrefs, deep links, or back behavior.

- [ ] **Step 4: Run GREEN and scoped lint**

```powershell
pnpm exec jest __tests__/authenticated-navigation.test.tsx __tests__/primary-tab-preload.test.tsx --runInBand
pnpm exec eslint 'app/(authenticated)/_layout.tsx' utils/primary-tab-motion.ts __tests__/authenticated-navigation.test.tsx __tests__/primary-tab-preload.test.tsx --max-warnings=0
pnpm run typecheck
```

- [ ] **Step 5: Review and commit**

Review focus: Android policy is explicit, iOS unchanged, primary screens are
not frozen, transition listeners still clean up.

```powershell
git add 'app/(authenticated)/_layout.tsx' utils/primary-tab-motion.ts __tests__/authenticated-navigation.test.tsx __tests__/primary-tab-preload.test.tsx
git commit -m "perf: retain warm Android primary scenes"
```

---

### Task 2: Make floating-tab indicator state immediate and cancellable

**Files:**
- Modify: `app/(authenticated)/_layout.tsx`
- Modify: `__tests__/authenticated-navigation.test.tsx`

**Interfaces:**
- Consumes `PRIMARY_ROUTES` and the existing single mounted active `AppIcon`.
- Produces pending indicator route state that clears on route confirmation or prevented navigation.

- [ ] **Step 1: Write RED pending-icon tests**

```tsx
it("shows the accepted destination icon immediately on press", () => {
  const { renderer } = renderTabBar();
  act(() => getTab(renderer, "bundles").props.onPress());
  expect(renderer.root.findByProps({
    testID: "primary-tab-active-icon",
  }).props.name).toBe("navStore");
});

it("rolls back a prevented navigation", () => {
  const { navigation, renderer } = renderTabBar({ prevented: true });
  act(() => getTab(renderer, "bundles").props.onPress());
  expect(renderer.root.findByProps({
    testID: "primary-tab-active-icon",
  }).props.name).toBe("navProfile");
  expect(navigation.navigate).not.toHaveBeenCalled();
});

it("replaces an in-flight destination with the latest accepted press", () => {
  const { renderer } = renderTabBar();
  act(() => {
    getTab(renderer, "shop").props.onPress();
    getTab(renderer, "settings").props.onPress();
  });
  expect(renderer.root.findByProps({
    testID: "primary-tab-active-icon",
  }).props.name).toBe("navMore");
});
```

- [ ] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/authenticated-navigation.test.tsx --runInBand
```

Expected: active icon remains the confirmed Profile icon until navigator state
updates.

- [ ] **Step 3: Implement the indicator state machine**

Inside `FloatingTabBar`:

```tsx
const [pendingIndicatorRoute, setPendingIndicatorRoute] = useState<string | null>(null);
const indicatorRouteName =
  pendingIndicatorRoute && pendingIndicatorRoute in PRIMARY_ROUTES
    ? pendingIndicatorRoute
    : activeRoute.name;

useEffect(() => {
  setPendingIndicatorRoute(null);
  pendingTabNameRef.current = null;
}, [activeRoute.key]);
```

On accepted press, set the pending route before navigation. On prevented press,
clear it. Render the existing mounted icon with:

```tsx
<AppIcon
  name={PRIMARY_ROUTES[indicatorRouteName].icon}
  testID="primary-tab-active-icon"
  // existing size/color/decorative props
/>
```

Do not add a `key`; one mounted MorphIcon must own interruption continuity.

- [ ] **Step 4: Run GREEN**

```powershell
pnpm exec jest __tests__/authenticated-navigation.test.tsx __tests__/stateful-icon-pairs.test.tsx --runInBand
pnpm exec eslint 'app/(authenticated)/_layout.tsx' __tests__/authenticated-navigation.test.tsx --max-warnings=0
```

- [ ] **Step 5: Review and commit**

```powershell
git add 'app/(authenticated)/_layout.tsx' __tests__/authenticated-navigation.test.tsx
git commit -m "fix: synchronize floating tab indicator state"
```

---

### Task 3: Stage Profile dashboard work after navigation and remove redundant chrome renders

**Files:**
- Modify: `features/profile/useProfileMotion.ts`
- Modify: `hooks/useSystemChromeStore.ts`
- Modify: `__tests__/profile-motion-cold-transition.test.tsx`
- Modify: `__tests__/system-chrome-store.test.ts`

**Interfaces:**
- Produces focus-scoped dashboard preload with cancellable timeout and idle task.
- Preserves `toggleHeroMode()` cold-mount-one-frame-before-morph behavior.
- System chrome setter signatures remain unchanged.

- [ ] **Step 1: Write RED focus scheduling tests**

Capture the callback passed to `useFocusEffect` and add:

```tsx
it("does not mount the hidden dashboard before Profile is focused and settled", () => {
  expect(motion.statsDashboardMounted).toBe(false);
  act(() => focusCallback?.());
  expect(motion.statsDashboardMounted).toBe(false);
  act(() => jest.advanceTimersByTime(219));
  expect(idleCallbacks).toHaveLength(0);
  act(() => jest.advanceTimersByTime(1));
  expect(idleCallbacks).toHaveLength(1);
});

it("cancels queued dashboard work on blur", () => {
  const cleanup = focusCallback?.();
  act(() => cleanup?.());
  act(() => jest.runAllTimers());
  expect(motion.statsDashboardMounted).toBe(false);
});

it("still mounts an immediate cold request one frame before morphing", () => {
  act(() => motion.toggleHeroMode());
  expect(motion.statsDashboardMounted).toBe(true);
  expect(animationFrames).toHaveLength(1);
});
```

Add an idempotence test:

```ts
it("does not notify subscribers for identical chrome tones", () => {
  const listener = jest.fn();
  const unsubscribe = useSystemChromeStore.subscribe(listener);
  useSystemChromeStore.getState().setTopInsetTone("light");
  useSystemChromeStore.getState().setPrimaryNavigationTone("dark");
  expect(listener).not.toHaveBeenCalled();
  unsubscribe();
});
```

- [ ] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/profile-motion-cold-transition.test.tsx __tests__/system-chrome-store.test.ts --runInBand
```

- [ ] **Step 3: Implement focus-settled dashboard scheduling**

Remove the unconditional mount-time idle effect. In the existing Profile
`useFocusEffect`, schedule dashboard warmup after the tab duration:

```ts
let preloadTimer: ReturnType<typeof setTimeout> | null = null;
let preloadTask: IdleTask | null = null;

if (!statsDashboardMounted) {
  preloadTimer = setTimeout(() => {
    preloadTask = runWhenIdle(() => {
      dashboardPreloadTaskRef.current = null;
      setStatsDashboardMounted(true);
    });
    dashboardPreloadTaskRef.current = preloadTask;
  }, reduceMotionEnabled ? 0 : MOTION_DURATION.standard);
}

return () => {
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTask?.cancel();
  dashboardPreloadTaskRef.current?.cancel();
  dashboardPreloadTaskRef.current = null;
  if (!isPlayerInfoModeRef.current) setStatsDashboardMounted(false);
  // existing chrome cleanup
};
```

Keep immediate `toggleHeroMode()` behavior and the next-frame cold morph. Add
all real hook dependencies; do not read a shared value on the JS thread.

Make Zustand setters equality-aware:

```ts
setTopInsetTone: (tone) =>
  set((state) => state.topInsetTone === tone ? state : { topInsetTone: tone }),
setPrimaryNavigationTone: (tone) =>
  set((state) =>
    state.primaryNavigationTone === tone
      ? state
      : { primaryNavigationTone: tone },
  ),
```

Apply the same pattern to the accessibility-hidden setter.

- [ ] **Step 4: Run GREEN and Profile regression suites**

```powershell
pnpm exec jest __tests__/profile-motion-cold-transition.test.tsx __tests__/profile-icon-motion.test.tsx __tests__/profile-transition.test.ts __tests__/system-chrome-store.test.ts --runInBand
pnpm exec eslint features/profile/useProfileMotion.ts hooks/useSystemChromeStore.ts __tests__/profile-motion-cold-transition.test.tsx __tests__/system-chrome-store.test.ts --max-warnings=0
pnpm run typecheck
```

- [ ] **Step 5: Review and commit**

```powershell
git add features/profile/useProfileMotion.ts hooks/useSystemChromeStore.ts __tests__/profile-motion-cold-transition.test.tsx __tests__/system-chrome-store.test.ts
git commit -m "perf: stage Profile work after tab transitions"
```

---

### Task 4: Build the fail-closed recovery update core

**Files:**
- Create: `utils/recovery-update.ts`
- Create: `__tests__/recovery-update.test.ts`
- Modify: `utils/app-update.ts`
- Modify: `utils/startup-performance.ts`

**Interfaces:**
- Produces `RecoveryUpdateState`, `runRecoveryUpdate`, `clearRecoveryUpdateFailure`, and `markRecoveryStartupFailure`.
- Task 5 consumes the public functions only; UI never imports `expo-updates` directly.

- [ ] **Step 1: Write RED update state-machine tests**

Create dependency-injected tests for these exact cases:

```ts
it("checks, downloads and reloads a compatible OTA", async () => {
  const states: RecoveryUpdateState[] = [];
  const result = await runRecoveryUpdate(makeDeps({
    check: { isAvailable: true, manifest: { id: "update-b" } },
    fetch: { isNew: true },
  }), (state) => states.push(state));
  expect(states.map((state) => state.kind)).toEqual([
    "checking", "downloading", "restarting",
  ]);
  expect(result).toEqual({ kind: "restarting" });
});

it("blocks the same failed update after two startup failures", async () => {
  const deps = makeDeps({
    storedAttempt: { updateId: "update-b", failures: 2 },
    check: { isAvailable: true, manifest: { id: "update-b" } },
  });
  await expect(runRecoveryUpdate(deps, jest.fn())).resolves.toMatchObject({
    kind: "error",
  });
  expect(deps.updates.fetchUpdateAsync).not.toHaveBeenCalled();
});

it.each(["check", "fetch", "reload"] as const)(
  "keeps cache and returns a safe error when %s fails",
  async (stage) => {
    const deps = makeDeps({ rejectAt: stage });
    await expect(runRecoveryUpdate(deps, jest.fn())).resolves.toEqual({
      kind: "error",
      message: expect.any(String),
    });
    expect(deps.removeSessionData).not.toHaveBeenCalled();
  },
);
```

Also cover disabled updates, web/development, unavailable OTA, `isNew=false`,
native release fallback, malformed stored attempt JSON, a different update ID,
and successful startup cleanup.

- [ ] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/recovery-update.test.ts --runInBand
```

Expected: module missing.

- [ ] **Step 3: Implement the core**

Use this public contract:

```ts
export type RecoveryUpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "downloading" }
  | { kind: "restarting" }
  | { kind: "up-to-date" }
  | { kind: "native-update"; releaseUrl: string }
  | { kind: "error"; message: string };

export async function runRecoveryUpdate(
  dependencies: RecoveryUpdateDependencies,
  publish: (state: RecoveryUpdateState) => void,
): Promise<RecoveryUpdateState>;

export async function clearRecoveryUpdateFailure(): Promise<void>;
export async function markRecoveryStartupFailure(): Promise<void>;
```

Persist only:

```ts
type RecoveryUpdateAttempt = {
  updateId: string;
  failures: number;
};
```

under `recovery-update-attempt-v1`. Store the update ID before reload, increment
its failure when ErrorBoundary catches startup failure, and clear it only after
`markAppInteractive`. Reuse safe version/release helpers from `app-update.ts`;
export focused helpers instead of duplicating GitHub/version logic.

- [ ] **Step 4: Run GREEN and coverage**

```powershell
pnpm exec jest __tests__/recovery-update.test.ts --runInBand --coverage --collectCoverageFrom=utils/recovery-update.ts
pnpm exec eslint utils/recovery-update.ts utils/app-update.ts utils/startup-performance.ts __tests__/recovery-update.test.ts --max-warnings=0
pnpm run typecheck
```

Required per-file coverage: at least 80% branches/functions/lines/statements.

- [ ] **Step 5: Review and commit**

Review focus: no secret/raw error leakage, no session/cache deletion, update ID
loop guard is bounded, web/dev paths fail closed.

```powershell
git add utils/recovery-update.ts utils/app-update.ts utils/startup-performance.ts __tests__/recovery-update.test.ts
git commit -m "feat: add startup-safe update recovery core"
```

---

### Task 5: Expose update recovery on loading and ErrorBoundary surfaces

**Files:**
- Create: `hooks/useRecoveryUpdate.ts`
- Create: `components/ui/RecoveryUpdateActions.tsx`
- Create: `__tests__/recovery-update-ui.test.tsx`
- Modify: `components/LoadingScreen.tsx`
- Modify: `components/ErrorBoundary.tsx`
- Modify: `app/_layout.tsx`
- Modify: `__tests__/loading-screen.test.tsx`
- Modify: `__tests__/core-accessibility.test.ts`
- Modify: `assets/i18n/en.json`
- Modify: `assets/i18n/vi.json`

**Interfaces:**
- Consumes Task 4 recovery core.
- Produces shared update actions usable without authenticated navigation or Paper Portal.
- Root supplies an 8-second watchdog flag to LoadingScreen.

- [ ] **Step 1: Write RED hook and component tests**

```tsx
it("reveals update recovery only after the startup watchdog", () => {
  jest.useFakeTimers();
  renderRoot();
  expect(findUpdateButton()).toHaveLength(0);
  act(() => jest.advanceTimersByTime(7_999));
  expect(findUpdateButton()).toHaveLength(0);
  act(() => jest.advanceTimersByTime(1));
  expect(findUpdateButton()).toHaveLength(1);
});

it("shows update recovery immediately for maintenance without cache", () => {
  renderLoading({ showRecoveryActions: true, canUseCachedData: false });
  expect(findUpdateButton()).toHaveLength(1);
  expect(findCacheButton()).toHaveLength(0);
});

it("prevents duplicate update presses while checking", () => {
  const run = deferredRecovery();
  const renderer = renderActions({ run });
  act(() => {
    pressUpdate(renderer);
    pressUpdate(renderer);
  });
  expect(run).toHaveBeenCalledTimes(1);
});

it("renders update recovery inside ErrorBoundary without a Portal", () => {
  const renderer = renderThrowingBoundary();
  expect(renderer.root.findByProps({
    testID: "recovery-check-update-button",
  })).toBeDefined();
});
```

Also assert button roles, labels, live regions, disabled/loading state, native
release link, retry after error, and no use of `Dialog`/`Portal`.

- [ ] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/recovery-update-ui.test.tsx __tests__/loading-screen.test.tsx __tests__/core-accessibility.test.ts --runInBand
```

- [ ] **Step 3: Implement the shared hook and primitive**

`useRecoveryUpdate` owns only UI state and duplicate suppression:

```ts
export function useRecoveryUpdate() {
  const [state, setState] = useState<RecoveryUpdateState>({ kind: "idle" });
  const runningRef = useRef(false);
  const checkAndApply = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      setState(await startRecoveryUpdate(setState));
    } finally {
      runningRef.current = false;
    }
  }, []);
  return { state, checkAndApply };
}
```

`RecoveryUpdateActions` uses React Native `View`, `Text`, and `Pressable`,
minimum 44 dp controls, stable reserved status space, `accessibilityLiveRegion`,
and design-system tokens. It receives optional retry/cache callbacks and does
not import router, stores, Riot services, Paper, or Portal.

- [ ] **Step 4: Integrate LoadingScreen, ErrorBoundary, and watchdog**

Extend LoadingScreen props:

```ts
showUpdateRecovery?: boolean;
```

Render the shared actions when either `showRecoveryActions` or
`showUpdateRecovery` is true.

In root layout:

```ts
const [startupWatchdogExpired, setStartupWatchdogExpired] = useState(false);

useEffect(() => {
  if (!isPreloading) {
    setStartupWatchdogExpired(false);
    return;
  }
  const timer = setTimeout(() => setStartupWatchdogExpired(true), 8_000);
  return () => clearTimeout(timer);
}, [isPreloading]);
```

Pass `showUpdateRecovery={startupWatchdogExpired || startupRecovery.visible}`.
ErrorFallback renders the same primitive beneath Retry/Home. Call
`markRecoveryStartupFailure()` from ErrorBoundary catch without awaiting it.

- [ ] **Step 5: Run GREEN and coverage**

```powershell
pnpm exec jest __tests__/recovery-update-ui.test.tsx __tests__/loading-screen.test.tsx __tests__/core-accessibility.test.ts __tests__/root-bootstrap-route.test.ts --runInBand --coverage
pnpm exec eslint app/_layout.tsx components/LoadingScreen.tsx components/ErrorBoundary.tsx components/ui/RecoveryUpdateActions.tsx hooks/useRecoveryUpdate.ts __tests__/recovery-update-ui.test.tsx __tests__/loading-screen.test.tsx --max-warnings=0
pnpm run typecheck
```

- [ ] **Step 6: Review and commit**

```powershell
git add app/_layout.tsx components/LoadingScreen.tsx components/ErrorBoundary.tsx components/ui/RecoveryUpdateActions.tsx hooks/useRecoveryUpdate.ts __tests__/recovery-update-ui.test.tsx __tests__/loading-screen.test.tsx __tests__/core-accessibility.test.ts assets/i18n/en.json assets/i18n/vi.json
git commit -m "feat: expose updates from startup recovery"
```

---

### Task 6: Measure the complete UI matrix and close performance regressions

**Files:**
- Create: `scripts/measure-android-primary-tabs.ps1`
- Create: `markdown/UI_PERFORMANCE_REPORT_4.1.10.md`
- Modify: performance-source files from Tasks 1–3 only when evidence identifies a specific regression
- Test: existing navigation/Profile suites plus device runtime

**Interfaces:**
- Script accepts `-Serial`, `-Package`, `-Runs`, and writes JSON under `.codex-tmp/performance/`.
- Report records raw baseline/final metrics, device/build identity, memory, logcat, and NOT VERIFIED items.

- [ ] **Step 1: Add the pinned measurement script**

The script must:

```powershell
param(
  [Parameter(Mandatory=$true)][string]$Serial,
  [string]$Package = 'com.android.vshop',
  [ValidateRange(1,20)][int]$Runs = 5
)
```

It validates exactly one matching `device` serial, wakes the display without
unlocking secure content, waits for the package PID, resets `gfxinfo` per
interaction, performs only primary-tab/Profile taps, captures totals/jank/P90/
P95/P99 and PSS/RSS, and writes JSON without credentials or account payloads.

- [ ] **Step 2: Run source regression gates before device work**

```powershell
pnpm exec jest __tests__/authenticated-navigation.test.tsx __tests__/primary-tab-preload.test.tsx __tests__/profile-motion-cold-transition.test.tsx __tests__/profile-icon-motion.test.tsx __tests__/system-chrome-store.test.ts --runInBand
pnpm run typecheck
```

- [ ] **Step 3: Measure all primary flows on the current installed production runtime**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/measure-android-primary-tabs.ps1 -Serial 45218ba -Runs 5
```

Record all 20 directed primary transitions, five runs from each other tab into
Profile, Profile equipment/data, Overview/Details, ten navigation cycles of
memory, Reduce Motion on/off, and PID-filtered logcat.

- [ ] **Step 4: Enforce the performance acceptance gate**

The task remains RED unless evidence satisfies all of:

```text
Profile-entry median jank <= 5%
Profile-entry P95 <= 32 ms
no repeated warm frame >= 100 ms
no blank/double scene
no stale active icon
no monotonic memory growth across ten cycles
no JS TypeError/FATAL/ANR/SIGSEGV
```

If a gate fails, use the captured flow to change only the owning Task 1–3
module, add a regression test for that cause, and rerun the identical script.
Do not lower the gate or shorten animation solely to hide an attach/render
spike.

- [ ] **Step 5: Write the evidence report and commit**

```powershell
git add scripts/measure-android-primary-tabs.ps1 markdown/UI_PERFORMANCE_REPORT_4.1.10.md
git commit -m "test: add Android UI performance evidence"
```

---

### Task 7: Version and build a locally signed native production APK

**Files:**
- Create: `plugins/withAndroidReleaseSigning.cjs`
- Create: `scripts/build-android-release-local.mjs`
- Create: `__tests__/android-release-signing.test.ts`
- Modify: `.gitignore`
- Modify: `app.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `BUILD_DESIGN_SYSTEM.md`
- Modify: `DIRECTORY_STRUCTURE.md`
- Modify: `markdown/13-deployment.md`
- Modify: `markdown/14-package.md`
- Modify: `markdown/plans/README.md`

**Interfaces:**
- Config plugin writes release signing that reads environment variables only.
- Build script consumes an ignored credentials JSON and never prints passwords.
- Produces `.codex-tmp/builds/VShop-4.1.10-production-91.apk`.

- [ ] **Step 1: Write RED signing and metadata tests**

```ts
it("bumps the local native release metadata", () => {
  expect(packageJson.version).toBe("4.1.10");
  expect(appJson.expo.version).toBe("4.1.10");
  expect(appJson.expo.android.versionCode).toBe(91);
  expect(appJson.expo.ios.buildNumber).toBe("43");
});

it("generates release signing without a debug fallback", () => {
  const gradle = applyReleaseSigningPlugin(fixtureBuildGradle);
  expect(gradle).toContain('System.getenv("VSHOP_ANDROID_KEYSTORE_PATH")');
  expect(gradle).toContain('signingConfig signingConfigs.release');
  expect(gradle).not.toContain('release {\n            signingConfig signingConfigs.debug');
});
```

Test that missing credentials makes the local build script exit before Gradle
and that redacted diagnostics contain no password values.

- [ ] **Step 2: Run RED**

```powershell
pnpm exec jest __tests__/android-release-signing.test.ts --runInBand
```

- [ ] **Step 3: Implement release metadata and config plugin**

Set:

```text
package.json version = 4.1.10
app.json expo.version = 4.1.10
app.json expo.android.versionCode = 91
app.json expo.ios.buildNumber = 43
```

Add `./plugins/withAndroidReleaseSigning.cjs` to `app.json` plugins. The plugin
uses `withAppBuildGradle` and inserts:

```groovy
release {
    storeFile file(System.getenv("VSHOP_ANDROID_KEYSTORE_PATH"))
    storePassword System.getenv("VSHOP_ANDROID_STORE_PASSWORD")
    keyAlias System.getenv("VSHOP_ANDROID_KEY_ALIAS")
    keyPassword System.getenv("VSHOP_ANDROID_KEY_PASSWORD")
}
```

The release build type must use `signingConfigs.release`; no debug fallback.
Keep the Gradle text transform independently testable:

```js
module.exports = withAndroidReleaseSigning;
module.exports.applyReleaseSigningPlugin = applyReleaseSigningPlugin;
```

- [ ] **Step 4: Implement the secret-safe local build orchestrator**

`scripts/build-android-release-local.mjs` reads an ignored JSON path supplied by
`VSHOP_ANDROID_CREDENTIALS_FILE`, validates these fields without logging values:

```json
{
  "keystorePath": "absolute path",
  "keystorePassword": "secret",
  "keyAlias": "alias",
  "keyPassword": "secret"
}
```

It spawns, in order:

```text
pnpm exec expo prebuild --platform android --clean --no-install
android/gradlew.bat assembleRelease --no-daemon
```

with release signing and both Metro optimization environment variables. It
copies the output to `.codex-tmp/builds/VShop-4.1.10-production-91.apk` and
prints only output path, byte count, and SHA-256.

Add to `.gitignore`:

```gitignore
credentials.json
*.keystore.json
```

- [ ] **Step 5: Run GREEN and regenerate the lockfile metadata**

```powershell
pnpm install --lockfile-only
pnpm exec jest __tests__/android-release-signing.test.ts --runInBand
pnpm run typecheck
pnpm exec eslint plugins/withAndroidReleaseSigning.cjs scripts/build-android-release-local.mjs __tests__/android-release-signing.test.ts --max-warnings=0
```

- [ ] **Step 6: Securely obtain the authorized production signer**

Run the interactive credential manager without printing credential contents:

```powershell
pnpm exec eas credentials -p android
```

Select project build credentials for production and download the existing
keystore/credential metadata into `.codex-tmp/credentials/`. Verify only that
the files exist and are ignored. Do not display JSON or password fields.

- [ ] **Step 7: Build and verify the local APK**

```powershell
$env:VSHOP_ANDROID_CREDENTIALS_FILE = (Resolve-Path '.codex-tmp\credentials\android-release.json').Path
node scripts/build-android-release-local.mjs
```

Verify:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\aapt.exe" dump badging '.codex-tmp\builds\VShop-4.1.10-production-91.apk'
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\apksigner.bat" verify --verbose --print-certs '.codex-tmp\builds\VShop-4.1.10-production-91.apk'
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\zipalign.exe" -c -P 16 4 '.codex-tmp\builds\VShop-4.1.10-production-91.apk'
```

Compare the signer certificate SHA-256 with the already downloaded authorized
4.1.9 production APK. Abort if they differ.

- [ ] **Step 8: Install and run the final device matrix**

```powershell
adb devices -l
adb -s 45218ba install -r '.codex-tmp\builds\VShop-4.1.10-production-91.apk'
adb -s 45218ba shell dumpsys package com.android.vshop
```

Confirm `versionName=4.1.10`, `versionCode=91`, production has no Dev Launcher,
then rerun Task 6 measurements plus loading watchdog and ErrorBoundary update
recovery. Capture PID-filtered logcat and screenshots under `.codex-tmp/`.

- [ ] **Step 9: Update release documentation and commit**

Record the local build path, hash, signer match, alignment, device evidence,
and every remaining NOT VERIFIED item. Do not place the APK in Git.

```powershell
git add .gitignore app.json package.json pnpm-lock.yaml plugins/withAndroidReleaseSigning.cjs scripts/build-android-release-local.mjs __tests__/android-release-signing.test.ts README.md CHANGELOG.md BUILD_DESIGN_SYSTEM.md DIRECTORY_STRUCTURE.md markdown/13-deployment.md markdown/14-package.md markdown/plans/README.md
git commit -m "build: prepare locally signed VShop 4.1.10"
```

---

### Task 8: Final integrated verification and independent review

**Files:**
- Modify only files required to fix findings
- Update: `markdown/UI_PERFORMANCE_REPORT_4.1.10.md`
- Update: `markdown/plans/2026-09-24-ui-performance-startup-update-recovery.md`

**Interfaces:**
- Consumes every task result.
- Produces the final source/build/device evidence packet; no automatic push or OTA.

- [ ] **Step 1: Run complete gates in a stable write window**

```powershell
pnpm run check
node .codex-tmp/diagram-validation/validate.mjs
git diff --check
git status --short
```

Run an added-line secret scan for private keys, keystore passwords, GitHub/AWS
tokens, Riot cookies, and bearer tokens. Confirm no credential/APK/native build
artifact is tracked.

- [ ] **Step 2: Run the full device verification again**

Repeat Task 6 on the installed `4.1.10 (91)` local release APK. Verify:

```text
20 directed primary tab transitions
all other tabs -> Profile, five runs each
Profile equipment <-> player data
Profile Overview <-> Details
search/close, wishlist, expand/collapse
startup watchdog update action
maintenance/update action with no cache
ErrorBoundary update action
Reduce Motion on/off
TalkBack labels/focus on recovery and icon-only controls
PID-filtered FATAL/ANR/SIGSEGV/TypeError scan
```

- [ ] **Step 3: Independent whole-branch review**

Reviewer checks correctness, update security, storage loop guard, navigation
lifecycle, accessibility, performance evidence, signing, and documentation.
Fix every Critical/High/Medium finding and rerun affected gates.

- [ ] **Step 4: Final documentation commit**

```powershell
git add markdown/UI_PERFORMANCE_REPORT_4.1.10.md markdown/plans/2026-09-24-ui-performance-startup-update-recovery.md README.md CHANGELOG.md
git commit -m "docs: record VShop 4.1.10 performance evidence"
```

- [ ] **Step 5: Stop with local deliverables**

Report commit IDs, tests, export sizes, APK path/hash/signature/alignment,
installed package evidence, performance before/after, recovery behavior, and
remaining limitations. Do not push, publish OTA, create a release, upload the
APK, or shut down the computer unless the user separately requests it.

---

## Plan self-review

### Spec coverage

- Navigation attach spikes: Tasks 1 and 6.
- Active indicator correctness: Task 2.
- Profile staged workload and chrome updates: Task 3.
- Route-independent update core and loop prevention: Task 4.
- Loading/ErrorBoundary UX and watchdog: Task 5.
- Whole UI/device smoothness: Task 6 and Task 8.
- Secure local native production build: Task 7.

### Placeholder scan

The plan contains no placeholder markers or deferred implementation steps.
Conditional performance iteration is bound to exact acceptance metrics and
owning modules.

### Type consistency

- `RecoveryUpdateState` is defined in Task 4 and consumed unchanged in Task 5.
- Existing `AppIconName`, primary-route names, Profile motion API, and Zustand
  setter signatures remain stable.
- Native metadata is consistently `4.1.10 / 91 / 43`.

### Review-focus coverage

- Rapid navigation: Task 2 tests.
- Retained scene memory: Task 1 policy and Task 6 device cycles.
- Cold dashboard race: Task 3 tests.
- Update loop: Task 4 tests.
- Recovery before the app tree: Task 5 tests and Task 8 device verification.
