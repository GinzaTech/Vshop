# New VShop launch interface

## Accepted brief

The user rejected the icon-only simplification and explicitly selected a new
interface with icon, minimal loading status, progress and smooth effects.
This supersedes the normal-mode visual criterion in the earlier icon-first plan.
No additional design approval gate: implementation and physical testing are authorized.

## Design decision

Use the existing light BACKGROUND, white SURFACE, charcoal ACCENT_DEEP and
TEXT_PRIMARY/TEXT_SECONDARY tokens. A new original cart mark is the only focal
illustration. Center a compact vertical composition: generous mark, VShop name,
short localized status, thin progress rail and completed-stage count. Use system
sans typography, strong app name and readable 14sp status; no new fonts/network
dependencies. The visual must read as the VShop cart identity rather than a
generic spinner or a gallery of loading cards.

Progress represents completed bootstrap stages, never elapsed time or a made-up
network percentage: prepare -> session -> core data -> ready. No timer advances
the indicator. Retry/session renewal may legitimately move back a stage.
Only opacity and transform animate, using existing motion tokens and live
Reduce Motion. No added minimum dwell, perpetual animation or UI-thread blur.
Keep native splash and JS mark/background/size aligned; rebuild the isolated QA
APK if the native image changes. Keep actionable error/cache/update recovery.

## Execution and evidence

- [x] Generate cart mark and retain prompt, original and optimized PNG.
- [x] Add phase model and tests, localized launch composition and controlled
  progress/entrance; connect real bootstrap events.
- [x] Verify source phase progress, live Reduce Motion, retry, image readiness and
  native release/handoff guards. Keep header boundary fix discovered on device.
- [x] Inspect normal/data/recovery on physical device; run guarded picker cases
  and repeated cycles after writes settle. Record APK/Metro provenance.
- [x] Run source/export gates. Retain security audit failure for upstream braces
  advisory if unresolved; do not change policy just to pass.
- [x] Update provenance, startup result and existing audit reports. Device release
  performance and full per-screen coverage remain separate acceptance criteria.

Evidence: `markdown/ui-quality/STARTUP_REDESIGN_RESULTS.md`. Implementation and
bounded QA are complete; overall security gate,80% aggregate coverage and broader
native release/device acceptance remain open. Do not label the whole audit done.
