# More glass correction after visual rejection

**Superseded:** the user later rejected gray waves, expanded glass to all14
groups, required a white More background and a black glass navbar, and deferred
physical tests. Final source/evidence is in [white More handoff](2026-10-04-white-more-black-nav-final.md).

The user rejected the previous ten shortcut cards: white 88% transmission on
an almost-white backing field looks like an ordinary white card. The earlier
source-test success did not establish the requested visual result.

## Accepted correction

Keep the ten shortcuts, labels, routes, touch targets and four lower flat groups.
Create a continuous neutral silver light field behind the grid. Use one native
Skia canvas to render rounded glass lenses over that field: sample the same
procedural field at refracted coordinates, with mild magnification, softened
transmission, a bright top/left bevel and a darker lower edge. Render text/icons
in ordinary native views above the canvas. The glass tint is deliberately low,
not the former88% white. Static shader: no timers or perpetual animation.

The background is a defined decorative plane, not a capture of application
text/images. Report this precisely; do not claim arbitrary screen sampling.
No new native module, bitmap asset or dependency is required. Use existing
design-system colors and a scoped material token. One canvas per finite grid,
unmounted while hidden/backgrounded; Reduce Transparency gets opaque cards.
Web/unsupported/failed shader keeps a visible vector fallback. Reduce Motion
does not disable a static material. Bounds follow measured layout, not guessed
screen coordinates, so wrapping labels and different widths remain aligned.

## Acceptance

- [ ] RED/GREEN measured geometry, low tint, single renderer, visibility/resource
  cleanup, native sharp labels, existing route/account/switch actions.
- [ ] Real shader compiles and draws on45218ba / QA92; screenshot visibly differs
  from the rejected white cards, with continuous light visibly bent at edges.
- [ ] Nine route entries and Update dialog; VI/EN/VI and retained Profile ranks.
- [ ] Bounded warm scroll/navigation gfx record, Reduce Transparency fallback,
  type/lint/tests/Android export; preserve separate audit/coverage limitations.
- [ ] Independent source review and actual image critique; no visual acceptance
  inferred from a component being named GlassCard or from unit tests alone.
