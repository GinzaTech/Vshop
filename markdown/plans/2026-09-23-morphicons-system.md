# Morphicons System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every VShop UI icon, including Valorant-specific glyphs, through a typed `AppIcon`/`MorphIcon` boundary while preserving semantics, accessibility, Reduce Motion and the existing release budgets.

**Architecture:** `AppIcon` owns Morphicons configuration and accessibility defaults; `app-icon-registry.ts` maps VShop semantic tokens to morphable `IconNode` data from `app-icon-lucide.ts`. That file is the sole exact-version Lucide deep-ESM runtime boundary and owns the custom local Pistol node. Screens change only semantic names; MaterialCommunityIcons has no AppIcon runtime path.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1, Morphicons 1.7.1, Lucide data 1.47.0, react-native-svg 15.15.4, Jest, pnpm.

**Spec:** `markdown/plans/2026-09-23-morphicons-system-design.md`

## Global Constraints

- Use `pnpm`; never create npm/yarn/bun lock files.
- Install exactly `morphicons@1.7.1`, `lucide@1.47.0` and Expo-pinned `react-native-svg@15.15.4`.
- Keep `lucide` exact-pinned at `1.47.0`; runtime deep ESM imports are allowed only in `components/ui/app-icon-lucide.ts`. Runtime barrel/namespace imports are forbidden.
- Every `MorphIcon` uses `reducedMotion="user"` and the `snappy` spring.
- Business state owns the selected icon; animation never owns or delays state updates.
- Parent controls retain accessibility role/label/state and 48 dp Android / 44 pt iOS touch targets.
- Game-specific pictograms keep their meaning through reviewed Lucide/local `IconNode` data; Pistol is local and every glyph still renders through `MorphIcon`.
- Hermes must remain at or below 8 MiB and total Android export at or below 12 MiB. Do not change the thresholds.
- `react-native-svg` requires a rebuilt native client. No OTA may target the existing 4.1.8 runtime.
- Preserve unrelated worktree changes and never use destructive Git commands.

## Review Focus

- Unknown/dynamic icon strings resolve the typed `unknown` token rather than indexing the registry unsafely — pinned in Task 2.
- A lookalike Lucide icon must not replace a Valorant-specific weapon/rank/role glyph with different meaning; custom local vector data is allowed behind the Lucide boundary — pinned in Tasks 2 and 6.
- Rapid state changes must update one mounted MorphIcon rather than remounting by key and losing interruption continuity — pinned in Task 2.
- Reduce Motion and icon-only accessibility must remain correct without duplicate TalkBack nodes — pinned in Tasks 2 and 7.
- Large lists must not start entrance/infinite animation per row or import the entire Lucide catalog — pinned in Tasks 5 and 7.

---

### Task 1: Install and pin the native icon runtime

**Committed evidence:** `2cf5c81` (`chore: add morphicons native icon runtime`).

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `__tests__/app-icon-dependencies.test.ts`

**Interfaces:**
- Consumes: Expo SDK 57 bundled native-module map and pnpm workspace policy.
- Produces: resolvable `morphicons/react-native`, `lucide`, and `react-native-svg` packages for Task 2.

- [x] **Step 1: Write the failing dependency contract test**

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

- [x] **Step 2: Run RED**

Run:

```bash
pnpm exec jest __tests__/app-icon-dependencies.test.ts --runInBand
```

Expected: FAIL because the three dependencies are absent.

- [x] **Step 3: Install exact dependencies with pnpm/Expo**

Run:

```bash
pnpm add morphicons@1.7.1 lucide@1.47.0
pnpm exec expo install react-native-svg
pnpm exec expo install --check
```

Do not use `npm install`. Confirm that only `package.json` and `pnpm-lock.yaml`
change.

- [x] **Step 4: Run GREEN and native compatibility probes**

Run:

```bash
pnpm exec jest __tests__/app-icon-dependencies.test.ts --runInBand
pnpm run typecheck
pnpm exec expo-doctor
```

Expected: dependency test PASS, TypeScript PASS, Expo Doctor 21/21.

- [x] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml __tests__/app-icon-dependencies.test.ts
git commit -m "chore: add morphicons native icon runtime"
```

---

### Task 2: Build the typed AppIcon boundary and registry

**Committed evidence:** `6a58686` (`feat: add typed morphing icon boundary`),
with the approved fill-state clarification in `6773fa2`.

**Files:**
- Create: `components/ui/app-icon-types.ts`
- Create: `components/ui/app-icon-registry.ts`
- Create: `components/ui/app-icon-lucide.ts`
- Create: `components/ui/AppIcon.tsx`
- Modify: `jest.config.js`
- Test: `__tests__/app-icon-registry.test.ts`
- Test: `__tests__/app-icon.test.tsx`
- Test: `__tests__/app-icon-runtime.test.ts`

**Interfaces:**
- Consumes: `MorphIcon` from `morphicons/react-native` and exact-version `IconNode` data isolated by `app-icon-lucide.ts`.
- Produces:
  - `type AppIconName = keyof typeof APP_ICON_REGISTRY`
  - `resolveAppIconName(value: unknown): AppIconName`
  - `resolveAppIcon(name: AppIconName): AppIconDefinition`
  - `AppIcon(props: AppIconProps): React.ReactElement`

- [x] **Step 1: Write RED registry tests**

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

  it("keeps Valorant-only glyphs on the morph boundary", () => {
    expect(resolveAppIcon("weaponPistol")).toEqual({
      kind: "morph",
      icon: Pistol,
    });
    expect(Object.keys(APP_ICON_REGISTRY).length).toBeGreaterThan(40);
  });
});
```

Create `__tests__/app-icon-runtime.test.ts` as an unmocked package-exports smoke
test. The final production path imports `MorphIcon` from the public subpath and
Lucide `.mjs` icon data only through `app-icon-lucide.ts`:

```ts
import { Search } from "~/components/ui/app-icon-lucide";
import { MorphIcon } from "morphicons/react-native";

it("resolves ESM package exports through Jest like Metro", () => {
  expect(Search).toBeDefined();
  expect(MorphIcon).toBeDefined();
});
```

- [x] **Step 2: Write RED AppIcon component tests**

Create `__tests__/app-icon.test.tsx` and mock Morphicons:

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

- [x] **Step 3: Run RED**

```bash
pnpm exec jest __tests__/app-icon-registry.test.ts __tests__/app-icon.test.tsx --runInBand
```

Expected: FAIL because the boundary and registry do not exist.

- [x] **Step 4: Enable Lucide ESM modules in Jest**

Add `morphicons` and `lucide` to the existing pnpm-aware
`transformIgnorePatterns` allowlist and map `.mjs` to the Expo JavaScript
transformer in `jest.config.js`. Do not deep-import Morphicons; RN 0.86/Metro
resolves `morphicons/react-native` through package exports. Lucide runtime deep
imports stay isolated in `app-icon-lucide.ts`.

Run:

```bash
pnpm exec jest __tests__/app-icon-runtime.test.ts --runInBand
```

Expected: PASS without a syntax/export error.

- [x] **Step 5: Implement the all-morph definition contract**

Create `components/ui/app-icon-types.ts`:

```ts
import type { IconNode } from "lucide";

export type MorphIconDefinition = {
  kind: "morph";
  icon: IconNode;
  filled?: true;
};
export type AppIconDefinition = MorphIconDefinition;
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

Import icon data only from `app-icon-lucide.ts`. `weaponPistol` resolves to the
custom local Pistol `IconNode`; `combatSword` and Valorant role shields resolve
to reviewed morphable vector data. Every registry definition has
`kind: "morph"`. `unknown` uses Lucide `CircleHelp`; `heart` and `heartFilled`
preserve the same Heart path and only the latter sets `filled: true`.

- [x] **Step 6: Implement AppIcon**

`AppIcon` resolves the definition once per `name`. For `kind: "morph"`, render:

```tsx
<MorphIcon
  icon={definition.icon}
  size={size}
  color={color}
  strokeWidth={strokeWidth}
  fill={definition.filled ? color : "none"}
  spring="snappy"
  reducedMotion="user"
  label={label}
  testID={testID}
/>
```

There is no legacy render branch. Parent controls own semantics. Morphicons
forwards `label` as `role`/ARIA attributes on the underlying SVG, so `label` is
only passed when AppIcon itself is the sole accessible element and must be
manually checked with TalkBack.

- [x] **Step 7: Run GREEN and coverage**

```bash
pnpm exec jest __tests__/app-icon-runtime.test.ts __tests__/app-icon-registry.test.ts __tests__/app-icon.test.tsx --runInBand --coverage --collectCoverageFrom=components/ui/AppIcon.tsx --collectCoverageFrom=components/ui/app-icon-registry.ts
pnpm run typecheck
pnpm exec eslint components/ui/AppIcon.tsx components/ui/app-icon-types.ts components/ui/app-icon-registry.ts __tests__/app-icon*.test.ts* --max-warnings=0
```

Expected: tests PASS and both new runtime modules meet 80% lines/branches/functions/statements.

- [x] **Step 8: Commit**

```bash
git add jest.config.js components/ui/AppIcon.tsx components/ui/app-icon-types.ts components/ui/app-icon-registry.ts __tests__/app-icon-runtime.test.ts __tests__/app-icon-registry.test.ts __tests__/app-icon.test.tsx
git commit -m "feat: add typed morphing icon boundary"
```

---

### Task 3: Migrate app shell and shared primitives

**Committed evidence:** `6704fa9` (`refactor: migrate shell icons to AppIcon`)
and `f6c684c` (`refactor: migrate shared icons to AppIcon`).

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

- [x] **Step 1: Write the RED source-boundary test**

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

- [x] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/app-icon-boundary.test.ts --runInBand
```

Expected: FAIL because shared/shell files still import MaterialCommunityIcons.

- [x] **Step 3: Add exact shell semantic tokens**

Extend the registry for shell states:

```text
navStore, navShop, navProfile, navNightMarket, navMore, language,
batteryWarning, bundle, timer, update, updateChecking, imageGrid
```

Map selected/unselected navigation states to one mounted AppIcon per tab. Preserve
the existing tab `accessibilityRole="tab"`, selected state and labels.

- [x] **Step 4: Replace imports in the nine listed shared/shell files**

Use `AppIcon name="..."` for static controls. Convert these state pairs to one
mounted component whose `name` prop changes:

```text
UpdatePopup: update ↔ updateChecking
BundleImage: bundle ↔ imageGrid where the existing UI state changes
authenticated layout: current selected tab icon ↔ next selected tab icon
```

Do not add entrance animation to list rows or skeletons.

- [x] **Step 5: Run GREEN regression tests**

```bash
pnpm exec jest __tests__/app-icon-boundary.test.ts __tests__/authenticated-navigation.test.tsx __tests__/loading-screen.test.tsx __tests__/media-popup.test.tsx --runInBand
pnpm run typecheck
```

Expected: source-boundary test passes with exactly the remaining allowlist;
navigation/loading/modal semantics remain green.

- [x] **Step 6: Commit**

```bash
git add app/reauth.tsx app/(authenticated)/_layout.tsx components/LoadingScreen.tsx components/BatteryOptimizationWarning.tsx components/BundleImage.tsx components/Countdown.tsx components/GalleryEquip.tsx components/popups/MediaPopup.tsx components/popups/UpdatePopup.tsx components/ui/AppIcon.tsx components/ui/app-icon-registry.ts __tests__/app-icon-boundary.test.ts __tests__/authenticated-navigation.test.tsx __tests__/loading-screen.test.tsx __tests__/media-popup.test.tsx
git commit -m "refactor: route shell icons through AppIcon"
```

---

### Task 4: Migrate Profile icons and state morphs

**Committed evidence:** `6ffa86f` (`refactor: migrate profile feature icons`)
and `7b27218` (`refactor: migrate profile component icons`).

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

- [x] **Step 1: Write RED Profile motion tests**

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

- [x] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/profile-icon-motion.test.tsx --runInBand
```

Expected: FAIL because Profile still renders vendor icons.

- [x] **Step 3: Add Profile registry tokens**

Add named tokens:

```text
equipmentProfile, playerStats, edit, region, accountSynced, accountWarning,
rank, peakRank, collection, skin, loadout, spray, flex, selected, unselected,
overview, details, season, export, emptyData
```

`weaponPistol`, rank crest and Valorant role shields stay game-specific but use
morphable `IconNode` data. Pistol is local; generic symbols use Lucide data.

- [x] **Step 4: Replace direct imports in all eleven Profile files**

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

- [x] **Step 5: Remove Profile files from the source allowlist and run GREEN**

```bash
pnpm exec jest __tests__/profile-icon-motion.test.tsx __tests__/player-info-view.test.tsx __tests__/profile-motion-cold-transition.test.tsx __tests__/app-icon-boundary.test.ts --runInBand
pnpm run typecheck
```

Expected: all tests PASS; the boundary test reports no Profile direct imports.

- [x] **Step 6: Commit**

```bash
git add features/profile components/profile components/ui/app-icon-registry.ts __tests__/profile-icon-motion.test.tsx __tests__/player-info-view.test.tsx __tests__/profile-motion-cold-transition.test.tsx __tests__/app-icon-boundary.test.ts
git commit -m "refactor: migrate profile icons to morphicons"
```

---

### Task 5: Migrate Match, Store and reference-screen icons

**Committed evidence:** `a632fb9` (`refactor: migrate match icons to AppIcon`)
and `f8d11c9` (`refactor: migrate commerce icons to AppIcon`).

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
- Consumes: `AppIconName`, AppIcon and morphable game-specific `IconNode` data.
- Produces: Match/commerce/reference modules with no direct vendor import; state-pair coverage for list-safe icons.

- [x] **Step 1: Write RED state-pair and large-list tests**

Create `__tests__/stateful-icon-pairs.test.tsx`. Cover these transitions:

```text
shop wishlist: heart ↔ heartFilled
item upgrade option: unselected ↔ selected
item upgrade group: collapsed ↔ expanded
economy chart menu: collapsed ↔ expanded
scoreboard sort: sortAscending ↔ sortDescending
match state: refresh ↔ loading
```

The wishlist test asserts one mounted AppIcon changes SVG `fill` from `none` to
the current color; it must not substitute HeartPlus/HeartMinus for selected
state. Render 100 static MatchImage rows and assert no timer, `withRepeat`, or changing
icon prop is created for static empty-state icons.

- [x] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/stateful-icon-pairs.test.tsx --runInBand
```

Expected: FAIL because these files still use vendor icon strings.

- [x] **Step 3: Add exact registry tokens**

```text
sortAscending, sortDescending, wishlist, wishlistFilled, upgrade,
palette, timeline, contract, mission, leaderboardSeason, nightMarket,
crosshair, accessory, bundle, history, match, map, skull, economy,
performance, share, retry, emptyImage, completed, incomplete
```

Round outcome and rank/weapon visuals that encode Valorant taxonomy remain typed
semantic definitions and resolve to morphable vector data. Generic symbols use
Lucide.

- [x] **Step 4: Migrate the nineteen files and typed icon-bearing objects**

Replace vendor-name fields with `AppIconName`. Keep Match/Store API data and
list keys unchanged. One mounted AppIcon changes `name` for each pair above;
static list icons never receive a changing prop.

- [x] **Step 5: Shrink allowlist and run GREEN**

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

- [x] **Step 6: Commit**

```bash
git add app/(authenticated) components/match-detail components/matches components/ui/app-icon-registry.ts __tests__/stateful-icon-pairs.test.tsx __tests__/match-detail-accessibility.test.tsx __tests__/match-card.test.tsx __tests__/app-icon-boundary.test.ts
git commit -m "refactor: migrate match and store icons"
```

---

### Task 6: Migrate Combat, social and Settings icons

**Committed evidence:** `a384b78` (`refactor: complete app icon migration`).

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
- Consumes: completed semantic registry and game-specific morphable vectors.
- Produces: zero direct MaterialCommunityIcons imports in application runtime.

- [x] **Step 1: Write RED interaction tests**

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

- [x] **Step 2: Run RED**

```bash
pnpm exec jest __tests__/combat-social-icon-motion.test.tsx --runInBand
```

Expected: FAIL because the five files still use direct vendor icons.

- [x] **Step 3: Add final registry tokens**

```text
party, ready, cancelReady, connected, disconnected, friendSearch,
chatSend, leaveParty, copyCode, combatLive, combatPregame, lockAgent,
settingsAccount, settingsLanguage, settingsSwap, settingsAbout
```

Keep agent-role shields and crossed-sword game taxonomy behind typed semantic
tokens backed by morphable vectors. Generic symbols use Lucide.

- [x] **Step 4: Migrate all five files and empty the allowlist**

Change dynamic objects such as settings rows and friend-state metadata to
`AppIconName`. Set `remainingLegacyImports` to an empty set. Final bundle
hardening removes the temporary MaterialCommunityIcons allowance from
`components/ui/AppIcon.tsx` as well.

- [x] **Step 5: Run GREEN**

```bash
pnpm exec jest __tests__/combat-social-icon-motion.test.tsx __tests__/combat-screen-lifecycle.test.tsx __tests__/core-accessibility.test.ts __tests__/app-icon-boundary.test.ts --runInBand
pnpm run typecheck
```

Expected: PASS; direct-import count outside AppIcon equals zero.

- [x] **Step 6: Commit**

```bash
git add features/combat/CombatSessionScreen.tsx app/(authenticated)/combat.tsx app/(authenticated)/friends.tsx app/(authenticated)/settings.tsx app/chat/[friendId].tsx components/ui/app-icon-registry.ts __tests__/combat-social-icon-motion.test.tsx __tests__/combat-screen-lifecycle.test.tsx __tests__/core-accessibility.test.ts __tests__/app-icon-boundary.test.ts
git commit -m "refactor: complete app icon migration"
```

---

### Task 7: Release hardening, documentation and device verification

**Task 7 status (2026-09-24):** metadata, final zero-fallback policy, Lucide
deep-ESM isolation and optimized Android export/budget are implemented in the
working tree. Native build, APK/device verification, final commit and push
remain open.

**Files:**
- Modify: `app.json`
- Modify: `package.json`
- Modify: `eas.json`
- Modify: `jest.config.js`
- Modify: `scripts/check-android-export.mjs`
- Modify: `components/ui/AppIcon.tsx`
- Modify: `components/ui/app-icon-registry.ts`
- Modify: `components/ui/app-icon-types.ts`
- Create: `components/ui/app-icon-lucide.ts`
- Create: `types/lucide-icon-modules.d.ts`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `BUILD_DESIGN_SYSTEM.md`
- Modify: `DIRECTORY_STRUCTURE.md`
- Modify: `markdown/11-component.md`
- Modify: `markdown/13-deployment.md`
- Modify: `markdown/14-package.md`
- Modify: `markdown/plans/README.md`
- Modify: `markdown/plans/2026-09-23-morphicons-system-design.md`
- Modify: `markdown/plans/2026-09-23-morphicons-system.md`
- Test: `__tests__/app-icon-boundary.test.ts`
- Test: `__tests__/app-icon-registry.test.ts`
- Test: `__tests__/app-icon.test.tsx`

**Interfaces:**
- Consumes: completed icon migration and the unchanged 12 MiB total / 8 MiB
  Hermes / 1.5 MiB largest-asset budgets.
- Produces: source candidate 4.1.9 (Android 90, iOS 42), a passing optimized
  static Android export and aligned local/EAS optimizer configuration. It does
  not produce or verify a native APK/device runtime.

- [x] **Step 1: Add final source-policy assertions**

Extend `__tests__/app-icon-boundary.test.ts` to assert:

```ts
expect(directMaterialCommunityImports).toEqual([]);
expect(namespaceLucideImports).toEqual([]);
expect(runtimeBarrelImports).toEqual([]);
expect(deepLucideImports).toEqual([
  "components/ui/app-icon-lucide.ts",
]);
expect(directMorphIconImports).toEqual([
  "components/ui/AppIcon.tsx",
]);
```

Extend `__tests__/app-icon.test.tsx` so icon-only labels produce one accessible
node, decorative icons produce none, and `reducedMotion="user"` is immutable.

- [x] **Step 2: Run RED if any migration escaped the boundary**

```bash
pnpm exec jest __tests__/app-icon-boundary.test.ts __tests__/app-icon.test.tsx --runInBand
```

Expected: PASS only when all direct imports and accessibility leaks are removed;
otherwise fix the reported exact files before continuing.

Observed 2026-09-24: the earlier Task 7A policy was GREEN, then bundle hardening
removed the remaining AppIcon MaterialCommunityIcons branch and tightened the
Lucide boundary. Final full-suite evidence is recorded in Step 5.

- [x] **Step 3: Update native version metadata**

Set:

```text
package.json version = 4.1.9
app.json expo.version = 4.1.9
app.json expo.android.versionCode = 90
app.json expo.ios.buildNumber = 42
```

This creates a new app-version runtime for the native dependency. It prevents
the new `react-native-svg`-dependent JavaScript from being published to the
4.1.8 runtime via OTA.

- [x] **Step 4: Update documentation**

Document:

- AppIcon semantic boundary and zero-fallback ownership;
- Morphicons/Lucide/react-native-svg dependency chain;
- exact-version Lucide deep ESM boundary, local Pistol `IconNode` and Jest
  `.mjs` transform;
- Reduce Motion and accessibility rules;
- state-pair policy and game-specific exceptions;
- optimized graph/tree-shaking parity across local export, EAS build profiles
  and the EAS production update environment;
- native rebuild/runtime boundary;
- exact source/device/bundle evidence and any NOT VERIFIED item.

Run Mermaid/link validation:

```bash
node .codex-tmp/diagram-validation/validate.mjs
```

- [x] **Step 4A: Run the scoped Task 7A source gates**

Task 7A deliberately stops before the full app/export/build gate:

```bash
pnpm exec jest __tests__/app-icon-boundary.test.ts __tests__/app-icon.test.tsx --runInBand
pnpm run typecheck
pnpm exec eslint components/ui/AppIcon.tsx components/ui/app-icon-types.ts components/ui/app-icon-registry.ts __tests__/app-icon-boundary.test.ts __tests__/app-icon.test.tsx --max-warnings=0
node .codex-tmp/diagram-validation/validate.mjs
git diff --check
```

Expected: both targeted suites, strict TypeScript, scoped zero-warning ESLint,
all Mermaid/local-link validation and whitespace checks pass. Do not run
`pnpm run check`, export or build as part of Task 7A.

Observed 2026-09-24: 2 suites / 9 tests PASS; strict TypeScript PASS; scoped
ESLint PASS with zero warnings; metadata 4.1.9/90/42 PASS; 21 Mermaid diagrams
and 138 local links PASS; `git diff --check` PASS.

- [x] **Step 5: Run complete source and Android export gates**

```bash
pnpm run check
git diff --check
git status --short
```

Observed 2026-09-24:

1. The first `pnpm run check` attempt passed strict TypeScript, zero-warning
   ESLint, production audit policy and 87 Jest suites / 909 tests, then failed
   the unchanged Hermes budget at 8.79/8.00 MiB. The entire invocation is not
   labelled PASS.
2. Isolating Lucide runtime deep ESM imports in `app-icon-lucide.ts` reduced
   Hermes to 8.26 MiB, still over budget.
3. `check:android` with `EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1` and
   `EXPO_UNSTABLE_TREE_SHAKING=1` passed at 10.16/12 MiB total,
   7.69/8 MiB JS/Hermes and 1.25/1.50 MiB largest asset.
4. `pnpm dlx expo-doctor` passed 20/21 checks. The only failure is the existing
   SDK 57 patch-alignment warning for six Expo packages, each one patch behind
   Doctor's current recommendation; it remains recorded rather than silently
   upgraded inside the icon migration.
5. After deleting the unused `playerPerformanceStats` vendor-glyph return
   surface, the final `pnpm run check` passed 87 suites / 910 tests, production
   audit policy and the same 10.16/12 MiB total, 7.69/8 MiB Hermes and
   1.25/1.50 MiB largest-asset gates.

- [x] **Step 5A: Align build and update optimizer environments**

- `scripts/check-android-export.mjs` supplies both optimizer variables to the
  local/CI Expo export.
- `eas.json` supplies the same values to development, preview and production;
  `production-store` inherits them from production.
- The EAS project `@hyeon004/vshop` production environment has been set and
  verified with both values as plaintext variables. Future
  `eas update --environment production` therefore uses the same optimizer.
- Environment parity does **not** make 4.1.9 OTA-compatible with binary/runtime
  4.1.8. No 4.1.9 OTA may be published to that runtime; a new native binary is
  still required and remains unverified.

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
