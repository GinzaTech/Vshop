# Full UI quality audit — execution plan

**Goal:** Audit and repair existing VShop UI with reproducible source and Android evidence, retaining accepted design and behavior.
**Architecture:** Route → UI/store → services; shared UI uses existing DesignSystem/Motion tokens. Existing Jest, ARTEMIS observation and ADB provide complementary evidence.
**Tech stack:** Expo 57.0.23, React Native 0.86.3, React 19.2.3, Reanimated 4.5.1, RNGH 2.32.0, Skia 2.6.2, Expo Router 57.0.21, Zustand 5.0.14, Paper 5.15.3; pnpm 11.24.0.
**Spec:** User attachment `C:/Users/kona/.codex/attachments/802e127a-9ac5-4116-8c2b-625798331184/Văn bản đã dán.txt`, sections 1–17.
**Baseline commit:** `8f13dc7`; clean worktree before audit. Branch `codex/ui-quality-audit-20261003`.

## Constraints and rulings

- Preserve tokens, typography, glass direction, navigation timing and business/API contracts.
- Prioritize Android; inspect web boundaries separately, never substitute HTML for native evidence.
- Run safe local fixture mutations only; live purchase/loadout/party/chat/queue/auth changes need specific authority.
- No dependency upgrades, warning suppression, weakened assertions or changes to audit allowlists to pass a gate.
- User explicitly requests continuous execution after planning; planning skill handoff is superseded.
- Evidence outside repo: `C:/Users/kona/.codex/artifacts/vshop-ui-audit-20261003/`; reports under `markdown/ui-quality/`.
- Device `45218ba`, Android 15, installed debug APK 4.1.10/code91. Source 4.2.0/code92. JS via Metro does not prove native module parity or production performance.
- ARTEMIS autonomous runner BLOCKED by missing provider key; observation + ADB available. Explore actual screens before authored device automation.

## Review focus

- Newest selection wins when delayed requests resolve out of order.
- Back dismisses visible overlays and returns focus; hidden panes cannot intercept touch/accessibility.
- Press targets, Vietnamese/long text and font scaling retain usable controls.
- Repeated navigation/background cycles cancel timers/listeners; Reduce Motion remains functional.
- Cold/warm frame measurements report build/cache/sample count; missing pixel latency remains NOT MEASURED.

## Tasks

- [ ] 1. Inventory every route, UI module, overlay, token, state and data hook; map existing test groups and entry paths. Produce `UI_INVENTORY.md` and executable matrix `UI_TEST_PLAN.md`.
- [ ] 2. Establish baseline `pnpm run check` with logged exit code before source changes. Explore Android launcher and DEV fixture routes, collect sanitized screenshots/hierarchy and gfxinfo. Record `UI_TEST_RESULTS.md`/`UI_PERFORMANCE_REPORT.md`.
- [ ] 3. Triage review findings as confirmed/suspected/improvement/blocked with bug IDs and reproducible expected/actual. Produce `UI_BUG_REPORT.md`. For confirmed defects, write behavior regression, observe RED, make smallest patch, observe GREEN and adjacent suite regression.
- [ ] 4. Exercise observed Android controls/overlay Back/keyboard/tab stress/refresh/foreground in safe fixtures and read-only screens. Test network/race conditions with deterministic existing mocks. Record per-case PASS/FAIL/BLOCKED/NOT RUN/N/A and evidence links.
- [ ] 5. Re-run changed flow and comparable metrics after patch; capture visual/a11y evidence. Native parity, account mutation and TalkBack limitations remain explicit.
- [ ] 6. Run final `pnpm run check` (includes disposable Android export/budget), diff review and independent review. Update six reports plus CHANGELOG for behavior changes. Leave source reviewable; no release/push implied by this audit request.

## Acceptance

Completion requires enumerated UI denominator, executed critical flows, passing regression/gates, no unresolved confirmed P0/P1, comparable frame metrics where applicable and public gaps. Any missing runtime/visual/screen-reader evidence means PARTIALLY VERIFIED, not release-ready.

## Execution ledger

- 2026-10-03: Spec read, rules/design conventions inspected, baseline started before source edits. Three read-only agents cover profile, navigation/shared primitives, other screens/overlays. Device selection unambiguous.
