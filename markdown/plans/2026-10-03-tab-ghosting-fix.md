# Tab ghosting observed during full mobile testing

User reports faded/shadowed previous UI during tab changes. Primary navigation
selection/geometry passes, but physical captures also show occasional previous
glyph inside the active lens. These are distinct visual acceptance failures.

## Intended change

Preserve mounted/preloaded primary content and existing glass navigation,
indicator travel and icon motion. A committed primary tab owns one fully opaque
content scene immediately; do not blend two independent text/list hierarchies or
delay the new scene behind the moving indicator. Touch/accessibility belong to
that committed scene. Retained inactive content stays mounted, invisible and
inert. Secondary-route entrance can retain its existing isolated fade.

Record native before/after transition clips and settled frames on45218ba/QA92,
with exact Metro source identity. Test rapid retargeting, mounted scene state,
live Reduce Motion and one transitionEnd per committed primary change. Diagnose
the active-glyph snapshot separately, keeping any timing claim evidence-bound.

## Tasks

- [x] Capture physical baseline, using only QA-owned windows and no account writes.
- [x] RED regression pins single opaque primary destination and no vector fade.
- [x] Implement primary visibility handoff and independently review lifetime/events.
- [x] Verify physical after clip/navigation/settled glyphs; keep comparable timing scope.
- [x] Continue full26-route mobile testing and final source/export gates.

Evidence: external `vshop-mobile-full-20261003` clips, sampled filmstrips and
62-test source result. Subsequent mobile changes/results are tracked separately
in `markdown/ui-quality/MOBILE_FULL_TEST_RESULTS.md`; no release FPS claim.
