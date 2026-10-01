# Responsive Profile Loadout and Compact Expressions

**Status:** active

**Execution:** resumed by the user's active goal on 2026-09-30. See `2026-09-30-liquid-glass-completion.md` for current ownership and verification.

**Request:** Profile selection must update immediately and let the user continue opening/selecting other equipment while Riot applies requests. Graffiti/flex's four existing slots must sit side by side in compact white cards.

## Evidence and boundaries

- Existing handlers already display an optimistic loadout, but `updatingLoadout` rejects every later selection and is included in the picker's global `pickerBusy` flag.
- Riot v3 sends the complete loadout with `Version`. Simply issuing concurrent PUTs can overwrite another slot or reuse an obsolete version. Existing GET confirmation waits 650ms; it must not become an interaction lock.
- Existing pending refresh expires after 8 seconds even while a write can still be unresolved. Keep queued/sending intent protected from that timer and reject old reads/account/token/generation completions.
- Native Profile was explored earlier in this task. The phone is now being used outside VShop: stop device interaction and do not retain or publish unrelated captures. New live mutation/perceived timing QA needs a user-controlled VShop session; source tests do not prove game-PC timing.
- Do not auto equip a real account for smoke testing. Preserve the two pre-existing dirty viewport/refresh files and all unrelated Party/Bundle changes. No APK/OTA/push in scope.

## Design and implementation

1. Use immutable, account-scoped serialized writes with latest-wins coalescing. Apply every user intent to the local display immediately; keep only the newest unsent choice per logical slot/identity field/weapon. Rebase later payloads on the acknowledged server version, retaining all other accepted/pending choices.
2. An earlier response cannot replace later display choices. Failure rolls back only an intent still current for that field, not a newer same-slot or other-slot choice. Stop stale sessions and prevent late UI/cache writes after owner changes/unmount. Confirmation is read-only/background; no silent repeated mutation or fabricated version/success.
3. Remove global interaction locking from mutation handlers/picker; owned-option loading may still disable unavailable options. Close a chosen picker immediately, expose non-blocking synchronization/error feedback, and keep full-loadout consistency/race protection.
4. Render actual expression/legacy spray slots in a non-wrapping row. Four cells share available width, use existing white tokens and cached images, smaller art/labels, full accessible labels and >=48dp targets. Respect app viewport/scaling and retain original callbacks/slot order. Do not invent owned items or fake data.

## Acceptance and verification

- [x] Deferred PUT tests demonstrate immediate selection, opening/selecting another picker during a write, no parallel full-loadout PUT, coalesced same-slot taps, preserved changes to multiple slots, correct server version on the next request. Source queue/hook regressions and isolated native normal/Reduce Motion runs pass; see the main completion plan for evidence.
- [x] Tests cover rejected/ambiguous writes, failed older selection versus newer choice, old confirmation/GET/refresh, ownership/credentials/generation switch, unmount cleanup and retained callbacks. Added real cache-to-queue lost-ACK tests after independent review.
- [x] Contract tests cover v2/v3 payload/version/session/cache behavior; no assertion of applied changes from forced request fields. Invalidated force reads return no proof, and non-force cached reads cannot resolve uncertainty.
- [ ] Four actual graffiti/flex cells render side by side with compact geometry, individual callbacks, image sizing and accessibility; empty/legacy/long-label/font-scale cases are safe.
- [ ] Targeted RED/GREEN, scoped coverage >=80%, independent review, full `pnpm run check`, Android export/budget and `git diff --check` pass after writes stop.
- [ ] Native UI/rapid-selection and PC application timing are separately labelled. Do not mark runtime completion without observed evidence.

Native isolated QA now passes four checks in both motion modes: compact one-row
expression geometry, second picker open during the first pending write,
serialized final skin/title authority, and field-only failure rollback. These
are fake-transport tests; no real Riot mutation or PC application timing is
claimed. Full check is now 158 suites / 2,185 tests plus Android export PASS.
Broader fetch-module coverage and remaining device accessibility/scale checks
are still open, so this plan is not marked done.

Follow-up: the fetch-module coverage gap is closed at 97.89% lines / 85.08%
branches (96.33% statements / 96% functions). New behavior tests exposed a
fallback hydration overwrite; seven RED cases now pass after protecting pending
display within its owner and clearing it on auth/session changes. Full gate is
now 159 suites / 2,232 tests plus export PASS. On physical `45218ba`, all four
actual slot controls opened and dismissed the correct picker without selecting
or changing any equipment. Device scale/TalkBack and real apply latency remain
distinct, unverified items; no broad completion claim is made.

Latest physical verification: all4 actual selectors again opened/dismissed with
unchanged equipment. The isolated DEV fixture also passed in normal and Reduce
Motion on physical45218ba, proving editable selection during a synthetic5s
save, serialized writes, correct final version and field-scoped rollback.
Reports are linked from the glass-regression repair plan. This is not a real
Riot write or PC application-latency claim. Large-font/device accessibility and
the broader motion/performance audit remain separate.
