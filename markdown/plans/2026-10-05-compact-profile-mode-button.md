# Smaller Profile equipment-mode button

User asks to reduce the Hồ sơ trang bị button only. At normal text, reduce the
visual pill from176x48 to144x36dp while retaining a48dp-high native press target.
Keep the24dp icon thumb, two-line fitted label, both36dp thumb-end reserves,
existing callback/transition lock/colors and Reduce Motion behavior.

Render an inert centered visual surface inside the retained press target; do not
scale the touch owner or shrink text below the existing fitting limit. Long
translations/large system fonts may grow the pill within the available viewport
so labels remain readable. Existing region and Profile layout remain owners.

- [x] Observe/capture main Expo before and write behavior RED before code.
- [x] Smaller visual surface with retained native target and thumb geometry.
- [x] Scoped fitting/callback/transition tests and independent source review.
- [ ] Full source/export checks and exact outcomes (Main-owned handoff).
- [ ] Main Expo after screenshot and info/equipment round-trip (Main-owned handoff).

External evidence: C:/Users/kona/.codex/artifacts/vshop-compact-mode-20261005/.

## Worker scope and RED evidence

Own only `features/profile/ProfileHeroCard.tsx`,
`features/profile/profile-screen.styles.ts`,
`__tests__/profile-header-text-fit.test.tsx` and this plan. Preserve all existing
material, navigation, identity, footer and rank-spacing edits. Main owns full
source/export checks and native after capture; this worker runs scoped tests,
owned-file lint and diff check only, per the explicit handoff.

Main's handoff confirms ARTEMIS explored the actual current Profile before test
authoring. The before capture is `profile-before.png` with its XML in the external
evidence directory.

RED completed before application code edits:
`pnpm exec jest --runInBand --runTestsByPath __tests__/profile-header-text-fit.test.tsx`
failed with 7 failures / 6 passes. Normal Vietnamese at 320/411dp reports width
176 instead of 144; long localized labels lack the requested growth at normal and
large font scales. Full output: `profile-compact-red.log` in the evidence directory.
The new assertions cover the actual colored surface, retained 48dp tap owner,
24dp centered thumb, two-line fitting at minimum scale 0.7 and both 36dp end
reserves. No application source was edited before this RED run was recorded.

## Implementation and scoped GREEN

Normal Vietnamese renders a 144x36dp inert colored surface centered with a 6dp
top inset inside the unchanged 48dp-high native press target. The thumb stays
24x24dp, centered at top 12dp in the hit target. Only the inner surface receives
the existing animated background color. Both label slots keep their 36dp end
reserves, two-line fitting and minimum scale 0.7.

Width uses the larger of the scaled 144dp baseline and an estimate for the longer
of the two localized labels, capped at `width - 64` for supported viewports.
Using both labels keeps width stable during the mode transition. Visual height
can grow for large system fonts; the native target remains at least 48dp high.
Callback, transition locking, colors and existing hero/rank behavior are retained.

Scoped GREEN: 8 suites / 88 tests passed using `pnpm exec jest --runInBand
--runTestsByPath` for profile-header-text-fit, profile-rank-cards,
profile-picker-responsive, profile-picker-geometry, profile-picker-blur,
profile-picker-crisp-content, profile-picker-glass-compact and
profile-icon-motion. Full output is `profile-compact-green.log` in the external
evidence directory.

Owned-file ESLint passed with `--max-warnings=0`. Scoped `git diff --check` passed
for both tracked source files (exit 0). `git diff --no-index --check -- NUL <file>`
reported no whitespace errors for the untracked test and plan (exit 1 reflects
their content difference from NUL). Git's LF/CRLF notices are conversion warnings.

Independent reviewer approved the scoped source change with no actionable
findings. Review checked visual/tap geometry, stable label allocation across
modes, both thumb endpoint reserves, the initial info-label/hero-progress-zero
state, unchanged callbacks/signatures and transition/accessibility locking.

Native after screenshot, round-trip interaction, full repository gates and
Android export are NOT VERIFIED by this worker and remain with Main. Renderer
tests validate styles and callback wiring; they do not measure native glyph
layout, native hitboxes or transition frames. Keep the remaining acceptance
criteria open until evidence exists; the before image and source assertions do
not prove the native result.

Main final source snapshot includes later viewer/scroll changes: TypeScript/lint
PASS,217suites/3021tests PASS60.425s; overallcheck FAIL only at existing
braces1240992 and statement coverage below80%. Android export PASS9.18/12MiB,
Hermes7.87/8MiB, largest0.92/1.5MiB; temp removed, diffcheckPASS. Current native
hierarchy shows the visual label narrower than the previous button while retaining
the full hit target, but round-trip screenshot acceptance remains pending because
another application owns the phone foreground.
