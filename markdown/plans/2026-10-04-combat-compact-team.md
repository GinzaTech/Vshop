# Compact team panel in Combat

## User brief

The user wants smaller member cards and smaller contents, consolidated into
one shared Team frame in the existing Combat screen. They explicitly chose a
shared frame, rather than a separate navigation tab.

## Design and source scope

- One flat, opaque GlassCard contains the Members heading and the whole party
  roster. Compact native rows use dividers instead of separate card borders.
- Avatar48→32dp; rank icon40→20dp; name14→13sp; metadata12→11sp. Tighten spacing
  using existing design tokens. Preserve identity, tag, leader/self badges,
  level, ping, rank/RR and ready status. Long names/ranks may wrap as needed.
- Integrate the self-only ready switch beside compact rank information, with
  a48dp minimum touch target and existing checked/disabled/busy semantics.
  Do not scale the whole row or dim its contents on touch.
- Keep the outer FlatList as the vertical scroll and refresh owner, rendering
  one stable Team item. Map supplied party members inside the panel without
  silently truncating custom-party members.
- Empty members remain inside the same frame. Queue, settings, invite, friend
  rail, chat, controller/data/API and permissions remain unchanged.

Product scope: features/party/PartyScreen.tsx, PartyMemberCard.tsx,
PartyTeamPanel.tsx and party.styles.ts. A specialist owns only a new integration
test file and a read-only review; main owns product code and the phone.

## Execution / acceptance

- [x] Observe current Combat on45218ba and save before screenshot: actual five-
  member live roster in combat-compact-before.png/xml, external artifacts folder.
- [x] Capture behavioral RED: single team panel/compact rows against old screen.
  External combat-compact-team-red.log:8 behavioral failures,28 preservation
  passes; missing panel, old per-member surfaces/data and48dp avatars.
- [x] Implement shared panel and compact typography/image geometry.
- [x] Scoped GREEN including existing party permissions, actions, empty data,
  long labels, actual metadata and ready switch. No account-write device tests.
- [ ] Physical after screenshot, one-member live roster and available multi-
  member fixture, narrow/long text checks where feasible. Clearly label fixture.
- [x] TypeScript, zero-warning lint, full source check, Android export and diff
  check. Keep known production audit/coverage limitations visible.

No new asset, runtime animation, backend behavior, commit or release is needed.

Initial scoped GREEN43/43 (new21 +existing22), owned-test ESLint PASS. Existing
invite-control geometry assertion updated to48dp row/readyTouch semantics;
the old72dp/separate-readyRow contract is superseded by the requested layout.
Expanded final tests/source gates are running. Physical reload stopped by the
device asleep guard before any reload action; the user was asked to unlock.

After explicit unlock confirmation, latest source was reloaded in QA. Native
capture combat-compact-after.png/xml shows all five actual live members in one
panel. combat-compact-native.json records one panel, five rows and one disabled
self switch, each row204–205px high at420dpi (about78dp). No ready, queue,
invite, leave or account action was invoked. The active game triggered the
existing automatic Match Session route; its public Back returned to the party
without another auto-entry. Portrait was restored by the existing route policy.
Final read-only review approved the bounded source; four suites91/91 PASS,
22.376s, external combat-compact-team-green.log. New test file21 cases, lint0.

Final TypeScript/lint PASS,192 suites2672 tests PASS (127.913s). Overallcheck
FAIL only at existing braces advisory1240992; coverage74.08%, below80%.
Independent Android export PASS10.21MiB total/7.85MiB Hermes/1.06MiB largest,
temporary directory removed; diff check PASS. Native normal-size five-member
appearance is verified. Two320dp/font1.3 attempts failed stable route arrival
after activity recreation, so responsive/large-text acceptance is NOT VERIFIED.
Each finally restored original420dpi/font1.0. Plan remains partial for that
acceptance; no clipping, enabled mutation or full accessibility claim follows.

## Follow-up: rank icon at the right edge

The user now requests no visible rank name in Team rows, only the icon aligned
right. Move the rank out of the identity stack, after the self-ready control.
Keep rank/RR in a screen-reader label and a neutral placeholder when the actual
rank art is missing; never invent a tier icon. Preserve the compact20dp icon,
32dp avatar, team frame and all control/data ownership. Update renderer-level
contracts before product edits, then rerun source gates and reload QA if ready.

Implemented: no visible rank/RR Text,20dp rank slot is the last native row child,
after the self-only switch. The slot exposes real rank/RR to screen readers,
including0RR. Missing art uses the neutral unknown icon. Targeted pre-edit RED
2/2 failures; final scoped GREEN93/93 across four suites (26.885s), external
combat-rank-icon-red.log and combat-rank-icon-green.log. Source review approved,
no blocker. Android export PASS10.21/12MiB total,7.85/8MiB Hermes,1.06/1.5MiB
largest; unique temporary output removed. Diff check PASS.

Latest physical reload was stopped by the asleep-device guard before any
action. Unlock confirmation requested; old compact-team screenshots still show
rank text and are not evidence for this icon-only revision.

Final icon-only source gate: TypeScript/lint PASS,192 suites2674 tests PASS,
127.212s. Existing braces advisory1240992 still fails the overall check. The
user's icon-only source change is complete; native appearance awaits unlock.

## Physical test resumed: empty live roster and isolated fixture

The user explicitly requested physical tests. On45218ba QA4.2.0/code92,
freshly loaded source shows one empty Team frame; Riot currently provides no
party members. This proves the empty state, not icon placement. Add a teamPreview
branch to the existing DEV-only /ui-qa?demo=1 route, rendering the actual Team
panel with five synthetic members and public cached rank art. Clearly label
the fixture and keep ready toggles local. No controller/Riot/account access in
the fixture; the production ui-qa resolver remains disabled. Test route/fixture
guards, physically verify icon geometry/no rank Text and local switch, including
narrow/large-font and back/re-entry. Preserve all live roster semantics.
