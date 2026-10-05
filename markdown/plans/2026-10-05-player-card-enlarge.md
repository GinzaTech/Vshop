# Equipped player-card width correction

Latest user clarification supersedes the vertical enlargement: restore the old
120dp artwork height and enlarge the image horizontally to one third of
the equipped-card row. Use33.333333% width, leave two thirds for native metadata,
and keep hero/ranks and picker grid unchanged.
Keep readable two-line card/title text, native48dp targets, level badge, cached
artwork/fallback and existing player-card/player-title picker owners. Allow
metadata its natural height rather than clipping it.

Before screenshot: external vshop-test-20261005-followup/reloaded.png.

Latest steering after the112x148 screenshot: extend the card vertically again,
keeping112dp width and increasing height to180dp was an intermediate interpretation.
The user rejected it and explicitly clarified horizontal width;112x180 is now
superseded by one-third width and120dp height.

- [x] Rendered identity regression before source edit; preserve both fallback
  states, cached art and exact picker callbacks.
- [x] Enlarge portrait and preserve bounded native metadata layout.
- [x] Scoped tests and independent source review.
- [x] Final full source/export checks executed after source freeze; baseline
  audit failure remains reported below.
- [x] Reload main Expo and capture physical equipped-card appearance.

External vshop-test-20261005-followup/: player-card-red.log recorded3 failures
before112x148 implementation; player-card-taller-red.log recorded2 failures
before the additional180dp height. latest-scoped-green.log134/134 tests in8
suites PASS. Read-only review approved cache/fallback/callback preservation.
Intermediate native portrait hitbox294x472px matched112x180dp at2.625 density,
before the user rejected the vertical interpretation. Final profile-after.png/XML
show the restored-height horizontal image, metadata and complete VP/RP/KC/AP.
Final portrait hitbox330x315px confirms about one third of the row and120dp
height at2.625 density. player-card-third-red.log records2 failures before the
latest correction; final-third-scoped-green.log119/119 tests in6 suites PASS.
interactions.json records a successful Profile mode
round-trip with currency labels retained; no actual equip action was taken.

Final one-third snapshot: TypeScript/lint PASS,212suites/2936tests PASS,
109.065s; overallcheck FAIL at existing braces1240992, coverage75.51% below80%.
Independent Android export PASS9.17/12MiB total,7.86/8MiB Hermes,0.92/1.5MiB
largest; temporary output removed. Diffcheck PASS. Exact logs are
check-third-final.log and export-third-final.log in the external directory.
