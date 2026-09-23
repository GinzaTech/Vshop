# Act Recording Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide every pre-baseline Act and record only Competitive matches observed from the per-account activation timestamp forward.

**Architecture:** A small account-scoped recording repository persists the immutable timestamp and one-time active-season binding in `appStorage`. Match state mirrors that identity to invalidate legacy season caches; history actions filter archive writes and season actions filter options, clamp the start window, reject legacy aggregates, and disable full-Act MMR fallback for the baseline Act.

**Tech Stack:** TypeScript strict, Zustand persist, MMKV/appStorage, existing SQLite match archive, Jest, React Native/Expo SDK 57.

**Spec:** `markdown/plans/2026-09-23-act-recording-baseline-design.md`

**Status:** source complete; Android/live Riot verification is `NOT VERIFIED`
because the device disconnected from ADB before the final pass.

## Global Constraints

- Baseline is per `authKey`, immutable after creation, and contains no credential.
- Current Act starts at zero; only `GameStartTime >= startedAt` is recorded or counted.
- Legacy archives are hidden and ignored, never physically deleted.
- Future Acts remain selectable after they end.
- Start-season MMR fallback is forbidden because it includes pre-baseline games.
- Transient failures preserve good data, are sanitized, and are recorded in `markdown/ACT_RECORDING_REPORT.md`.
- No purchase, party, queue, agent-lock, loadout mutation or new Riot endpoint.
- Use `pnpm`; strict TypeScript; no `any`; no destructive Git command.

## Review Focus

- Two concurrent first requests for one account must produce one timestamp and one write.
- An account switch during storage/content awaits must publish nothing into the new account.
- Corrupt baseline JSON must fail closed without exposing legacy seasons or crashing UI.
- A Riot Act boundary after baseline must retain the recorded previous Act and select the new active Act.
- Legacy current-Act stats/archive records without the matching baseline marker must never reappear.

---

### Task 1: Recording policy repository and pure filters

**Files:**
- Create: `services/matches/match-recording-core.ts`
- Create: `services/matches/match-recording-storage.ts`
- Create: `services/matches/match-recording.ts`
- Create: `__tests__/match-recording.test.ts`
- Test: `__tests__/match-recording.test.ts`

**Interfaces:**
- Produces:
  - `MatchRecordingBaseline`
  - `createMatchRecordingRepository(driver)`
  - `loadMatchRecordingBaseline(accountKey)`
  - `ensureMatchRecordingBaseline(accountKey, now?)`
  - `bindMatchRecordingStartSeason(accountKey, seasonId)`
  - `filterRecordedSeasonOptions(seasons, baseline)`
  - `filterRecordedMatches(matches, baseline)`
  - `getRecordedSeasonStartTime(season, baseline)`
  - `isRecordingStartSeason(season, baseline)`

- [x] **Step 1: Write failing repository/filter tests**

```ts
const driver = memoryDriver();
const repository = createMatchRecordingRepository(driver);
const [left, right] = await Promise.all([
  repository.ensure("ap|a", 1_000),
  repository.ensure("ap|a", 2_000),
]);
expect(left?.baseline.startedAt).toBe(1_000);
expect(right?.baseline.startedAt).toBe(1_000);
expect(driver.write).toHaveBeenCalledTimes(1);

await repository.bindSeason("ap|a", "act-current");
await repository.bindSeason("ap|a", "act-other");
expect((await repository.load("ap|a"))?.startSeasonId).toBe("act-current");

expect(filterRecordedMatches([oldMatch, newMatch], baseline))
  .toEqual([newMatch]);
expect(filterRecordedSeasonOptions(options, baseline).map(({ id }) => id))
  .toEqual(["future-act", "act-current"]);
```

- [x] **Step 2: Run RED test**

Run: `pnpm exec jest __tests__/match-recording.test.ts --runInBand`
Expected: FAIL because `match-recording-core.ts` does not exist.

- [x] **Step 3: Implement the core repository**

```ts
export type MatchRecordingBaseline = {
  accountKey: string;
  schemaVersion: 1;
  startedAt: number;
  startSeasonId: string | null;
};

export type MatchRecordingRepository = {
  load(accountKey: string): Promise<MatchRecordingBaseline | null>;
  ensure(accountKey: string, now?: number): Promise<{
    baseline: MatchRecordingBaseline;
    created: boolean;
  } | null>;
  bindSeason(
    accountKey: string,
    seasonId: string
  ): Promise<MatchRecordingBaseline | null>;
};
```

Normalize/lowercase account and season IDs, reject guest/empty/non-finite data,
serialize account writes through a `Map<string, Promise<void>>`, and parse JSON
with exact schema/account validation.

- [x] **Step 4: Implement appStorage adapter/facade**

```ts
const storageKey = (accountKey: string) =>
  `match-recording-baseline-v1:${encodeURIComponent(accountKey)}`;

export const loadMatchRecordingBaseline = repository.load;
export const ensureMatchRecordingBaseline = repository.ensure;
export const bindMatchRecordingStartSeason = repository.bindSeason;
```

- [x] **Step 5: Run GREEN test and scoped quality gates**

Run: `pnpm exec jest __tests__/match-recording.test.ts --runInBand`
Expected: PASS for idempotency, concurrency, bind-once, account isolation,
malformed storage, season filtering, timestamp clamp and match filtering.

Run: `pnpm run typecheck`
Expected: PASS.

Run: `pnpm exec eslint services/matches/match-recording*.ts __tests__/match-recording.test.ts --max-warnings=0`
Expected: PASS with zero warnings.

- [x] **Step 6: Record checkpoint**

Append Task 1 RED/GREEN evidence to `markdown/ACT_RECORDING_REPORT.md`. Do not
commit yet: the active checkout contains the user-approved integrated UI/UX
baseline and will receive one final conventional commit after the whole gate.

### Task 2: Mirror baseline in Match state and filter archive writes

**Files:**
- Modify: `features/matches/store-types.ts`
- Modify: `hooks/useMatchStore.ts`
- Modify: `features/matches/history-actions.ts`
- Modify: `features/matches/request-runtime.ts`
- Modify: `__tests__/match-store.test.ts`
- Test: `__tests__/match-store.test.ts`

**Interfaces:**
- Consumes Task 1 `ensureMatchRecordingBaseline`, `loadMatchRecordingBaseline`,
  `filterRecordedMatches` and `MatchRecordingBaseline`.
- Produces persisted `recordingStartedAt: number` and
  `recordingStartSeasonId: string | null` on `MatchState`.

- [x] **Step 1: Write RED store/history tests**

```ts
expect(emptyMatchCache()).toMatchObject({
  recordingStartedAt: 0,
  recordingStartSeasonId: null,
});

await useMatchStore.getState().fetchMatches(user, true);
expect(archiveObservedMatches).toHaveBeenCalledWith(
  authKey,
  expect.arrayContaining([expect.objectContaining({ MatchID: "after" })])
);
expect(archiveObservedMatches).not.toHaveBeenCalledWith(
  authKey,
  expect.arrayContaining([expect.objectContaining({ MatchID: "before" })])
);
```

Add a baseline mismatch case proving legacy `seasonStatsById`,
`seasonMatchesById`, `seasonOptions` and `seasonStats` are cleared exactly once
while global `matches` remain.

- [x] **Step 2: Run RED test**

Run: `pnpm exec jest __tests__/match-store.test.ts --runInBand`
Expected: FAIL because Match state has no recording fields and archive writes are
not timestamp-filtered.

- [x] **Step 3: Add persisted state fields and migration defaults**

```ts
recordingStartedAt: number;
recordingStartSeasonId: string | null;
```

Include both fields in `emptyMatchCache`, `PersistedMatchState`,
`MatchCacheSnapshot`, `migrate`, `partialize`, `captureMatchCache` and account
snapshot restore. Missing old values migrate to `0`/`null` without changing
`MATCH_STORE_VERSION`.

- [x] **Step 4: Ensure and synchronize baseline in history actions**

After `runtime.begin(user)`:

```ts
const result = await ensureMatchRecordingBaseline(authKey);
if (!scope.isCurrent() || !result) return false;
syncRecordingBaseline(set, get, result.baseline);
```

`syncRecordingBaseline` clears only season caches when `startedAt` differs.
Every `archiveObservedMatchesSafely` loads the baseline and passes only
`filterRecordedMatches(matches, baseline)`; empty filtered batches are skipped.

- [x] **Step 5: Run GREEN test and scoped gates**

Run: `pnpm exec jest __tests__/match-store.test.ts __tests__/account-session.test.ts --runInBand`
Expected: PASS, including stale-account cancellation and rollback snapshots.

Run: `pnpm run typecheck`
Expected: PASS.

- [x] **Step 6: Record checkpoint**

Append Task 2 evidence and any skipped non-blocking failures to
`markdown/ACT_RECORDING_REPORT.md`; defer commit to final integration.

### Task 3: Filter Profile seasons and clamp statistics to baseline

**Files:**
- Modify: `types/match-ui.ts`
- Modify: `services/matches/match-archive-core.ts`
- Modify: `features/profile/profile-season-data.ts`
- Modify: `features/matches/season-actions.ts`
- Modify: `__tests__/profile-season-data.test.ts`
- Modify: `__tests__/match-archive.test.ts`
- Modify: `__tests__/match-store.test.ts`

**Interfaces:**
- Consumes Task 1 repository/helpers and Task 2 Match state mirror.
- Produces `SeasonPerformanceStats.recordingStartedAt?: number` and filtered
  `seasonOptions`, `seasonStatsById`, `seasonMatchesById`.

- [x] **Step 1: Write RED season/window/archive tests**

```ts
expect(resolveProfileSeasonTimeWindow(options, "start", baseline)).toEqual({
  startTimeMs: baseline.startedAt,
  endTimeMs: Date.parse("2026-10-01T00:00:00Z"),
});

expect(startSeasonStats.recordingStartedAt).toBe(baseline.startedAt);
expect(mockGetCompetitiveMMR).not.toHaveBeenCalled();
expect(state.seasonOptions.map(({ id }) => id)).toEqual([
  "future",
  "start",
]);
```

Add cases for pre-baseline update rows, future-Act MMR fallback, legacy archive
stats without marker, matching marker reuse, content failure with preserved good
filtered cache, and reverse-order responses after account switch.

- [x] **Step 2: Run RED tests**

Run: `pnpm exec jest __tests__/profile-season-data.test.ts __tests__/match-archive.test.ts __tests__/match-store.test.ts --runInBand`
Expected: FAIL on unclamped window, unfiltered options and legacy aggregate reuse.

- [x] **Step 3: Extend stats/archive validation**

```ts
export type SeasonPerformanceStats = {
  recordingStartedAt?: number;
};
```

Archive validation accepts the field only when omitted or finite/non-negative.
Stats produced by the new policy are stamped with the current baseline timestamp.

- [x] **Step 4: Integrate baseline into season action**

1. Ensure/synchronize baseline before reading season caches.
2. Fetch Riot content; on success bind active season and filter options.
3. On content failure, retain only cached options allowed by baseline and log the
   sanitized failure; throw only if no usable selected season exists.
4. Clamp start-season `startTimeMs` to `baseline.startedAt`.
5. Stop update pagination after crossing the clamped start timestamp.
6. Filter archive matches by timestamp and trust archive stats only when
   `recordingStartedAt === baseline.startedAt`.
7. Never call MMR fallback for the baseline start season.
8. Stamp and save every published stats snapshot with `recordingStartedAt`.

- [x] **Step 5: Run GREEN tests and coverage**

Run: `pnpm exec jest __tests__/profile-season-data.test.ts __tests__/match-archive.test.ts __tests__/match-store.test.ts --runInBand --coverage`
Expected: all named cases PASS; transformed recording modules remain at least
80% line coverage.

Run: `pnpm run typecheck`
Expected: PASS.

- [x] **Step 6: Record checkpoint**

Append Task 3 evidence and skipped failures to the report; defer commit.

### Task 4: UI contract, migration report and integrated verification

**Files:**
- Modify: `components/profile/PlayerInfoView.tsx`
- Modify: `__tests__/player-info-view.test.tsx`
- Create: `markdown/ACT_RECORDING_REPORT.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `markdown/plans/2026-09-22-ui-ux-quality-roadmap.md`

**Interfaces:**
- Consumes filtered season state from Task 3.
- Produces user-visible one-season/future-season behavior and final evidence.

- [x] **Step 1: Write RED UI tests**

```tsx
renderer = create(
  <PlayerInfoView {...baseProps} seasonOptions={[currentOnly]} />
);
expect(renderer.root.findAllByProps({
  testID: "profile-season-selector",
})).toHaveLength(0);
expect(renderer.root.findByProps({
  testID: "profile-season-current",
}).props.accessibilityState.selected).toBe(true);
```

Add a future-season case preserving tab semantics and selection callbacks.

- [x] **Step 2: Run RED UI test**

Run: `pnpm exec jest __tests__/player-info-view.test.tsx --runInBand`
Expected: FAIL if the one-season state still exposes legacy calendar controls or
lacks a semantic current-season summary.

- [x] **Step 3: Implement minimal UI adaptation**

Keep the compact season header for one Act, omit horizontal chip history until
at least two allowed seasons exist, and preserve existing eight-Act overflow
behavior for future recorded Acts. Do not create fabricated metrics.

- [x] **Step 4: Write/update report and project docs**

`markdown/ACT_RECORDING_REPORT.md` must include:

```markdown
## Completed
- baseline repository — command: `pnpm exec jest __tests__/match-recording.test.ts --runInBand`; status and counts copied from the command output

## Skipped or failed
- live Riot account migration: NOT_VERIFIED — saved session expired; demo and
  source evidence only

## Final gates
- `pnpm run check` — status, suite/test counts and export size copied from final output
- Android device — exact package/version, interaction result and remaining limitation
```

Update README/CHANGELOG/roadmap with the reset-from-now contract and explicitly
state that legacy archive rows are retained but hidden.

- [x] **Step 5: Run full gates**

Run: `pnpm run check`
Expected: strict TypeScript, zero-warning ESLint, all Jest suites, production
audit and Android export budget PASS.

Run: `git diff --check`
Expected: PASS (line-ending warnings allowed; no whitespace errors).

Run: secret scan over tracked/untracked source excluding `.git`,
`node_modules`, `.codex-tmp`.
Expected: no credential/private-key matches.

- [ ] **Step 6: Device verification**

Install/retain development client `4.1.8 (89)`, run the credential-free Profile
demo, confirm one-season summary after baseline fixture and multi-future-Act
overflow fixture. Restore animation scales to `1.0`. If live Riot auth remains
expired, mark live migration `NOT_VERIFIED` and continue as authorized.

- [x] **Step 7: Final review and commit**

Review the complete diff and report. Fix Critical/Important findings with a new
RED/GREEN test; list Minor findings in the report. Then create one conventional
commit for the approved integrated work:

```bash
git add -A
git commit -m "feat: record profile acts from a local baseline"
```

Push only after the full gate is green and the report contains every skipped or
unverified item.
