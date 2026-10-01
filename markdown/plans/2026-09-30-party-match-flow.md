# Party and Match Flow Implementation Plan

**Status:** active

**Execution:** stopped by the user on 2026-09-30. See `2026-09-30-stopped-work-handoff.md`; do not resume automatically. The old final code-panel screenshot path is no longer a valid artifact, as explained in that handoff.

**Latest steering:** Remove the Members count, reduce Party typography, and show only authenticated online friends in the Friends screen/Party rail. User clarified free play means Custom. Add explicit Custom conversion, return-to-default queue selection and Custom start through validated Riot endpoints; no live smoke mutations.

**Display names approved by user:** `ggteam` → Tăng tiến; `spikerush` → Spike nhanh; `hurm` → Sinh tử đội; `swiftplay` → Siêu tốc; `deathmatch` → Sinh tử đơn; `AbilityDraftArena` → Thử thách: Lỗi hệ thống. Transport IDs stay unchanged. Friends rows and the Party rail must display the actual player card when known, with an honest placeholder otherwise.

**Latency request:** User explicitly asks to improve Start responsiveness compared with ValBuddy. A validated mutation receipt must finish the user action immediately; follow-up snapshot reads run separately and cannot undo success or overwrite a newer action. Add numeric HTTP timing to sanitized diagnostics. Avoid whole-log reads/rewrites on every native flush where the installed File API supports append; validate behavior, size limits, rotation and flag-off races. Record source/HTTP timings separately from perceived UI or actual PC application time. Do not queue a real game automatically to benchmark.

**Ready follow-up:** User confirms Start responds immediately and explicitly requests the same immediate feedback for Ready. Apply a scoped, display-only optimistic self-ready value before dispatch; keep busy/duplicate guards until a validated self-ready receipt arrives, then use that receipt without waiting for follow-up reads. Rejection, null/malformed/conflicting receipt rolls back to the latest authoritative state and shows an error. Optimistic readiness must never authorize Start, mutate the shared snapshot, or leak across party/account/token/focus changes. Add deferred-response, rollback, stale-read and isolation RED/GREEN tests; actual PC application remains server/network-bound.

**Invite/code and density follow-up:** Keep explicit code generation even when a code exists, plus copy, native Share, join by code and manual invite by `Name#Tag`. Inputs open in local accessible sheets on demand to avoid a permanently long layout. Validate code/Riot ID before transport; join is a party transition with account/focus/revision guards, not a same-party mutation. No auto retry and no live mutation QA. Reduce heading/body sizes and vertical padding using existing tokens; preserve >=48dp touch targets, scaling, screen-reader state and light palette. Source action/validation/component tests plus native read-only form-opening and screenshot QA required.

**Code UI redesign follow-up:** User explicitly requests redesigning the code section again. Replace equal-weight 3+2 pill rows with a clear compact code panel: prominent selectable actual code, adjacent accessible icon controls for copy/share when code exists, a primary Generate affordance when empty and explicit Generate/regenerate when populated. A thin separated lower row contains Join by code and Invite by Riot ID. Existing callbacks, permission/current-scope guards, input sheets and validation stay unchanged. Use white/red semantic tokens and >=48dp targets; add populated/empty hierarchy, busy, long-code/font scaling tests and inspect actual native empty state/forms. No fake code for device QA and no automatic code generation.

**Goal:** Replace the default Combat agents/role UI with a white Party sheet, working queue/privacy/invite controls, real members/friends, 3-second active polling, and a pregame-only select/lock popup that transitions to match data after a successful lock.

**Spec:** Direct user requests in this chat plus `C:/Users/kona/Downloads/party-ui-spec-codex.md` and the inspected `IMG_3557.png`. The latest user correction removes even the default agents list. External mock data and suggested fallback mutations do not authorize fake runtime state or automatic account actions.

**Architecture:** Route delegates UI to `features/party`; hooks own request/action lifecycle; Riot services own validated transport through the existing endpoint registry/client. Reuse `useCombatStore`, session/focus guards, current XMPP friend store and `CombatSessionScreen` for actual match data. UI-only selectors open locally; mutations happen only from user button presses.

## Baseline

- Combat route currently mixes chat, party code, role filter, agents and actions in one large file; user wants Party-first behavior.
- Existing `useCombatPoll` schedules at 10 seconds and avoids overlap; add optional interval while keeping default for unrelated callers.
- Existing match tracker already renders pregame/live teammates/enemies and owns landscape orientation. Do not lock Party or popup landscape.
- Existing `handleCancel` quits the pregame lobby; popup close must be a separate local close, never this endpoint.
- The user requested name/level/server ping/rank icons. Missing upstream ping/rank/identity uses an unavailable label, never demo values such as 20ms/448/Diamond3.

## Acceptance criteria

- [ ] Party sheet follows white/light gray/red reference: prominent header, queue/start card, members, online friend rail, queue/privacy settings, invite code.
- [ ] No agent list or role filter in the default Party UI.
- [ ] Queue and privacy selectors call validated current-account/current-party APIs; leader/queue/pregame/live guards, double-press suppression, actionable errors and refetch after success.
- [ ] Explicit start/cancel matchmaking, ready and leave handlers are functional; leave requires an in-product confirmation. No mutations from polling, mount or automated device QA.
- [ ] Real current-party members show name/tag, avatar, level, selected-server ping when available, rank icon, leader/self and ready state.
- [ ] Real online friends come from XMPP presence, with avatar fallback and availability labels. Avatar press invites one friend with loading/error feedback; disconnected/empty friend states explain availability.
- [ ] Poll every 3000ms while focused and foreground; no overlapping waves or jittering full-screen spinner; cleanup on blur/background/unmount and reject stale account/token/generation responses.
- [ ] New pregame match triggers one auto-open agent popup scoped by account+match. Live detection opens match view directly. Selecting an agent is local; only explicit Lock performs select/lock endpoints.
- [ ] Lock success closes popup and opens existing match tracker; failure retains selection/popup and shows error. Stale success cannot close a new match's popup or navigate another account.
- [ ] Tracker polls pregame and live at 3 seconds and displays ally/enemy data/scores only when APIs expose them. Early pregame hides unavailable enemies/score instead of fabricating them.
- [ ] English/Vietnamese, 360–430dp, long names/font scaling, native accessibility, Reduce Motion, safe areas, offline/error and read-only device QA have evidence.
- [ ] Targeted RED/GREEN, full `pnpm run check`, production audit/export, independent review and diff checks pass after all writers stop.

## Shared UI interfaces

`features/party/party-types.ts` defines `PartyViewModel`, `PartyMemberView`, `PartyFriendView`, `PartyScreenProps`, `PartyActions`, `AgentSelectModalProps`. UI workers consume these props; data worker produces the model and callbacks; route wires them and handles successful navigation. Model fields are optional when upstream data is absent.

## Task 1 — API/data/action controller

Owner files: new `services/riot/party-api.ts`, `features/party/party-model.ts`, `features/party/usePartyController.ts`, optionally `features/party/party-presence.ts`; update `services/riot/endpoints.ts`, `utils/valorant-api.ts`, `services/riot/api-types.ts` only as contracts require. Existing source docs/live responses determine queue/accessibility/invite payloads. Add contract/model/action race tests in `__tests__/party-*.test.ts*` with clear finite ownership.

- [ ] Read current endpoints/service contracts and local upstream reference evidence. Never assume an invented transport succeeds.
- [ ] Write RED tests for queue/privacy/invite/validation/auth headers, typed model mapping, absent data, leader permissions, failure preservation, stale actions and request overlap.
- [ ] Implement through existing Riot client; no axios import or URL in screen. Cache member rank/identity lookups, rather than fetching the entire catalog/MMR for all friends every 3 seconds.
- [ ] Run targeted Jest/typecheck/lint and return exact API evidence/limitations.

## Task 2 — Party sheet and agent popup

Owner files: new `features/party/PartyScreen.tsx`, `PartyMemberCard.tsx`, `PartyFriendRail.tsx`, `PartySelectors.tsx`, `AgentSelectModal.tsx`, `party.styles.ts`; component tests `__tests__/party-screen.test.tsx`, `__tests__/party-agent-modal.test.tsx`.

- [ ] Tests RED for hierarchy, disabled/busy actions, selectors invoking callbacks, real member/friend props and local popup close.
- [ ] Match geometry using existing tokens/primitives/AppIcon, network images CachedImage. Use native switch and accessible buttons; modal hides background and supports back/local close.
- [ ] No fabricated sample names/ranks/pings/data. No fetch/transport in components. Consume shared types exactly.
- [ ] Return translation key/default text list so parent can merge i18n after Bundle GLM writer stops.

## Task 3 — Route, polling, agent lifecycle and existing chat

Codex owns route integration, extracting existing `PartyChatPanel` if necessary (preserve chat), state-machine tests and the optional poll interval. Auto-popup only for pregame; button close never quits game. Existing tracker is the only landscape route and must restore portrait on exit.

## Task 4 — Runtime and final review

Enable sanitized response diagnostics, export actual captures outside Git, update API catalogue with observed Party/member/ping fields. Use read-only navigation/selector opening/scroll/refresh QA on device `45218ba`; do not invite, queue, leave or lock a live account just to test code. Automated contract/action tests cover mutations and explicit live execution remains NOT VERIFIED until observed from a human press. Record screenshots and scope each completion claim to available evidence.

## Final evidence and remaining live criteria

- New controller/API/model path: initial 153 focused tests; final controller 89 tests after review race repairs. Deferred responses verify immediate self-Ready presentation, no optimistic Start permission, rollback, old account/focus/party rejection, Party-less match transition and bounded confirmation. Versionless/equal contradictions resolve after three protected reads; provably lower versions become read-only, including retained Join callbacks, until matching/newer data arrives.
- UI forms: 53 focused tests across invite/screen/route suites; invite form scope had 98.30% lines / 93.39% branches. Source uses existing white tokens, compact typography/padding and 48dp targets. Generate always generates instead of toggling an existing code off. Share dismissal does not create an error or refetch.
- Independent final source review found no remaining HIGH/CRITICAL blocker in the Party controller scope after Ready/Start and Join uncertainty repairs. Tests and runtime remain separate evidence.
- Full final `pnpm run check`: 140 suites / 1,968 tests, typecheck, lint, production audit policy, Android export and budget passed. Existing policy still documents four transitive advisories; no new allowlist entries. Global line coverage 64.86% remains below 80%, while scoped new controller/forms were verified above 90%.
- Native device `45218ba`, `com.android.vshop/.MainActivity`: actual member name/cấp/ping, Custom state/label, compact online-only rail and real friend playercards observed. Missing rank/card data retains unavailable/placeholder states. Capture: `vshop-party-code-compact-20260930.jpg` under host Temp.
- Native join form opens with keyboard, local empty-code validation displays Vietnamese error without a Join request. Invite-by-Riot-ID form also opens; local close resets keyboard/input. Captures: `vshop-party-join-form-20260930.jpg`, `vshop-party-join-validation-20260930.jpg`, `vshop-party-invite-form-20260930.jpg`. Friend cards: `vshop-friends-cards-final-20260930.jpg`.
- User directly confirmed Start reacts immediately after the first optimization. No exact Start/Ready-to-PC timing was measured. Actual code generation/share, joining/inviting, Custom conversion/start and agent lock are NOT VERIFIED from tool-driven live mutation; these endpoints were not automatically smoke-tested.
- Font recreation dev incident: AndroidRuntime reported a Metro `DebugServerException` for a temporarily unterminated controller source line during writes, not a proven font-layout failure. Stable source subsequently passed Babel Android export/typecheck/tests. Metro was restarted after all source writers stopped; final loaded-device recovery is recorded separately below. Large-font loaded UI and manual TalkBack remain open criteria, so the overall plan is active.

### Code panel redesign final verification

- White panel now groups the actual selectable code with 48dp Copy/Share icon controls. Generate is beside the empty placeholder or in the populated header, avoiding an additional action row. Join/Invite are quiet lower actions separated by a thin rule; narrow/large-font layouts stack. Code text is not ellipsized or shrunk; long values scroll horizontally.
- Existing app viewport contract caught a direct RN dimension-hook import. Production consumer was changed to `useAppWindowDimensions`; the boundary test was not relaxed and the two pre-existing dirty viewport/refresh files retain their original SHA256 values.
- Focused UI + viewport gate: 4 suites / 78 tests passed. Component coverage in the scoped redesign run: 98.59% lines / 97.35% branches. Final independent source review had no HIGH/CRITICAL or concrete P2 finding in the three-file UI scope.
- Final post-redesign `pnpm run check`: 140 suites / 1,980 tests passed; typecheck, zero-warning lint, production audit policy and Android export/budget passed. Total 10.36MiB/12MiB, Hermes 7.89MiB/8MiB; temporary export removed. Whole-repository line coverage is 64.88%, not global 80% compliance.
- Metro restarted with `npm start`, then `a`, after source writes stopped. Final loaded Party on device `45218ba` displays an actual API invite code, real member/friend state and the new panel. Capture: `C:/Users/kona/AppData/Local/Temp/vshop-party-code-redesign-final-20260930.jpg`.
- Native Share control opened Android's text share sheet with the same current code; Back dismissed it without selecting a recipient or sending anything. Local evidence: `vshop-party-code-share-sheet-20260930.jpg` under host Temp, outside Git. This clears native Share-sheet opening/dismissal, not outbound messaging or Riot join/invite mutations.
- A second font-scale attempt reached Dev Launcher/startup rather than the loaded target; do not treat those captures as large-font visual proof. The original system font scale was restored and verified as 1.0. Final normal-scale app recovery and panel rendering were observed after the intermediate Metro parse failure; no new native release/APK/OTA is claimed.
