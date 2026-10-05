# UI bug report — 2026-10-03

Confirmed control-flow findings below are pinned by RED→GREEN tests as execution completes. Native verification is independent and recorded in UI_TEST_RESULTS; source success alone does not close visual/performance acceptance.

| ID | Priority | Defect | Source | Root cause | Repro / observable expectation | Verification |
|---|---|---|---|---|---|---|
| UIQ-01 | P1 | Collection export stops at 48 items | [source](../../components/profile/CollectionCheckerExport.tsx) | 24→48 leaves allItemsRendered=false so effect never schedules next batch. | Advance fake timers with 49/72 skins; expect full sheet and one capture. | Collection batching regression |
| UIQ-02 | P1 | Old account remains visible after owner change | [source](../../features/profile/useProfileFetch.ts) | Missing-cache owner hydration retained old state and global in-flight guard blocked new read. | Hold A, switch to B without cache, resolve B then A; B remains. | Profile fetch owner regression |
| UIQ-03 | P2 | Cold network error appears as empty profile | [source](../../features/profile/useProfileFetch.ts) | Loadout rejection converted to null with no recoverable error. | Reject cold read; show error; warm failure preserves cache. | Profile fetch error regression |
| UIQ-04 | P2 | Old request clears current spinner | [source](../../features/profile/useProfileFetch.ts) | Completion/finally not owned by request sequence. | Force overlapping read; older finally must not clear newer spinner. | Profile fetch sequence regression |
| UIQ-05 | P2 | Picker options lack selected/disabled semantics | [source](../../features/profile/ProfilePickerModal.tsx) | Only visual border encodes selection in several picker branches. | Render seven picker variants while loading/saving; assert role/state and callbacks. | Picker responsiveness |
| UIQ-06 | P2 | Close targets undersized | [source](../../features/profile/profile-screen.styles.ts) | Sheet 36dp and nested chroma 28dp without sufficient native hit bounds. | Assert both close controls >=48dp; inspect actual Android bounds. | Picker close target |
| UIQ-07 | P2 | Modal background and focus remain accessible | [source](../../features/profile/ProfileScreen.tsx) | Background host/fixture lacked hidden contract; browser focus stays on trigger. | Open picker; hide background, focus Close, dismiss restores trigger. | Modal a11y component + browser/native |
| UIQ-08 | P2 | Pager content resets on viewport width change | [source](../../features/profile/useProfilePager.ts) | Keyed native pager remounts at zero while selected tab is retained. | Select skins/collection, resize400→320; offset=index*320 with no animation. | Pager resize |
| UIQ-09 | P2 | Primary preload pauses after secondary Back | [source](../../hooks/usePrimaryTabPreload.ts) | Immediate layout transitionEnd sees old passive-effect active key. | Emit same-turn start/end before passive key update; idle preload resumes. | Primary preload ordering |
| UIQ-10 | P2 | Superseded intent disagrees with committed route | [source](../../features/navigation/FloatingTabBar.tsx) | Pending intent persists when another destination commits. | Accept Store, programmatic Profile commit; indicator selected Profile and Store can be pressed again. | Navigation intent |
| UIQ-11 | P2 | Live Reduce Motion does not settle current transition | [source](../../features/navigation/LiquidNavigationShell.tsx) | Same-route early return discarded preference changes. | Toggle during delay/fade/secondary entrance; cancel and settle once. | Scene reduction |
| UIQ-12 | P2 | Preference toggle drops glyph settle timer | [source](../../features/navigation/FloatingTabBar.tsx) | Same-icon early return after repair timer cleanup. | Toggle Reduce Motion mid-morph; immediately settle current glyph. | Glyph reduction |
| UIQ-13 | P2 | Reanimated System retains old OS motion snapshot | [source](../../app/_layout.tsx) | Live hook and Reanimated policy read different sources. | Live off/on toggles drive public ReducedMotionConfig; no private manager API. | Global motion policy |
| UIQ-14 | P1 | Upgrade response from old account overwrites new account | [source](../../app/(authenticated)/item_upgrades.tsx) | Async setters lack owner/credential/request guard. | A delayed, B resolves first, A resolves late; retain B; cover token and unmount. | Item upgrade race |
| UIQ-15 | P2 | About refresh overwrites a just-edited toggle | [source](../../hooks/useAboutScreenData.ts) | Storage snapshot awaits network and republishes stale local overrides. | Edit override while refresh pending; persisted intent remains. | About local override race |
| UIQ-16 | P2 | Leaderboard rows belong to previous season on failed switch | [source](../../hooks/useLeaderboardData.ts) | Selection changes before row ownership changes. | Load seasonA→selectB→rejectB; never label A rows as B. | Leaderboard failed season |
| UIQ-17 | P2 | Refresh error hides usable match detail cache | [source](../../app/(authenticated)/match_details/[id].tsx) | Full-page error branch wins over a usable viewModel. | Cached details→failed refresh; preserve scoreboard plus error feedback. | Match cache error |
| UIQ-18 | P2 | Stale media callbacks finish a newer preview | [source](../../components/popups/MediaPopup.tsx) | All media callbacks update one shared loading flag. | A→B→A with retained A load/error; latest spinner remains; video error clears spinner. | Media lifetime regression |
| UIQ-19 | P2 | Back consumed after player overlay has disappeared | [source](../../features/combat/CombatSessionScreen.tsx) | Handler tests selectedSubject; rendering tests player still in roster. | Drop selected player from roster; Back must propagate. | Combat overlay lifecycle |
| UIQ-20 | P2 | Refresh does not retry failed match intel | [source](../../features/combat/useCombatPlayerIntel.ts) | One-shot same-match gate suppresses retry after failure. | Failed intel→network restored→pullrefresh same match; request again. | Combat intel retry |
| UIQ-21 | P1 | Handoff network error permanently disables send | [source](../../app/session_handoff.tsx) | Send permitted only in idle; failure remains error until remount. | Reject then explicit user retry succeeds; duplicate busy callback denied. | Handoff retry |
| UIQ-22 | P2 | Countdown deadline moves when typing search | [source](../../app/(authenticated)/accessories.tsx) | Date.now()+remaining is recomputed on every render. | Advance time then type query; deadline remains stable. | Accessories countdown |
| UIQ-23 | P2 | Economy loadout metric returns difference | [source](../../components/match-detail/EconomyChart.tsx) | Metric switch lacks correct loadout calculation. | Distinct total/difference/spent fixture; each metric shows its own series. | Economy metric |
| UIQ-24 | P2 | Round detail scroll anchor is fixed430px | [source](../../app/(authenticated)/match_details/[id].tsx) | Scroll target does not follow measured panel position/font scale. | Two layout anchors; select round scrolls to current measured anchor. | Round anchor |
| UIQ-25 | P2 | Agent overlay has no visible close or named ability controls | [source](../../components/GalleryAgent.tsx) | Modal relies on hardware Back; icon abilities omit role/name/state. | Close callback available; ability name/selection and callback exposed. | Agent a11y |
| UIQ-26 | P2 | Back icon renders missing-font placeholder | [source](../../app/_layout.tsx) | Paper BackAction hardcodes font icon despite Provider settings. | Render explicit Appbar.Action/PaperBackIcon; no missing-library warn; Back callback works. | Paper Back regression + runtime |
| UIQ-27 | P3 | Decorative native SVG prop leaks boolean to web DOM | [source](../../components/ui/LiquidGlassSurface.tsx) | Native accessible=false forwarded to actual svg DOM. | Web prop undefined with aria-hidden; native retains accessible=false. | Glass platform semantics |

## Evidence and implementation review

Tests exercise deferred response ordering, queue/callback ownership, fake timer boundaries, native-target sizing and actual selection callbacks. Original 49/72 export RED captured only48 cards; scoped GREEN renders all49/72 before capture. Profile fetch regression guards subject/region/credential/generation; cold errors publish retry content while cached data remains. UI state resets do not fabricate server ACKs.

Actual browser QA observed the Back placeholder and focus on a hidden background trigger. Explicit back renderer and modal focus handling were verified on browser. Android QA confirmed selected skin state and close bounds after patches, but complete TalkBack/focus restoration remains subject to native tests below.

## Suspected gaps / blocked verification

- TalkBack traversal/focus restoration on all modal kinds; explicit focus APIs do not establish all assistive technology behavior.
- Narrowest supported native tab slots may fall under48dp; project currently specifies44dp shared minimum and five equal54dp-high slots. Actual narrow-device overlap needs measurement.
- Collapse/blur native cost and new lens shader parity need 4.2.0/code92 binary. No arbitrary animation timing or shader changes were made to improve a score.
- Agent role filters compare localized game labels; a locale/cache mismatch remains suspected until a failing fixture exists.
- Registered contracts/about/item_upgrades routes lack a discovered in-app menu entry. No feature deletion inferred.
- Account mutation, purchase, queue, agent lock, chat send and real handoff are excluded from live testing; mocked local transport proves UI behavior only.
- Appearance differences that agree with the accepted design are not defects. No new assets/theme/typography direction was introduced.

## Baseline/environment failures

Initial untouched-source full gate:165 suites PASS/1 FAIL,2366 tests PASS/1 FAIL; party-invite test exceeded5000ms under concurrent work. Isolated unchanged test suite:40/40 PASS; final full gate must recheck. Metro localhost bound::1 and produced a native EOF; IPv4 LAN binding plus ADB reverse solved transport. Physical USB disconnected before initial benchmark and later reconnected. These are distinct from UI regressions.
