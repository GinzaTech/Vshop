# Morphicons System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every VShop UI icon through a typed `AppIcon` boundary and morph stateful Lucide icons with Morphicons while preserving game-specific fallbacks, accessibility, Reduce Motion and the existing release budgets.

**Architecture:** `AppIcon` owns vendor selection, Morphicons configuration and accessibility defaults; `app-icon-registry.ts` maps VShop semantic tokens to named Lucide data or one controlled MaterialCommunityIcons fallback. Screens migrate by domain and change only semantic icon names, while source-policy tests shrink the direct-import allowlist to zero.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1, Morphicons 1.7.1, Lucide data 1.47.0, react-native-svg 15.15.4, Jest, pnpm.

**Spec:** `markdown/plans/2026-09-23-morphicons-system-design.md`

## Global Constraints

- Use `pnpm`; never create npm/yarn/bun lock files.
- Install exactly `morphicons@1.7.1`, `lucide@1.47.0` and Expo-pinned `react-native-svg@15.15.4`.
- Import icon data with named `lucide` imports; `import * as Icons` is forbidden.
- Every `MorphIcon` uses `reducedMotion="user"` and the `snappy` spring unless a test pins an instant static/fallback path.
- Business state owns the selected icon; animation never owns or delays state updates.
- Parent controls retain accessibility role/label/state and 48 dp Android / 44 pt iOS touch targets.
- Game-specific pictograms keep their meaning through one fallback inside `AppIcon`; screens never import the fallback vendor.
- Hermes must remain at or below 8 MiB and total Android export at or below 12 MiB. Do not change the thresholds.
- `react-native-svg` requires a rebuilt native client. No OTA may target the existing 4.1.8 runtime.
- Preserve unrelated worktree changes and never use destructive Git commands.

## Review Focus

- Unknown/dynamic icon strings resolve the typed `unknown` token rather than indexing the registry unsafely — pinned in Task 2.
- A lookalike Lucide icon must not replace a Valorant-specific weapon/rank/role glyph with different meaning — pinned in Tasks 2 and 6.
- Rapid state changes must update one mounted MorphIcon rather than remounting by key and losing interruption continuity — pinned in Task 2.
- Reduce Motion and icon-only accessibility must remain correct without duplicate TalkBack nodes — pinned in Tasks 2 and 7.
- Large lists must not start entrance/infinite animation per row or import the entire Lucide catalog — pinned in Tasks 5 and 7.

---

### Task 1: Install and pin the native icon runtime

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `__tests__/app-icon-dependencies.test.ts`

**Interfaces:**
- Consumes: Expo SDK 57 bundled native-module map and pnpm workspace policy.
- Produces: resolvable `morphicons/react-native`, `lucide`, and `react-native-svg` packages for Task 2.

- [ ] **Step 1: Write the failing dependency contract test**

Create `__tests__/app-icon-dependencies.test.ts`:

```ts
import packageJson from "~/package.json";

describe("AppIcon runtime dependencies", () => {
  it("pins the Morphicons native stack approved by the design", () => {
    expect(packageJson.dependencies).toMatchObject({
      morphicons: "1.7.1",
      lucide: "1.47.0",
      "react-native-svg": "15.15.4",
    });
    expect(() => require.resolve("morphicons/react-native")).not.toThrow();
    expect(() => require.resolve("lucide")).not.toThrow();
    expect(() => require.resolve("react-native-svg")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec jest __tests__/app-icon-dependencies.test.ts --runInBand
```

Expected: FAIL because the three dependencies are absent.

- [ ] **Step 3: Install exact dependencies with pnpm/Expo**

Run:

```bash
pnpm add morphicons@1.7.1 lucide@1.47.0
pnpm exec expo install react-native-svg
pnpm exec expo install --check
```

Do not use `npm install`. Confirm that only `package.json` and `pnpm-lock.yaml`
change.

- [ ] **Step 4: Run GREEN and native compatibility probes**

Run:

```bash
pnpm exec jest __tests__/app-icon-dependencies.test.ts --runInBand
pnpm run typecheck
pnpm exec expo-doctor
```

Expected: dependency test PASS, TypeScript PASS, Expo Doctor 21/21.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml __tests__/app-icon-dependencies.test.ts
git commit -m "chore: add morphicons native icon runtime"
```

---

### Task 2: Build the typed AppIcon boundary and registry

**Files:**
- Create: `components/ui/app-icon-types.ts`
- Create: `components/ui/app-icon-registry.ts`
- Create: `components/ui/AppIcon.tsx`
- Modify: `jest.config.js`
- Test: `__tests__/app-icon-registry.test.ts`
- Test: `__tests__/app-icon.test.tsx`
- Test: `__tests__/app-icon-runtime.test.ts`

**Interfaces:**
- Consumes: `MorphIcon` from `morphicons/react-native`, `IconNode` and named icons from `lucide`, MaterialCommunityIcons only inside `AppIcon.tsx`.
- Produces:
  - `type AppIconName = keyof typeof APP_ICON_REGISTRY`
  - `resolveAppIconName(value: unknown): AppIconName`
  - `resolveAppIcon(name: AppIconName): AppIconDefinition`
  - `AppIcon(props: AppIconProps): React.ReactElement`

- [ ] **Step 1: Write RED registry tests**

Create `__tests__/app-icon-registry.test.ts`:

```ts
import {
  APP_ICON_REGISTRY,
  resolveAppIcon,
  resolveAppIconName,
} from "~/components/ui/app-icon-registry";

describe("AppIcon registry", () => {
  it("resolves stable semantic names", () => {
    expect(resolveAppIconName("search")).toBe("search");
    expect(resolveAppIcon("search")).toMatchObject({ kind: "morph" });
  });

  it.each([undefined, null, "", "constructor", "not-an-icon"])(
    "fails closed for %p",
    (value) => {
      expect(resolveAppIconName(value)).toBe("unknown");
    }
  );

  it("keeps Valorant-only glyphs behind the legacy boundary", () => {
    expect(resolveAppIcon("weapon-pistol")).toEqual({
      kind: "legacy",
      legacyName: "pistol",
    });
    expect(Object.keys(APP_ICON_REGISTRY).length).toBeGreaterThan(40);
  });
});
```

Create `__tests__/app-icon-runtime.test.ts` as an unmocked package-exports smoke
test. It must import `MorphIcon` from the public subpath and one named Lucide
data export, then assert that both resolve without any deep `dist/` import:

```ts
import { Search } from "lucide";
import { MorphIcon } from "morphicons/react-native";

it("resolves ESM package exports through Jest like Metro", () => {
  expect(Search).toBeDefined();
  expect(MorphIcon).toBeDefined();
});
```

- [ ] **Step 2: Write RED AppIcon component tests**

Create `__tests__/app-icon.test.tsx` and mock Morphicons/legacy icon components:

```tsx
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import AppIcon from "~/components/ui/AppIcon";

const morphProps: Record<string, unknown>[] = [];
jest.mock("morphicons/react-native", () => ({
  MorphIcon: (props: Record<string, unknown>) => {
    morphProps.push(props);
    return null;
  },
}));
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => () => null);

describe("AppIcon", () => {
  beforeEach(() => morphProps.splice(0));

  it("always honors system Reduce Motion", () => {
    act(() => {
      TestRenderer.create(<AppIcon name="search" size={20} color="#fff" />);
    });
    expect(morphProps.at(-1)).toMatchObject({
      reducedMotion: "user",
      spring: "snappy",
      size: 20,
      color: "#fff",
    });
  });

  it("updates one mounted morph when semantic state changes", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AppIcon name="search" size={20} color="#fff" />
      );
    });
    act(() => {
      renderer!.update(<AppIcon name="close" size={20} color="#fff" />);
    });
    expect(morphProps).toHaveLength(2);
    expect(morphProps[0].icon).not.toBe(morphProps[1].icon);
  });
});
```

- [ ] **Step 3: Run RED**

```bash
pnpm exec jest __tests__/app-icon-registry.test.ts __tests__/app-icon.test.tsx --runInBand
```

Expected: FAIL because the boundary and registry do not exist.

- [ ] **Step 4: Enable the ESM package exports in Jest**

Add `morphicons` and `lucide` to the existing pnpm-aware
`transformIgnorePatterns` allowlist in `jest.config.js`. Do not deep-import
`morphicons/dist/react-native.js`; RN 0.86/Metro resolves
`morphicons/react-native` through package exports.

Run:

```bash
pnpm exec jest __tests__/app-icon-runtime.test.ts --runInBand
```

Expected: PASS without a syntax/export error.

- [ ] **Step 5: Implement types and exact fallback contract**

Create `components/ui/app-icon-types.ts`:

```ts
import type { IconNode } from "lucide";

export type MorphIconDefinition = { kind: "morph"; icon: IconNode };
export type LegacyIconDefinition = {
  kind: "legacy";
  legacyName: "pistol" | "sword-cross" | "shield-account-outline";
};
export type AppIconDefinition = MorphIconDefinition | LegacyIconDefinition;
```

The initial registry must include these semantic tokens before domain tasks add
their remaining entries:

```ts
unknown, menu, close, search, back, forward, chevronLeft, chevronRight,
chevronUp, chevronDown, refresh, loading, check, success, error, info,
account, accountGroup, settings, shop, grid, heart, heartFilled, calendar,
clock, share, copy, send, download, edit, globe, map, target, chartLine,
chartBar, databaseOff, shield, weaponPistol, combatSword
```

Use named Lucide imports. `weaponPistol`, `combatSword` and the Valorant role
shield resolve to the three legacy definitions; every other token resolves to a
Lucide `IconNode`. `unknown` uses Lucide `CircleHelp`.

- [ ] **Step 6: Implement AppIcon**

`AppIcon` resolves the definition once per `name`. For `kind: "morph"`, render:

```tsx
<MorphIcon
  icon={definition.icon}
  size={size}
  color={color}
  strokeWidth={strokeWidth}
  spring="snappy"
  reducedMotion="user"
  label={label}
  testID={testID}
/>
```

For `kind: "legacy"`, render MaterialCommunityIcons with
`importantForAccessibility="no"` and `accessibilityElementsHidden`. Parent
controls own semantics. Morphicons forwards `label` as `role`/ARIA attributes on
the underlying SVG, so `label` is only passed when AppIcon itself is the sole
accessible element and must be manually checked with TalkBack.

- [ ] **Step 7: Run GREEN and coverage**

```bash
pnpm exec jest __tests__/app-icon-runtime.test.ts __tests__/app-icon-registry.test.ts __tests__/app-icon.test.tsx --runInBand --coverage --collectCoverageFrom=components/ui/AppIcon.tsx --collectCoverageFrom=components/ui/app-icon-registry.ts
pnpm run typecheck
pnpm exec eslint components/ui/AppIcon.tsx components/ui/app-icon-types.ts components/ui/app-icon-registry.ts __tests__/app-icon*.test.ts* --max-warnings=0
```

Expected: tests PASS and both new runtime modules meet 80% lines/branches/functions/statements.

- [ ] **Step 8: Commit**

```bash
git add jest.config.js components/ui/AppIcon.tsx components/ui/app-icon-types.ts components/ui/app-icon-registry.ts __tests__/app-icon-runtime.test.ts __tests__/app-icon-registry.test.ts __tests__/app-icon.test.tsx
git commit -m "feat: add typed morphing icon boundary"
```

---

### Task 3: Migrate app shell and shared primitives

**Files:**
- Modify: `app/reauth.tsx`
- Modify: `app/(authenticated)/_layout.tsx`
- Modify: `components/LoadingScreen.tsx`
- Modify: `components/BatteryOptimizationWarning.tsx`
- Modify: `components/BundleImage.tsx`
- Modify: `components/Countdown.tsx`
- Modify: `components/GalleryEquip.tsx`
- Modify: `components/popups/MediaPopup.tsx`
- Modify: `components/popups/UpdatePopup.tsx`
- Modify: `components/ui/AppIcon.tsx`
- Modify: `components/ui/app-icon-registry.ts`
- Create: `__tests__/app-icon-boundary.test.ts`
- Modify: `__tests__/authenticated-navigation.test.tsx`
- Modify: `__tests__/loading-screen.test.tsx`
- Modify: `__tests__/media-popup.test.tsx`

**Interfaces:**
- Consumes: Task 2 `AppIcon`, `AppIconName`, `resolveAppIconName`.
- Produces: shell/navigation/shared controls with no direct vendor import; source allowlist for remaining domain files.

- [ ] **Step 1: Write the RED source-boundary test**

Create `__tests__/app-icon-boundary.test.ts` using `fs`/`path`. Scan `.tsx`
under `app`, `components`, `features`, and `hooks`. Direct
`@expo/vector-icons/MaterialCommunityIcons` imports are allowed only in this
exact remaining set after Task 3:

```ts
const remainingLegacyImports = new Set([
  "app/(authenticated)/about.tsx",
  "app/(authenticated)/accessories.tsx",
  "app/(authenticated)/bundles.tsx",
  "app/(authenticated)/combat.tsx",
  "app/(authenticated)/contracts.tsx",
  "app/(authenticated)/crosshair.tsx",
  "app/(authenticated)/friends.tsx",
  "app/(authenticated)/gallery.tsx",
  "app/(authenticated)/item_upgrades.tsx",
  "app/(authenticated)/leaderboard.tsx",
  "app/(authenticated)/night_market.tsx",
  "app/(authenticated)/settings.tsx",
  "app/(authenticated)/shop.tsx",
  "app/chat/[friendId].tsx",
  "components/match-detail/EconomyChart.tsx",
  "components/match-detail/MatchDetailHeader.tsx",
  "components/match-detail/PerformanceStats.tsx",
  "components/match-detail/RoundTimeline.tsx",
  "components/match-detail/ScoreboardTable.tsx",
  "components/match-detail/StickyShareBar.tsx",
  "components/matches/MatchHistoryHeader.tsx",
  "components/matches/MatchImage.tsx",
  "components/matches/MatchStates.tsx",
  "components/profile/CollectionCheckerExport.tsx",
  "components/profile/CompactPlayerProfileCard.tsx",
  "components/profile/PlayerInfoView.tsx",
  "components/profile/PlayerStatsActivity.tsx",
  "components/profile/PlayerStatsPrimitives.tsx",
  "components/profile/PlayerStatsSections.tsx",
  "components/profile/RankSplitGroup.tsx",
  "features/combat/CombatSessionScreen.tsx",
  "features/profile/ProfileEquipmentSections.tsx",
  "features/profile/ProfileHeroCard.tsx",
  "features/profile/ProfilePickerModal.tsx",
  "features/profile/ProfileScreen.tsx",
]);
```

Also fail when source contains `import * as` from `lucide`.

- [ ] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/app-icon-boundary.test.ts --runInBand
```

Expected: FAIL because shared/shell files still import MaterialCommunityIcons.

- [ ] **Step 3: Add exact shell semantic tokens**

Extend the registry for shell states:

```text
navStore, navShop, navProfile, navNightMarket, navMore, language,
batteryWarning, bundle, timer, update, updateChecking, imageGrid
```

Map selected/unselected navigation states to one mounted AppIcon per tab. Preserve
the existing tab `accessibilityRole="tab"`, selected state and labels.

- [ ] **Step 4: Replace imports in the nine listed shared/shell files**

Use `AppIcon name="..."` for static controls. Convert these state pairs to one
mounted component whose `name` prop changes:

```text
UpdatePopup: update ↔ updateChecking
BundleImage: bundle ↔ imageGrid where the existing UI state changes
authenticated layout: current selected tab icon ↔ next selected tab icon
```

Do not add entrance animation to list rows or skeletons.

- [ ] **Step 5: Run GREEN regression tests**

```bash
pnpm exec jest __tests__/app-icon-boundary.test.ts __tests__/authenticated-navigation.test.tsx __tests__/loading-screen.test.tsx __tests__/media-popup.test.tsx --runInBand
pnpm run typecheck
```

Expected: source-boundary test passes with exactly the remaining allowlist;
navigation/loading/modal semantics remain green.

- [ ] **Step 6: Commit**

```bash
git add app/reauth.tsx app/(authenticated)/_layout.tsx components/LoadingScreen.tsx components/BatteryOptimizationWarning.tsx components/BundleImage.tsx components/Countdown.tsx components/GalleryEquip.tsx components/popups/MediaPopup.tsx components/popups/UpdatePopup.tsx components/ui/AppIcon.tsx components/ui/app-icon-registry.ts __tests__/app-icon-boundary.test.ts __tests__/authenticated-navigation.test.tsx __tests__/loading-screen.test.tsx __tests__/media-popup.test.tsx
git commit -m "refactor: route shell icons through AppIcon"
```

---

### Task 4: Migrate Profile icons and state morphs

**Files:**
- Modify: `features/profile/ProfileScreen.tsx`
- Modify: `features/profile/ProfileHeroCard.tsx`
- Modify: `features/profile/ProfilePickerModal.tsx`
- Modify: `features/profile/ProfileEquipmentSections.tsx`
- Modify: `components/profile/CollectionCheckerExport.tsx`
- Modify: `components/profile/CompactPlayerProfileCard.tsx`
- Modify: `components/profile/PlayerInfoView.tsx`
- Modify: `components/profile/PlayerStatsActivity.tsx`
- Modify: `components/profile/PlayerStatsPrimitives.tsx`
- Modify: `components/profile/PlayerStatsSections.tsx`
- Modify: `components/profile/RankSplitGroup.tsx`
- Modify: `components/ui/app-icon-registry.ts`
- Modify: `__tests__/app-icon-boundary.test.ts`
- Modify: `__tests__/player-info-view.test.tsx`
- Modify: `__tests__/profile-motion-cold-transition.test.tsx`
- Test: `__tests__/profile-icon-motion.test.tsx`

**Interfaces:**
- Consumes: shared AppIcon boundary and source allowlist from Task 3.
- Produces: Profile with semantic icon tokens and state morphs; zero Profile files in direct-import allowlist.

- [ ] **Step 1: Write RED Profile motion tests**

Create `__tests__/profile-icon-motion.test.tsx` with the project’s existing
Profile mocks. Assert these state changes update AppIcon `name` without replacing
the parent Pressable:

```text
profile hero: equipmentProfile ↔ playerStats
picker row: unselected ↔ selected
dashboard: overview ↔ details
season panel: collapsed ↔ expanded
```

Assert parent buttons keep `accessibilityState.selected/expanded` and the icon
is decorative when the parent already has a label.

- [ ] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/profile-icon-motion.test.tsx --runInBand
```

Expected: FAIL because Profile still renders vendor icons.

- [ ] **Step 3: Add Profile registry tokens**

Add named tokens:

```text
equipmentProfile, playerStats, edit, region, accountSynced, accountWarning,
rank, peakRank, collection, skin, loadout, spray, flex, selected, unselected,
overview, details, season, export, emptyData
```

`weaponPistol`, rank crest and Valorant role shields stay legacy/game-specific.
All calendar/chart/database/edit/navigation symbols use Lucide data.

- [ ] **Step 4: Replace direct imports in all eleven Profile files**

Update typed data structures from vendor icon-name strings to `AppIconName`.
For example:

```ts
type DashboardTab = {
  id: "overview" | "details";
  icon: AppIconName;
  label: string;
};
```

Do not alter existing Profile layout, gesture, transition duration or numeric
hierarchy.

- [ ] **Step 5: Remove Profile files from the source allowlist and run GREEN**

```bash
pnpm exec jest __tests__/profile-icon-motion.test.tsx __tests__/player-info-view.test.tsx __tests__/profile-motion-cold-transition.test.tsx __tests__/app-icon-boundary.test.ts --runInBand
pnpm run typecheck
```

Expected: all tests PASS; the boundary test reports no Profile direct imports.

- [ ] **Step 6: Commit**

```bash
git add features/profile components/profile components/ui/app-icon-registry.ts __tests__/profile-icon-motion.test.tsx __tests__/player-info-view.test.tsx __tests__/profile-motion-cold-transition.test.tsx __tests__/app-icon-boundary.test.ts
git commit -m "refactor: migrate profile icons to morphicons"
```

---

### Task 5: Migrate Match, Store and reference-screen icons

**Files:**
- Modify: `components/match-detail/EconomyChart.tsx`
- Modify: `components/match-detail/MatchDetailHeader.tsx`
- Modify: `components/match-detail/PerformanceStats.tsx`
- Modify: `components/match-detail/RoundTimeline.tsx`
- Modify: `components/match-detail/ScoreboardTable.tsx`
- Modify: `components/match-detail/StickyShareBar.tsx`
- Modify: `components/matches/MatchHistoryHeader.tsx`
- Modify: `components/matches/MatchImage.tsx`
- Modify: `components/matches/MatchStates.tsx`
- Modify: `app/(authenticated)/about.tsx`
- Modify: `app/(authenticated)/accessories.tsx`
- Modify: `app/(authenticated)/bundles.tsx`
- Modify: `app/(authenticated)/contracts.tsx`
- Modify: `app/(authenticated)/crosshair.tsx`
- Modify: `app/(authenticated)/gallery.tsx`
- Modify: `app/(authenticated)/item_upgrades.tsx`
- Modify: `app/(authenticated)/leaderboard.tsx`
- Modify: `app/(authenticated)/night_market.tsx`
- Modify: `app/(authenticated)/shop.tsx`
- Modify: `components/ui/app-icon-registry.ts`
- Modify: `__tests__/app-icon-boundary.test.ts`
- Modify: `__tests__/match-detail-accessibility.test.tsx`
- Modify: `__tests__/match-card.test.tsx`
- Test: `__tests__/stateful-icon-pairs.test.tsx`

**Interfaces:**
- Consumes: `AppIconName`, AppIcon and the controlled game-specific fallback.
- Produces: Match/commerce/reference modules with no direct vendor import; state-pair coverage for list-safe icons.

- [ ] **Step 1: Write RED state-pair and large-list tests**

Create `__tests__/stateful-icon-pairs.test.tsx`. Cover these transitions:

```text
shop wishlist: heart ↔ heartFilled
item upgrade option: unselected ↔ selected
item upgrade group: collapsed ↔ expanded
economy chart menu: collapsed ↔ expanded
scoreboard sort: sortAscending ↔ sortDescending
match state: refresh ↔ loading
```

Render 100 static MatchImage rows and assert no timer, `withRepeat`, or changing
icon prop is created for static empty-state icons.

- [ ] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/stateful-icon-pairs.test.tsx --runInBand
```

Expected: FAIL because these files still use vendor icon strings.

- [ ] **Step 3: Add exact registry tokens**

```text
sortAscending, sortDescending, wishlist, wishlistFilled, upgrade,
palette, timeline, contract, mission, leaderboardSeason, nightMarket,
crosshair, accessory, bundle, history, match, map, skull, economy,
performance, share, retry, emptyImage, completed, incomplete
```

Round outcome and rank/weapon visuals that encode Valorant taxonomy remain typed
legacy definitions. Generic close/search/clock/calendar/arrow icons use Lucide.

- [ ] **Step 4: Migrate the nineteen files and typed icon-bearing objects**

Replace vendor-name fields with `AppIconName`. Keep Match/Store API data and
list keys unchanged. One mounted AppIcon changes `name` for each pair above;
static list icons never receive a changing prop.

- [ ] **Step 5: Shrink allowlist and run GREEN**

After this task, `remainingLegacyImports` may contain only:

```text
app/(authenticated)/combat.tsx
app/(authenticated)/friends.tsx
app/(authenticated)/settings.tsx
app/chat/[friendId].tsx
features/combat/CombatSessionScreen.tsx
```

Run:

```bash
pnpm exec jest __tests__/stateful-icon-pairs.test.tsx __tests__/match-detail-accessibility.test.tsx __tests__/match-card.test.tsx __tests__/app-icon-boundary.test.ts --runInBand
pnpm run typecheck
```

Expected: PASS with the exact five-file allowlist.

- [ ] **Step 6: Commit**

```bash
git add app/(authenticated) components/match-detail components/matches components/ui/app-icon-registry.ts __tests__/stateful-icon-pairs.test.tsx __tests__/match-detail-accessibility.test.tsx __tests__/match-card.test.tsx __tests__/app-icon-boundary.test.ts
git commit -m "refactor: migrate match and store icons"
```

---

### Task 6: Migrate Combat, social and Settings icons

**Files:**
- Modify: `features/combat/CombatSessionScreen.tsx`
- Modify: `app/(authenticated)/combat.tsx`
- Modify: `app/(authenticated)/friends.tsx`
- Modify: `app/(authenticated)/settings.tsx`
- Modify: `app/chat/[friendId].tsx`
- Modify: `components/ui/app-icon-registry.ts`
- Modify: `__tests__/app-icon-boundary.test.ts`
- Modify: `__tests__/combat-screen-lifecycle.test.tsx`
- Modify: `__tests__/core-accessibility.test.ts`
- Test: `__tests__/combat-social-icon-motion.test.tsx`

**Interfaces:**
- Consumes: completed semantic registry and legacy fallback.
- Produces: zero direct MaterialCommunityIcons imports outside `AppIcon.tsx`.

- [ ] **Step 1: Write RED interaction tests**

Create `__tests__/combat-social-icon-motion.test.tsx` and cover:

```text
combat refresh ↔ loading
party ready ↔ cancelReady
friends search ↔ close
friends connected ↔ disconnected
chat send stays static while text changes
settings rows stay static and preserve labels
```

Assert no test renders an accessible child icon inside an already-labelled
Pressable.

- [ ] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/combat-social-icon-motion.test.tsx --runInBand
```

Expected: FAIL because the five files still use direct vendor icons.

- [ ] **Step 3: Add final registry tokens**

```text
party, ready, cancelReady, connected, disconnected, friendSearch,
chatSend, leaveParty, copyCode, combatLive, combatPregame, lockAgent,
settingsAccount, settingsLanguage, settingsSwap, settingsAbout
```

Keep agent-role shields and crossed-sword game taxonomy behind the typed legacy
fallback. Generic account/link/send/copy/refresh/close icons use Lucide.

- [ ] **Step 4: Migrate all five files and empty the allowlist**

Change dynamic objects such as settings rows and friend-state metadata to
`AppIconName`. Set `remainingLegacyImports` to an empty set and make the source
test allow MaterialCommunityIcons only in `components/ui/AppIcon.tsx`.

- [ ] **Step 5: Run GREEN**

```bash
pnpm exec jest __tests__/combat-social-icon-motion.test.tsx __tests__/combat-screen-lifecycle.test.tsx __tests__/core-accessibility.test.ts __tests__/app-icon-boundary.test.ts --runInBand
pnpm run typecheck
```

Expected: PASS; direct-import count outside AppIcon equals zero.

- [ ] **Step 6: Commit**

```bash
git add features/combat/CombatSessionScreen.tsx app/(authenticated)/combat.tsx app/(authenticated)/friends.tsx app/(authenticated)/settings.tsx app/chat/[friendId].tsx components/ui/app-icon-registry.ts __tests__/combat-social-icon-motion.test.tsx __tests__/combat-screen-lifecycle.test.tsx __tests__/core-accessibility.test.ts __tests__/app-icon-boundary.test.ts
git commit -m "refactor: complete app icon migration"
```

---

### Task 7: Release hardening, documentation and device verification

**Files:**
- Modify: `app.json`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `BUILD_DESIGN_SYSTEM.md`
- Modify: `DIRECTORY_STRUCTURE.md`
- Modify: `markdown/11-component.md`
- Modify: `markdown/14-package.md`
- Modify: `markdown/plans/2026-09-23-morphicons-system-design.md`
- Modify: `markdown/plans/2026-09-23-morphicons-system.md`
- Test: `__tests__/app-icon-boundary.test.ts`
- Test: `__tests__/app-icon.test.tsx`

**Interfaces:**
- Consumes: completed icon boundary and all migrated domains.
- Produces: native release candidate 4.1.9, Android versionCode 90, iOS buildNumber 42, final evidence and clean pushable branch.

- [ ] **Step 1: Add final source-policy assertions**

Extend `__tests__/app-icon-boundary.test.ts` to assert:

```ts
expect(directMaterialCommunityImports).toEqual([
  "components/ui/AppIcon.tsx",
]);
expect(namespaceLucideImports).toEqual([]);
expect(rawMorphIconImportsOutsideBoundary).toEqual([]);
```

Extend `__tests__/app-icon.test.tsx` so icon-only labels produce one accessible
node, decorative icons produce none, and `reducedMotion="user"` is immutable.

- [ ] **Step 2: Run RED if any migration escaped the boundary**

```bash
pnpm exec jest __tests__/app-icon-boundary.test.ts __tests__/app-icon.test.tsx --runInBand
```

Expected: PASS only when all direct imports and accessibility leaks are removed;
otherwise fix the reported exact files before continuing.

- [ ] **Step 3: Update native version metadata**

Set:

```text
package.json version = 4.1.9
app.json expo.version = 4.1.9
app.json expo.android.versionCode = 90
app.json expo.ios.buildNumber = 42
```

This prevents the new `react-native-svg` binary from being published to the
4.1.8 runtime via OTA.

- [ ] **Step 4: Update documentation**

Document:

- AppIcon semantic boundary and fallback ownership;
- Morphicons/Lucide/react-native-svg dependency chain;
- Reduce Motion and accessibility rules;
- state-pair policy and game-specific exceptions;
- native rebuild/runtime boundary;
- exact source/device/bundle evidence and any NOT VERIFIED item.

Run Mermaid/link validation:

```bash
node .codex-tmp/diagram-validation/validate.mjs
```

- [ ] **Step 5: Run complete source and security gates**

```bash
pnpm run check
git diff --check
git status --short
```

Run an added-line secret scan for private keys, GitHub/AWS tokens, JWTs, Riot
cookies and bearer tokens. Expected: 79+ suites pass, critical files remain above
80%, audit policy passes, total export ≤12 MiB, Hermes ≤8 MiB and no secret hit.

- [ ] **Step 6: Rebuild and install the development APK**

Use the project’s EAS development profile. Wait for `FINISHED`, resolve the
artifact URL, download it to one explicit workspace path, then install:

```powershell
$build = pnpm exec eas build --platform android --profile development --non-interactive --wait --json | ConvertFrom-Json
$artifactUrl = $build.artifacts.buildUrl
if (-not $artifactUrl) { throw "Finished EAS build did not return an artifact URL" }
New-Item -ItemType Directory -Force -Path .codex-tmp\builds | Out-Null
$artifactPath = [IO.Path]::GetFullPath((Join-Path (Get-Location) ".codex-tmp\builds\VShop-4.1.9-development-90.apk"))
Invoke-WebRequest -Uri $artifactUrl -OutFile $artifactPath
adb devices -l
adb -s 45218ba install -r $artifactPath
adb -s 45218ba shell dumpsys package com.android.vshop
```

Expected: `versionName=4.1.9`, `versionCode=90`, and Dev Launcher components are
present. If device serial differs, use the actual single connected serial and
record it; never run unpinned ADB mutation with multiple devices.

- [ ] **Step 7: Device interaction and performance evidence**

Verify on hardware:

```text
primary tab selection
Profile equipment ↔ player data
Profile Overview ↔ Details
search ↔ close
wishlist outline ↔ filled
expand ↔ collapse
party ready ↔ cancel (UI fixture only; do not mutate a live party)
Reduce Motion on/off
TalkBack focus on icon-only controls
```

Capture screenshots and frame metrics for at least five warm runs of navigation
and Profile morphs. Filter logcat by package PID and report FATAL/ANR/SIGSEGV.
Do not queue, purchase, lock an agent, change loadout or send chat as smoke tests.

- [ ] **Step 8: Final review, commit and push**

Review every acceptance criterion in the spec. Record real maintenance/native
limitations as `NOT VERIFIED`, then:

```bash
git add -A
git commit -m "feat: animate app icons with morphicons"
git push -u origin main
```

Do not bypass pre-push hooks and do not force-push.
