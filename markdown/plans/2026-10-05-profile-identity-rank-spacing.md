# Profile identity and rank spacing

User requests removing the account-level text under the motto, lowering the
motto section and lifting current/peak rank headings away from their rank values.
Keep the equipped artwork at one-third width/120dp height, its existing level
badge, all card/title picker callbacks, balances and current native materials.

Bounded implementation: remove only the redundant account-level text; place
identity metadata with space between card name and motto, including a small
minimum gap. Add4dp between static rank heading and value; centered content lifts
the heading2dp and retains the64dp normal card with two-line fitted rank values.
No animated act-layer, network or account-mutating changes.

- [x] Before screenshot/actual hierarchy inspected and RED before source edits.
- [x] Identity footer removed, motto lower and rank heading/value spacing added.
- [x] Scoped regressions and independent source review.
- [x] Final source checks and Android export attempted with explicit outcomes.
- [x] Main Expo physical after capture and picker open/dismiss without selection.

Evidence is outside Git under C:/Users/kona/.codex/artifacts/vshop-profile-spacing-20261005/.
red.log captured6 behavior failures/18 preservation passes before application edits.
green.log records61/61 tests in6 suites PASS after the complete import/layout fix.
Independent source review found no blocker in callbacks/spacing/font fitting.
Final check.log: TypeScript/lint PASS,212suites/2936tests PASS,109.456s;
overallcheck FAIL only at existing braces1240992 audit. Coverage75.51% below80%.
Separate export.log PASS9.17/12MiB total,7.86/8MiB Hermes,0.92/1.5MiB largest;
temporary output removed. Diffcheck PASS.

Main Expo after capture completed after restarting Metro with clear cache and
reopening the observed recent localhost server in the development launcher.
The initial reload stayed blank and the first cold capture had intrinsic-text
clipping; the warm complete reload produced the final fully readable screenshot.
profile-after.png/XML and native-spacing.json verify no account footer, retained
art level badge, unchanged card name position, motto label lower1421→1463px
(16dp at2.625 density), headings higher888→883px (~2dp), heading-to-rank-text
gap8→18px (~4dp more). Title picker opened and dismissed without selection.
Device/default-font proof applies to these captured views; large-font physical
acceptance is not inferred from the source fitting tests.
