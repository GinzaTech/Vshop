# Act Recording Implementation Report

**Plan:** `markdown/plans/2026-09-23-act-recording-baseline.md`
**Spec:** `markdown/plans/2026-09-23-act-recording-baseline-design.md`
**Status:** source complete; device migration not verified

## Decision

The implementation uses reset-from-now semantics per account. Legacy archive
rows are retained physically but excluded from Profile seasons and new
statistics.

## Completed

- Design/spec: PASS — reviewed for placeholders, account isolation, race,
  migration and failure behavior.
- Implementation plan: PASS — four TDD tasks with exact interfaces and gates.
- Task 1 baseline repository: PASS — `pnpm exec jest
  __tests__/match-recording.test.ts --runInBand` passed 6/6. Coverage for the
  core reached 94.31% statements, 82.60% branches, 95% functions and 97.5%
  lines; typecheck and scoped lint passed.
- Task 2 Match state/archive integration: PASS — `match-store` and
  `account-session` passed 95/95; typecheck and scoped lint passed. Legacy
  season caches reset on baseline mismatch, global match history remains, and
  archive writes include only post-baseline records.
- Task 3 season integration: PASS — 97/97 targeted tests. Season actions reached
  92.91% lines, profile-season helpers 100% lines and recording core 97.5%
  lines. Current baseline Act clamps to the local timestamp, legacy archives
  require the matching marker, old options are hidden and start-Act MMR is
  disabled.
- Task 4 UI contract (source): PASS — one-season summary hides the horizontal
  history row; the existing eight-Act future overflow fixture remains selectable.
- Task 4 documentation: PASS — README, changelog, roadmap, architecture index
  and every affected Mermaid view now describe the account baseline, hidden
  legacy rows and future-Act behavior. Validation parsed 21 Mermaid blocks and
  resolved 134 local links.
- Production bundle policy: PASS — DEV-only Profile/Match fixtures resolve to
  one empty fail-closed module when `context.dev` is false. Development and Jest
  retain the full fixtures; production export dropped to 2,999 modules and met
  the unchanged 8 MiB Hermes budget.

## Skipped or failed

- Task 2 intermediate `match-store.test.ts`: FAILED once by 5-second timeout in
  the legacy asset-preload ownership case. Cause: the new baseline storage await
  let the second request consume the mocked deferred asset promise before the
  first request entered asset loading. Resolution: flush the first request to
  the intended suspension point; behavior coverage remains the same. Re-run is
  PASS under Task 2 completion.
- First integrated gate: FAILED after 820/820 tests because branch coverage for
  `features/matches/season-actions.ts` was 79.32%, below the 80% critical-file
  floor. Added the missing one-time active-Act binding case; the targeted result
  became 73/73 tests and 80.82% branches, then the complete run passed.
- Second integrated gate: FAILED Android export because Hermes was 8.01 MiB
  against the unchanged 8.00 MiB limit. The limit was not relaxed. Metro now
  replaces unreachable DEV fixture imports with one empty production module;
  the final export passed at 10.47 MiB total and 8.00 MiB Hermes.
- Android device verification: **NOT VERIFIED**. `adb devices -l` returned no
  connected device and the previous Metro process was no longer running. The
  one-season deep link and real Riot-account migration therefore were not
  inferred from component tests or earlier multi-Act device evidence.
- Live Riot account migration: **NOT VERIFIED** for the same disconnected-device
  condition; the previously saved session was also not reusable. No account
  mutation or unsafe endpoint was attempted.
- First push attempt: FAILED in ECC's parallel `pnpm test` hook when the first
  About lifecycle case exceeded Jest's 5-second timeout under full-suite CPU
  contention. The canonical `pnpm run check` had already passed in-band; an
  immediate isolated rerun passed all 53 account-screen cases in 4.116 seconds
  and the formerly timed-out case itself completed in 905 ms. No hook bypass or
  timeout relaxation was used; the push is retried with the same checks.

## Final gates

- `pnpm run check`: PASS — strict TypeScript, zero-warning ESLint, 79/79 Jest
  suites and 821/821 tests, production audit policy and Android export/budget.
- Critical branch coverage: PASS — `season-actions.ts` 80.82%; recording core
  82.60%; all transformed match modules remained above their configured floors.
- Production dependency audit: PASS with six documented transitive advisories;
  no new direct production vulnerability blocked the policy.
- Android export: PASS — 10.47 MiB total, 8.00 MiB Hermes and 1.25 MiB largest
  asset; temporary export directories from the gate were removed automatically.
- `git diff --check`: PASS. Added-line secret scan: PASS.
- Android development-client and live-account execution: **NOT VERIFIED** due
  to ADB disconnection, as recorded above.
- Commit: PASS — one conventional integrated commit was created after the green
  gates, diff review, secret scan and large-file scan. Push remains a handoff
  action and is reported by the final task response rather than predicted here.
