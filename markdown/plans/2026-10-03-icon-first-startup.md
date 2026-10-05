# Icon-first startup and measured UI polish

**Superseded normal-mode design:** The user subsequently selected a newly
designed icon + minimal status + real-stage progress interface. Continue with
`2026-10-03-startup-redesign.md`; the recovery, native handoff and audit work
below remains relevant. Do not treat the old icon-only criterion as final.

**User brief:** On app launch show only the application icon; create original app assets with the authorized tools and improve smooth UI/UX.
**Scope:** Existing native splash, React bootstrap surface and recovery, startup handoff and measured modal interaction. Existing audit edits remain intact on `codex/ui-quality-audit-20261003`.
**Design:** Keep `assets/images/icon-v2.png` as the authoritative application icon. Center it at a fixed size on the existing light background. Normal launch has no text, spinner, shimmer, skeleton or looping motion. Accessible loading status remains nonvisual. Only real error/watchdog states display recovery text and retry/cache/update controls. Fade the React overlay away with the existing fast opacity token after a ready route commits; Reduce Motion settles immediately. Native splash and React canvas share image, size and background.
**Authorization ruling:** The user explicitly requests execution and the earlier audit brief says continue after planning; no additional approval handoff is inserted. This is a bounded replacement of the existing startup view. Project rules require this written brief despite the generic brainstorming bounded-path default.

## Assets

- Original icon reused without replacing launcher identity.
- Generate one original recovery illustration under `assets/generated/concepts/startup/`, prompt/provenance under `assets/generated/prompts/startup/`. It is used only in exceptional recovery; normal startup remains icon-only.
- Review actual alpha/crop/bundle size and native render before promotion to `assets/generated/production/startup/`. No imported artwork/characters or real account data.

## Execution

- [ ] Record source/installed binary and startup baseline before new changes. Existing audit baseline/gate results are retained separately.
- [ ] RED: loading tree contains only the app image with fixed layout; no visible strings/ActivityIndicator/skeleton or repeated animation in normal mode. Retain all recovery controls and their callbacks.
- [ ] Implement fixed icon surface and conditional recovery, shared native configuration and ready-to-content handoff with no extra delay.
- [ ] Keep all core session/data validation awaited, but remove optional startup-cache metadata persistence from the navigation dependency. Preserve queued write/removal and generation checks; pin slow/rejected marker behavior with deterministic regression tests.
- [ ] Generate/review asset and retain prompt/provenance; native launch image updates require a new APK, not an OTA.
- [ ] Run loading/bootstrap/recovery/Reduce Motion regressions and final `pnpm run check` including disposable Android export/budget. Correct the previously failing Combat accessibility assertion against the stronger new busy state without weakening it.
- [ ] Inspect Android normal/recovery startup, overlay handoff and measured interaction with APK/version evidence. Report cold start timing separately from frame statistics; binary mismatch and absent release profiling remain explicit.
- [ ] Update CHANGELOG and startup/audit results with real statuses. No automatic publish or push.

## Acceptance

Normal launch renders only the VShop icon, native and JS images/background match, failure recovery remains actionable, no perpetual launch animation or added dwell delay, old audit changes remain preserved, all source gates pass and runtime/performance gaps are stated with evidence.
