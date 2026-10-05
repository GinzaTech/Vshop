# Full mobile test results — 2026-10-03 baseline / 2026-10-04 update

## Latest source-only handoff — replaces previous final More appearance

User rejected the subtle ten-card white-glint treatment and the gray procedural
background. Final code has white More with an original ImageGen pearl wallpaper,
all14 image-refraction glass groups, a black Liquid Glass navbar, and crisp
pressed content across nine linked routes. All device testing after that source
change is explicitly deferred to2026-10-05. Earlier native images below are
historical snapshots and do **not** prove the latest appearance.

Final [code check](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/final-white-more-black-nav-check.log):
TypeScript/lint PASS;191 suites /2644 tests PASS. Coverage74.05% statements remains
below80%. Overall check FAILS only at the existing braces audit1240992.
[Android export](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/final-white-more-black-nav-export.log)
PASS: total10.21MiB, Hermes7.84MiB, largest1.06MiB; temporary output removed.
Headless real ImageShader compilation/painting is source/host evidence, not native
paint proof. [Final implementation and pending physical checklist](../plans/2026-10-04-white-more-black-nav-final.md).

The final renderer uses one viewport buffer, measured14 bounds, UI-thread scroll
offsets and a source/eligibility decoder key; sharp native controls stay outside
the renderer owner. Inner-content regressions:8 suites /90 tests PASS; More
scope71 tests, final full gate includes the additional decoder retirement check.

**Status:** October 4 handoff: 26 routes `ENTRY_OBSERVED`, scoped fixes/native observations complete, full functional acceptance incomplete. Main updated this report after the latest Profile, More and language device checks.

**Runtime:** Physical `45218ba`, `com.android.vshop.startupqa`, native 4.2.0/code92, JS from current Metro. Original `com.android.vshop` and its different signer/data were preserved. Installed QA identity appears in [discovery JSON](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/route-discovery.json). Some entry captures show initial loading frames: route arrival is not settled-content, interaction or network-recovery proof.

**Source/build evidence:**

| Check | Result and boundary |
|---|---|
| Final source gate | [more-glass-final-check.log](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-glass-final-check.log): typecheck/lint PASS; **187/187 suites, 2570/2570 tests PASS**. Production audit then FAILS: unallowlisted high `braces` advisory 1240992; overall check exits 1. Statements73.88%, below the80% total target. |
| Final Android export | [more-glass-android-export.log](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-glass-android-export.log): total 9.13/12.00 MiB; JS/Hermes 7.82/8.00 MiB; largest asset 0.92/1.50 MiB. Temporary output removed. Export success does not prove production delivery. |
| Host harness checks | [host-tests-final.log](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/host-tests-final.log): 33 tests, OK. Separate from native UI evidence. |

**Three corrections:** Primary content commits one opaque scene without delayed crossfade; inactive scenes remain inert. AppIcon settle synchronizes native/canonical React SVG paths through local render commit. Profile focus-loss masks/dismisses pickers while preserving account/pager state. [Ghost plan](../plans/2026-10-03-tab-ghosting-fix.md), [62-test GREEN](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/ghost-and-glyph-final-green.log), [four blur tests](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/picker-blur-green.log). Main confirmed Accessories had no old modal in [physical capture](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/picker-blur-physical.png), and settled Shop/Settings glyphs were corrected. Visual acceptance remains scoped.

**Native controls:** [replay JSON](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/functional-controls-with-replays.json) preserves **8 PASS + 2 FAIL_OR_BLOCKED across 10 groups**, plus **2 independent replay PASS records**. No all-route functional count follows. Scope: categories, filters, Equip/Accessories/Gallery Unicode query/clear/Back, invalid-chat draft/no Send, auth Cancel within 20 seconds per main, Contracts/Upgrades/About finite loaders; not every error branch.

[Initial log](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/functional-controls.log) retains four failed `''` assertions: empty EditText returns its visible hint. Final search PASS uses observed empty baseline. Fast-entry Friends input-not-found/Match not-selected failures remain; stable [Friends](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/friends-search-final.png) / [Match](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/match-performance-final.png) replays PASS with explicit selected=true.

[Final Profile selectors](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/profile-selectors-final/profile-selectors-report.json) show all four slots opened/dismissed, `PASS_OPEN_CLOSE_ONLY`, displayed equipment unchanged. Earlier three-slot/context-loss failure remains retained. No equip option was selected.

**QA stress:** [30-cycle JSON](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/qa-30cycles/after-native-results.json) reports 5/5 cases PASS and 30 actual samples. [Raw gfxinfo](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/qa-30cycles/after-gfxinfo.txt): 1299 frames; 265 janky (20.40%); p50/p90/p95/p99 18/46/105/121 ms; GPU p95 5 ms. PSS 1,928,749 → 1,992,074 KiB. DEV/Metro/instrumentation scope; pixel latency is unmeasured. No matched improvement, production FPS or leak verdict is established.

**Configuration and remaining acceptance:**

| Case | Classification |
|---|---|
| Startup at 320dp/font 1.6 | PASS per main after DEV configuration reload; [new external PNG](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/narrow-large-font-startup.png). Initial configuration attempts failed root/fixture markers and remain retained. Finally restored original 1080×2400/font 1.0, verified by main. This does not establish all-layout PASS. |
| Normal existing-friend chat | NOT VERIFIED. Only invalid-recipient draft/clear was exercised; no message sent. |
| Active game/party and network-error branches | NOT VERIFIED where positive runtime conditions were unavailable or unexercised. |
| Positive handoff and complete human login | NOT VERIFIED. Transfer/auth submission not exercised. |
| Purchase/equip/queue/party/chat/handoff writes | N/A: excluded from this read-only scope; no write success inferred. |
| Accessibility across all panels/layouts | NOT VERIFIED; bounded modal semantics and startup configuration evidence do not establish full traversal or responsive coverage. |

Phone interleaves triggered STOP guards; reopen QA only after driver-owned Back produces observed Launcher exit. Private screenshots stay external. Uncompleted normal-chat/current-match branches remain gaps.

**Final October 4 scope:** Earlier cases prove their recorded source snapshots; main reports source frozen at handoff.

- Night/Combat edges flattened: 55 unit tests GREEN, independent 99 GREEN; main confirms no halos in [Night](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/night-market-edge-after.png) / [Combat](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/combat-edge-after.png) captures.
- Friend normalization/late-asset polling: main reports 94 source tests GREEN; filters/DTO checks 149 GREEN. Prior DEV aggregate: 1016 cards, 205 friends, 31 online; **10/31 known card identities matched, 21 missing metadata** retain honest default avatars. No inferred cards; temporary aggregate removed.
- User-authorized [full roster/presence XML + decoded game JSON](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/friend-card-responses.jsonl): main reports **226 records, 6 roster/220 presence**. File metadata measured **766,973 bytes**; payload not read. RiotIDs/card UUIDs retained locally, auth tokens/cookies masked. `EXPO_PUBLIC_VSHOP_CARD_RESPONSE_DEBUG` disabled in final CLI environment.
- Combat excludes Offline/Away/DND/VAL `isIdle=true`; missing metadata clears stale idle state (current `isIdle=false`). Latest DND scope: **80 tests PASS**, independent review approved; [native visible rail](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/combat-dnd-after.png) has no Away/DND labels. Friend cards remain width96, two status lines, minHeight40. This closes scoped rail/status observations, not all live-game/A11y states.

## Latest Profile, More and language refinements

- Profile ranks use13sp/16sp line height, two-line fitting with minimum scale0.85.
  Three balance cards and two rank cards match the Level pill's light gray token.
  [Final source/native capture](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/profile-rank-gray-handoff.png)
  shows complete Kim Cương1/3. The intermediate dark material was replaced at the
  user's request; it is not the final design.
- Four lower More groups and the language picker use the existing flat material;
  actual rendered primitive tests preserve switches, links and account guards.
  [Final More](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-edges-handoff.png)
  has the flat border without the earlier optical rim/shadow.
- Language baseline video shows a roughly ten-second stall. Back-first transition
  scheduling alone did not resolve text latency. A shared language provider/hook
  and per-primary-tab committed locale boundaries update visible content first;
  hidden tabs catch up on focus without remounting. Real i18next tests prove
  derived-label refresh and a Suspense/urgent-blur regression protects ownership.
- Instrumented DEV provider commit: unbounded tree9.225s; bounded VI→EN504.65ms,
  EN→VI350.58ms. [Passive video](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/language-scene-vi-en.mp4)
  confirms the visible transition. These are not exact touch-to-pixel/FPS results.
  All timing logs were removed. [Final handoff JSON](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/rank-more-language-handoff.json)
  records both directions on the final source, all five primary tabs visited,
  Vietnamese retained after cold reload and restored afterward; passive screenshots
  captured at host elapsed1.646/1.649s show complete translated More. No APK/OTA release.

## More optical Liquid Glass shortcuts — final refinement

The user clarified that only the ten feature tiles inside More should use glass.
They now use the shared static frost/reflection primitive, no outer shadow,
the same two-column112dp minimum geometry and the original semantic buttons.
Four lower groups remain flat. Actual Settings/GlassCard tests5/5 PASS, covering
all nine routes, Update and the existing switch/account/confirmation guards.

[Final More image](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-glass-shortcuts-final.png)
and [native route replay](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-glass-shortcut-native.json)
show all nine shortcut route entries plus Update popup open/dismiss. No update
was applied; route arrival does not prove every functional state.
[Final language replay](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-glass-language-final.json)
confirms both directions on the glass design and restored Vietnamese, with
complete translated More in passive captures at host elapsed2.081/1.602s.
[Profile](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/profile-rank-gray-final-source.png)
still has five Level-gray cards and complete Kim Cương1/3. Final source has no
temporary timing logs. Phone left on More for review, current Metro snapshot
`metro-more-glass-handoff.log`; original package/data and device configuration retained.

## October 4 latest white More background and translucent black nav

This supersedes the preceding ten optical shortcuts/four flat groups design.
All fourteen groups now use the image-backed MoreGlassScene, with one viewport
canvas outside the transparent scroll container. More retains its white base.
At the user's request for clearer card separation, wallpaperStrength increased
from0.28 to0.72 in the shared design token; shader and fallback match.

On device45218ba, QAcom.android.vshop.startupqa4.2.0/code92, a fresh Metro
reload displayed the latest source at1080×2400/font1.0. Guarded scrolling
captured the top ten shortcuts and all four lower groups. The latest hierarchy
reports more-glass-scene-gpu and the native canvas. Screenshots show pearl folds
and glass boundaries with legible labels; settings and account values were not
changed. [Top capture](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/white-more-native/04-more-pearl-top.png),
[lower groups](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/white-more-native/05-more-pearl-lower.png),
[bottom groups](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/white-more-native/06-more-pearl-bottom.png),
[scroll replay](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/white-more-native/more-pearl-scroll.mp4).
These establish the bounded visual/scroll replay, not all-layout/FPS acceptance.

Black nav uses native ultra-thin dark blur, a36% dark veil and56% lens tint.
The page is visible through the material. The UI worklet now configures lens
motion before its RN acknowledgement dispatches the route. Deferred scheduler,
rapid intent and commit/lifetime guards pass85 scoped navigation cases; original
ordering and primary-commit RED logs remain preserved. Seven matching route
presses produced before204 frames/113janky55.39%, after264/120janky45.45%;
p95 changed97→73ms and p99 remained150ms. DEV/runtime warmup conditions differ:
these captures do not establish a causal performance gain or smooth60fps.

Latest More scoped result:71/71 PASS. Full check and Android export for this
contrast revision are logged externally as more-pearl-final-check.log and
more-pearl-final-export.log; their completed outcomes are added below.

Completed contrast-revision gates: TypeScript and ESLint max-warnings0 PASS;
191 Jest suites/2651 tests PASS,93.228s. Overall pnpm check remains FAIL at
the existing unallowlisted production braces advisory1240992. Independent
Android export PASS: total10.21/12MiB, Hermes7.84/8MiB, largest1.06/1.5MiB;
its unique temporary export directory was removed. git diff --check PASS.

## Combat compact shared Team panel

The user requested smaller member cards and their contents, then chose one
shared frame inside Combat. PartyScreen now renders one stable Team list item;
PartyTeamPanel owns one flat surface and keyed compact member rows. Avatar32dp,
rank icon20dp, name13sp and metadata11sp use canonical design tokens. The
self-only native ready switch is inline and retains its48dp minimum touch area.
The complete supplied roster is retained, including a six-member custom test;
empty members remain inside the same refreshable frame.

On45218ba/QA4.2.0, a fresh reload showed all five actual party members inside
one frame. [Before](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/combat-compact-before.png)
and [after](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/combat-compact-after.png)
show smaller images/labels, rank on the compact identity stack and the inline
self switch. Latest native JSON records one panel, five rows204–205px each
(about78dp at420dpi), and one disabled unchecked self switch. No ready/queue/
leave/invite/account action was invoked. Automatic entry into the active Match
Session was existing behavior; public Back restored Combat and portrait.

Behavioral RED:8 failures/28 passes before product edits. Final scoped GREEN:
91/91 cases in four suites; new21 regression cases cover grouping, full roster,
empty state, metadata, disabled/busy/duplicate/retry and parent-controlled ready
state. Read-only review found no blocker. Final full source: TypeScript/lint
PASS,192 suites/2672 tests PASS,127.913s; coverage74.08% statements remains
below80%. Overall pnpm check FAIL at existing braces advisory1240992. Independent
Android export PASS10.21/12MiB, Hermes7.85/8MiB, largest1.06/1.5MiB, unique
temporary directory removed. Diff check PASS. Logs combat-compact-team-red.log,
combat-compact-team-green.log,combat-compact-final-check.log and
combat-compact-final-export.log are external.

Two320dp/font1.3 configuration attempts did not reach a stable Team route after
activity recreation; **NOT VERIFIED** for this layout. Both finally restored
original420dpi/font1.0. Those failed route preconditions are not responsive
layout PASS or a demonstrated clipping bug. Large-text/native accessibility
traversal and enabled ready-switch writes are not claimed by this replay.

### Team rank icon follow-up

The latest user request removes visible rank names/RR and places only the20dp
icon at the far right of each row, after the self-ready switch. The native image
slot retains rank/RR for screen-reader users; missing art shows a neutral unknown
icon. This supersedes the compact identity-stack rank labels shown above.
Behavioral RED2 failures preceded source changes; final scoped93/93 cases PASS
across four suites,26.885s. Read-only review approved; Android export PASS at
10.21MiB total/7.85MiB Hermes/1.06MiB largest and cleaned its temporary output.
Diff check PASS. Source full gate is logged as combat-rank-icon-final-check.log.
The phone was asleep at reload preflight, so no new physical appearance claim
is made until unlock and replay. Earlier screenshots do not show this revision.

Completed icon-only source gate: TypeScript/lint PASS;192 suites2674 tests PASS,
127.212s. Overallcheck remains FAIL at existing braces advisory1240992. No
product code changed after export/scoped review; latest diff check PASS.

## October 4 detailed white More, clear nav, Bundle disclosure and content sweep

Source inventory enumerated207 app/components/features files. Remaining ordinary
content uses explicit flat surfaces:14 About/Contracts/Upgrades/Setup/Reauth
call sites, contracts stats, Profile identity/skin/expression/picker content,
Store weapon tiles, Night press feedback and repeated agent-picker tiles.
Shared glass defaults, More/Nav glass, semantic owned/disabled indicators and
deliberate modal depth are retained. Breakdown subtab changes keep the table
scale/alpha fixed. No account callbacks, prices, metadata or permissions changed.
The external remaining-halo-source-review.md records inventory and source-only
findings; it does not establish native coverage of all207 files.

The generated original more-white-pearl-pattern.png is841×1870/1566857bytes,
with white embossed contour ribbons, preserved prompt/source/hash provenance.
Native [More top](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-pattern-clear-nav-top.png)
and [lower groups](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/more-pattern-clear-nav-lower.png)
show pattern transmission and fourteen glass groups on the white base. Nav
uses native blur18, black veil18%, lens12% and dark ink over the clear material.
Opaque fallback retains light ink. The page remains visible through the bar.

Native press uses a tiny runOnUISync kickoff then guarded navigation in the same
handler, with old async web/error fallback preserved. Default moves remain async;
UI revision guards reject older queued commands. Scoped navigation98/98 PASS,
including Reduce Motion/no replay, rapid intents, prevented/retired handlers,
native failure and web authoritative-commit guards. Source guarantee is kickoff
before dispatch, not first-paint timing or guaranteed FPS.

### Physical tests in this window

- Team: live Riot roster currently empty, so live empty frame observed only.
  /ui-qa?demo=1&team=1 explicitly labels five synthetic members and uses actual
  PartyTeamPanel. Native geometry verifies all rank icons at the right edge,
  no visible rank/RR Text, local ready/disabled/empty controls and all five rows
  reachable at320dp/font1.3. Final driver7 cases/0 failures; original420dpi/font1.0
  restored. [Results](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/team-rank-native-results.json).
  Initial driver failures were Android hierarchy flattening and an incorrect
  all-visible-at-once assumption at large font; logs retained, not app failures.
- Bundle: live data initially collapsed after final reload. Opened carousel below
  summary, swiped horizontally, closed/reopened with retained item position and
  left closed;3 final cases PASS. [Results](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/bundle-final-native-results.json),
  [video](C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/bundle-final-disclosure.mp4).
  Initial driver UiObject.all API error is retained separately; initial closed
  state assertion passed before that harness error. No purchase/equip action.
- Seven warm primary presses, same sequence/1.15s pauses, passive recording and
  no UI hierarchy polling during the measured burst. Before258 frames/83janky
  32.17%, p50/90/95/99=22/34/97/200ms. After378/130janky34.39%,18/26/38/133ms.
  Tail times improved but jank proportion did not. DEV/runtime content/cache and
  instrumentation differ; no causal FPS gain, exact pixel latency or60fps claim.
  The final More page was visible and selected; no synchronous-kick fallback
  warning appeared. Source logs/vids nav-pattern-before/after remain external.

### Wallpaper revisit follow-up and final gates

One source-qualified SkImage entry and the existing program cache avoid repeated
decode/idle setup across eligibility remounts. Existing source/type/gate keys
and committed availability guards remain intact; inactive/bad geometry still
draws no Canvas. Four actual-renderer mock contracts captured3-fail/1-pass RED,
then75/75 More scope GREEN; independent review found no P1/P2 blocker in current
Scene ownership. Mock cache counts are not native memory or GPU performance proof.

The phone disconnected during the final cache-version reload preflight. ARTEMIS
diagnosis restarted ADB safely but found no device; no reload/action ran. User
reconnection requested. All above native images/frame metrics precede this tiny
cache follow-up; exact post-cache physical replay remains pending reconnection.
Final source/export gate outcomes are logged externally in
pattern-clear-halo-final-check.log and pattern-clear-halo-final-export.log.

Completed final cache-source gate: TypeScript and ESLint max-warnings0 PASS;
197 suites/2748 tests PASS (72.8s). Statement coverage74.58% remains below80%.
Overallcheck stops only at existing braces advisory1240992. Independent Android
export PASS: total10.64/12MiB, Hermes7.84/8MiB, largest1.49/1.5MiB; unique
temporary output removed. Native post-cache verification and the remainder of
the affected-route press/visual sweep remain pending while45218ba is disconnected.
No source/native install/OTA/commit/push is inferred from those checks.

## Latest direction: More-standard glass on compact cards

The user now explicitly replaces the preceding flat item-card design with
More's actual white-pattern image-refraction material for Bundle, Store,
Night Market, Profile and loadout selection. They chose approximately50% less
card AREA with readable text, rather than halving both dimensions.

One `RefractiveGlassViewport` per page/modal paints the shared More texture
behind native foregrounds. Measured card/scroll/clip refs drive UI-thread
projection; scroll signals are independent of existing callbacks. At most32
visible shapes/256 registrations,6 ancestor clips and3 original rounded masks
are retained. Nested leaves precede enclosing summary shapes and all masks are
applied; out-of-budget/unmeasured cards fall back visibly. Program cache is
separate from More's14-shape program; one source-qualified image cache is shared.
Focus/background/Reduce Transparency disable drawing. The modal uses masked
caller ownership because Paper Portal reparents the native dialog.

Store/Night use3 columns at normal phone widths/font and2 on narrow/large-font
screens. Actual style-model card areas at360/390/430dp are0.45–0.60 of prior.
Bundle normal summary has96×80 artwork and initially closed compact carousel;
horizontal item position, actual price/discount/owned state and48dp controls
remain. Long current and original prices stack/wrap, not ellipsize. Profile
skin row/grid/picker representative areas at390dp are≈0.50–0.51; picker uses
3 columns at≥374dp/font<1.3, otherwise2. Rank names retain13sp/two-line fitting.
Large text and informational cards can retain additional area for legibility.

Source tests: Commerce110 PASS, Profile303 PASS, shared geometry/surfaces and
original More regression PASS. Original behavior RED evidence and sourcefreeze
manifests are external. CPU CanvasKit compiled the actual shared shader with780
floats/13 uniforms; this does not validate the Android driver or first paint.
The full source/export results are in unified-glass-final-check.log and
unified-glass-final-export.log. Phone45218ba dropped from ADB before joint native
reload; diagnose restarted the server but found no device. Reconnect requested.
**The former native screenshots/metrics do not validate this new unified design.**
New native material, true size ratios, nested scroll/reveal and FPS acceptance
remain NOT VERIFIED until that physical replay.

Final unified source gate: TypeScript/lint PASS,203 suites/2824 tests PASS,
49.502s. Overallcheck remains blocked by existing braces1240992; coverage74.66%
statements is below80%. Independent Android export PASS10.68/12MiB total,
7.88/8MiB Hermes,1.49/1.5MiB largest; unique temporary output removed. Diff
check PASS. New material/compact design is source-complete; native image/FPS
acceptance is pending connected hardware, not inferred from these gates.


## 2026-10-05 — Gray pages, retained focus rendering and UI refinements

User rejected the patterned wallpaper/unified content material. Current Profile/Store/Bundle/Night retain the prior materials and compact sizes except the four Store offers now use a larger2x2 phone grid. All page shells use COLORS.BACKGROUND. Latest Bundle has a full-width4.8:1 banner with ending time below; details remain initially closed. Night budgets all6 into2cols/3rows on a normal measured phone. Graffiti/Flex picker bodies grow~20%; collection warms at most12 public cached thumbnails and prioritizes visible images. More only shows the active account inline; its count opens other accounts, with public display-only props, current/busy/retired callback guards, removal confirmation and first-blur modal masking. Nav white strokes and outer shadow are removed.

Main physical execution used com.android.vshop4.1.10/code91 as an Expo development client serving current source on45218ba. Five gray primary-route screenshots passed pixel checks. Four actual Store cards occupied2x2 bounds469–470px wide. Filter and refresh gestures passed. Bundle initially closed and tap-to-reveal/horizontal-swipe passed; close/reopen harness then hit a UiAutomator instance0 lookup error despite a visible toggle in its captured XML. That run is retained as incomplete rather than an app-bug or retention PASS. A fresh XML-grounded coordinate fallback is prepared.

Corrected opt-in numeric DEV profiler retained renderer samples: unchanged focus/blur cost Profile629–666ms and More~200ms. Retained presentation with87 exhaustive dependencies and stable More content/rim owners reduced the same12 clean ADB/no-UIA-poll primary presses from median766.15ms to95.755ms (after range82.69–124.76ms). This is press-callback-to-React-commit, not first presented pixel. Native dispatch generally1–2ms. gfxinfo before471frames/177janky37.58%,P9540ms; after465/17437.42%,P9548ms: no improvedFPS/60fps claim. Instant-glyph trial did not improve latency and was reverted.

Combined final source:211suites/2922testsPASS, TypeScript/lintPASS, fullcheckFAIL only existing braces1240992 audit. Coverage75.31% statements below80%. Android exportPASS9.17/12MiB total,7.86/8MiB Hermes,0.92/1.5MiB largest; temp removed. Scope reviewers approved freshness/owners. Raw evidence stays outside Git under C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/app-test-20261004/.

Device dropped again before the latest Banner/Night/picker/account/rim combined replay. Diagnosis restarted ADB but still found no device; reconnect requested. Latest physical fit/appearance/popup/cache speed acceptance remains NOT VERIFIED. QA4.2.0/code92 with new launcher icon was built and installed with matching signer; testing then moved to the user-selected main Expo client. This does not change the main native launcher icon or establish a production release. No real account switch/delete/purchase/equip/queue/party/chat action.

## 2026-10-05 — Captured clipping corrections, white nav and stronger gray

At the user's request, captured main com.android.vshop through Expo on45218ba
before any corrections, saving current/Night/Profile/More PNG and XML files to
C:/Users/kona/.codex/artifacts/vshop-ui-capture-20261005/. The user was told they
could unplug only after all files had been copied to the PC. Night captures show
all six offers but a partial-width artwork band. Profile captures show AP as A
and Hồ sơ trang bị as Hồ sơ tran…; these are before-render evidence.

Night artwork frames now explicitly fill card width while retaining contain and
the six-card height budget. Profile region text reserves width without shrink;
the equipment/info control adapts to viewport/font scale, allows two fitted lines
and reserves both thumb endpoints during transitions. Shared page/background
sampling and source splash use #eceef0. The current navigation is fully white
with dark labels and a gray moving lens; unused blur/capture is disabled in opaque
mode. Launcher artwork and its approved background remain separate.

Behavioral RED logs precede the Night, Profile, transition-label and theme fixes.
Scoped GREEN: Night75/5suites, Profile159/16suites, theme107/5suites and
navigation-blur7/1suite. Independent source review approved corrections; its two
stale legacy blur tests were updated to current default/transparent opt-in guards.
Final full source gate: TypeScript/lint PASS,212suites/2936tests PASS,57.202s;
statement coverage75.51% is below80%. Overallcheck remains FAIL only at existing
braces advisory1240992. Separate Android export PASS9.17/12MiB total,
7.86/8MiB Hermes,0.92/1.5MiB largest; unique output removed. Diffcheck PASS.
Logs are final-check.log and final-export.log in the same external directory.

The phone is now disconnected as requested. **Latest native after appearance,
full-text fit and font-scale acceptance remain NOT VERIFIED.** Captures, source
tests and export do not establish these physical outcomes. Updating installed
native splash color requires a new native build. No production release or real
account-changing action was performed. See the
[captured correction plan](../plans/2026-10-05-captured-layout-corrections.md).

## Connected main Expo follow-up — final one-third player image and taller Bundle

The user reconnected45218ba and requested fresh testing. Testing used the main
com.android.vshop development client with USB Metro reverse, not the QA package.
Initial reopen retained older text/layout. A full Metro reload showed complete
VP/RP/KC/AP/name/tag/equipment labels. Native checks then caught the Night artwork
band still narrowing despite percentage-width source assertions. Explicit inner
card width and resolved height fixed it: final weapon image bounds428px wide
inside a475px card, compared with257px before. Colored bands and tier labels now
span the card; all six offers still fit2x3 above navigation at the tested font.

Final user clarification supersedes the intermediate vertical Profile enlargement:
the equipped player image now occupies one third of the identity row, with the
old120dp image height. Native image hitbox330x315px confirms that allocation at
2.625 density. The names/motto remain beside the image, and VP/RP/KC are visible.
Bundle banner height increased50% at unchanged width via ratio4.8→3.2. Native
Champions/Warden banners show the added height, ending time below and initially
closed detail controls. The five primary captures show neutral gray background
and white navigation; no unused backdrop blur remains in their XML.

Executable replay grounded in the observed native hierarchy passed Bundle
closed/open/close/reopen, Profile info/equipment round-trip with currency labels
retained, Night media preview open/close, and10 primary transitions. An earlier
Profile replay timed out because it waited for a label that disappears when the
actual hero collapses; updated assertion waits for the observed dashboard rather
than marking that harness expectation as an app failure. No account mutation.

All evidence is outside Git at C:/Users/kona/.codex/artifacts/vshop-test-20261005-followup/:
final profile-after.png, bundles-after.png, night_market-after.png, shop-after.png,
settings-after.png with XML; interactions.json/log and native detail screenshots.
Intermediate vertical interpretations are retained as profile-before-third.png
and profile-before-longer.png. They are superseded by the final one-third image.
RED evidence: night-native-width-red.log2 failures, player-card-third-red.log2
failures, bundle-height-red.log6 failures. Final-third scoped GREEN119 tests/6
suites; earlier broader layout GREEN134 tests/8 suites. Source reviewers found no
blocker; resize assertions pin refreshed width and exact fitted height.

Physical results cover the exercised default-font views and controls only.
Screenshots/selected-state waits do not establish first-frame latency, FPS or
native Reduce Motion/large-font acceptance. The floating gear overlay obscures
part of the top-right artwork and some More controls. Full source/export checks
for the final one-third correction are recorded separately below when complete.

Final one-third source snapshot: TypeScript and ESLint max-warnings0 PASS;
212suites/2936tests PASS,109.065s. Overall pnpm run check remains FAIL at existing
braces advisory1240992; no audit allowlist/dependency changes in this layout task.
Coverage75.51% statements remains below80%. Separate Android export PASS:
9.17/12MiB total,7.86/8MiB Hermes,0.92/1.5MiB largest; unique temp removed.
Diffcheck PASS. Logs check-third-final.log, export-third-final.log, diff-check.log
refer to the final one-third image and taller Bundle snapshot. Native metadata
in native-runtime.json confirms main4.1.10/code91 debuggable client serving source
through Expo8081; installed native version/icon are not changed by the JS reload.

## Profile identity footer and rank spacing — October5 follow-up

Removed only the account-level footer below the motto; retained the badge on the
artwork and the hero level. Identity art remains one-third row width/120dp height.
Space-between metadata and an8dp minimum gap put the motto lower; the static rank
row gets4dp separation while its centered heading shifts upward2dp. Animated act
layers, cache and player-card/player-title callbacks are unchanged.

Main Expo default-font capture at C:/Users/kona/.codex/artifacts/vshop-profile-spacing-20261005/
shows no footer and full VP/RP/KC/AP labels. Raw before/after XML records the motto
heading at1421→1463px, rank headings888→883px and rank value938px vs933px before.
The heading/value gap increased8→18px. Native title picker open/dismiss without
selection passed. The reload initially remained blank; Metro was restarted with
clear cache and its observed recent server reopened. Warm complete reload produced
the final capture after the initial cold capture's intrinsic text clipping.

RED6 intended behavior failures/18 preservation passes preceded edits; scoped
GREEN61/61 in6 suites. Independent source review found no blocker. Final source
gate: TypeScript/lint PASS,212suites/2936tests PASS,109.456s; overallcheck still
FAIL at existing braces1240992 audit, statement coverage75.51% below80%.
Separate Android export PASS9.17/12MiB total,7.86/8MiB Hermes,0.92/1.5MiB largest;
unique output removed and diffcheck PASS. Logs red.log/green.log/check.log/export.log
and native.log/native-spacing.json are in the same external directory. No account
mutation/release/install/push. Static spacing is device-verified at the current
font, not new frame-rate or physical large-font proof.

## Restored white Liquid Glass navigation — October5

User reported the effect disappeared under the earlier opaque-white capsule.
Current material restores the existing page-only light blur and native refraction,
with white translucent veil(.24), selected lens(.32), native tint(.12), dark sharp
labels and border/shadow0. Capsule underlay is clear only with a valid supported
target; white fallback remains for target/platform gaps. Existing shared Reduce
Transparency gives an opaque fallback; hidden/collapsed bar stops backdrop blur.
The existing retained scenes, immediate native lens kick and intent guards remain.

External evidence C:/Users/kona/.codex/artifacts/vshop-white-glass-20261005/:
profile-before.png is opaque; profile-after/final-after and more-top/scroll-after
PNG/XML show the restored light glass. Actual primary-tab-backdrop-blur and
navigation-native-refraction mount in all sampled views on main Expo45218ba.
Ten accepted primary route selections and one More scroll PASS; foreground text
and controls stay sharp. Screenshot/hierarchy evidence establishes this bounded
material/rendering outcome, not all driver/accessibility/performance branches.

backdrop RED3 behavior failures/5 passes plus auth rapid-retarget RED1 failure
precede source edits. Scoped5suites/120tests PASS4.164s. Independent source review
found no actionable layering/ownership/preferences issue. Fullcheck TS/lint and
212suites/2939tests PASS61.606s, but overallFAIL remains at braces1240992 audit;
coverage75.51% below80%. Separate Android export PASS9.17/12MiB total,
7.86/8MiB Hermes,0.92/1.5MiB largest; output removed, diffcheckPASS.

Debug replay gfx-after:765frames,237janky30.98%,P9540ms. There is no matched new
before sample and no causal FPS gain/60fps claim. Live RT/platform/hidden material
branches are source-tested; they were not physically toggled in this window.
No account mutation, build installation, release or push was performed.

## Reference commerce skin popup and Profile scroll boundary — October5

User supplied IMG_3584.png and later clarified the skin viewer must be a popup,
not a full-screen sheet. Store, Night Market and Bundle weapon items now use one
image-first centered white popup with16dp horizontal gutter, four rounded corners
and an88%-viewport height cap. Header uses the real public tier icon when its
strict UUID CDN path is valid. Hero art is contained on the tier tint; Video is
opt-in; one selected Level or Variant owns both displayed still and playable clip.
Level uses a red segmented rail and Variant uses real catalog swatches. Overflow
scrolls inside the popup. Close/Back, lazy Portal order, error/loading lifetimes,
old-callback retirement and video decoder cleanup remain.

Bundle weapon cells gain the same preview button without changing price or owned
state; non-weapon accessories stay informational. Store's220ms single-preview vs
double-wishlist timer/unmount guards and Night's2x3 geometry remain. A strict
public tier-icon URI builder rejects non-UUID/path/query input; real Select tier
HEAD returned HTTP200 image/png. No purchase/equip/wishlist/account mutation was
performed during implementation.

Profile's mode visual is144x36dp for normal Vietnamese inside the retained48dp
native target; long localized text can grow within viewport constraints. The
shared vertical FlatList for equipment/skins/collection disables Android
overscroll stretch while keeping RefreshControl and nav clearance.

External evidence C:/Users/kona/.codex/artifacts/vshop-skin-preview-20261005/:
old actual viewer before PNG/XML; behavior RED logs for model/popup/owner/fallback,
selection and centered-popup changes; integrated current scopes211 tests/10
suites and centered-popup35/35. Profile scroll RED1 then GREEN34/34 is under
vshop-profile-scroll-boundary-20261005. Final source snapshot: TypeScript/lint
PASS,217suites/3021tests PASS60.425s; overallcheck still FAIL only at existing
braces1240992 audit and statement coverage remains below80%. Android export
PASS9.18/12MiB total,7.87/8MiB Hermes,0.92/1.5MiB largest; temp removed and
diffcheckPASS.

Expo Metro remains running on8081. Main client loaded the latest source once,
then the physical popup replay was fail-closed when another application owned the
foreground; no input was injected. Store/Night/Bundle centered-popup screenshots,
video/selector/Back replay, compact mode round-trip and physical Profile end-drag
remain pending. Source/export evidence does not substitute for those device cases.
