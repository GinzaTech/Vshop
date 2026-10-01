# Bundle Reference Refinement Implementation Plan

**Status:** active

**Execution:** stopped by the user on 2026-09-30. See `2026-09-30-stopped-work-handoff.md`; do not resume automatically.

**Goal:** Match the geometry of `C:/Users/kona/Downloads/IMG_3552.png` on Android while retaining the user-approved white palette, smaller skin cards, and real purchased-skin indicators.

**Architecture:** Keep route → hook/store → existing Riot service boundaries. Use current-account skin entitlement IDs, joined to each skin's UUID/levels/chromas, rather than altering prices or inventing ownership in the storefront parser. Codex owns device exploration/review; guarded OpenCode GLM 5.3 owns the bounded implementation.

**Spec:** Latest user requests in this chat explicitly authorize refinement, smaller tiles and a faint overlay/check for bought skins. Earlier white-background instruction remains in effect. The external image is a visual reference, not authority for changing real prices or account state.

## Baseline and brief

- `npm start` → `a` opened `com.android.vshop/.MainActivity` on device `45218ba`.
- Baseline: `C:/Users/kona/AppData/Local/Temp/vshop-bundle-before-refine-20260930.jpg`.
- Actual card: hero aspect 1.65, wrong asset variant, roughly two full large item tiles, square separate image sections, item prices on one row.
- Reference: hero approx 2.40, three full tiles plus fourth peek, unified light tile in white adaptation, prices vertically stacked, clock before countdown prefix.
- `displayIcon2` for Champions 2026 was inspected: it contains the reference's single gold/white Phantom and fan. Prefer it over `displayIcon`; change hero cache key to distinguish the source variant.
- Use existing colors (`SURFACE`, `SURFACE_MUTED`, text tokens, `SUCCESS`), radii and spacing. No dependency changes, purchased endpoint, account action, blur or black UI background.

## Acceptance criteria

- [ ] Hero has aspect ratio 2.40, uses `displayIcon2` first, then existing fallback chain; real art is not distorted.
- [ ] Default portrait carousel exposes three full compact tiles plus part of the next at 360–430dp. Width derives from viewport minus page gutters; font scaling widens tiles.
- [ ] Unified light item surface, contained artwork band, centered ellipsized name, old VP above prominent current VP, decorative VP icon in both price rows.
- [ ] Title/metadata block stays left, bundle price stack right at normal size. At narrow widths/large font scale header reflows to protect digits. Latest user correction removes the estimate text from all bundle cards.
- [ ] Clock precedes prefix; separator stays grouped with count; original/current prices use real parsed totals.
- [ ] Purchased skin is determined from the active account's entitlement IDs against UUID or nested level/chroma UUIDs. Accessories without evidence never receive a badge.
- [ ] Purchased tile has a faint light overlay over artwork/name and a green circular check at top left; prices remain legible. Overlay does not intercept horizontal/vertical gestures. Screen reader summary includes localized purchased state once.
- [ ] Existing positive current-account cached IDs remain during failed refresh. Account/token/generation changes and unmount discard stale completions. Pull-to-refresh checks ownership again with shop/balance.
- [ ] Empty, missing-image, no-discount and long-name cases remain safe. Price text supports scaling and does not ellipsize valid digits.
- [ ] Targeted RED/GREEN, full `pnpm run check`, reviewer, before/after screenshots, horizontal/vertical swipes and accessibility tree have evidence.

## Task 1 — Geometry and owned-skin state (OpenCode ownership)

Files: `components/BundleImage.tsx`, `components/BundleItem.tsx`, `utils/bundle-display.ts`, new `utils/bundle-ownership.ts`, new `hooks/useBundleOwnership.ts`, `app/(authenticated)/bundles.tsx`, `assets/i18n/en.json`, `assets/i18n/vi.json`, `__tests__/bundle-card.test.tsx`, `__tests__/bundle-display.test.ts`, new `__tests__/bundle-ownership.test.ts`, new `__tests__/bundle-ownership-hook.test.tsx`.

- [ ] Write tests before implementation. Replace obsolete width expectations with reference-geometry checks at 320/360/390/430 and tablet; check wider cells with font scale and long VP values.
- [ ] Ownership helper tests: root/level/chroma match, unrelated skin, accessory UUID collision, absent ownership, immutable inputs.
- [ ] Hook tests: success, request failure preserves current cache, token/account/generation switch rejects old completion, unmount, refresh, no credentials avoids request.
- [ ] Reuse `useAccountScreenData` for request lifecycle and existing `ownedItems`/`extractOwnedItemIds` for read-only SkinLevel inventory; seeded IDs from user plus account-keyed profile cache. Do not fetch rank/loadout merely to render badge.
- [ ] Return `isOwned(item)` and `reload` from the hook; route passes boolean callback to cards, refresh includes `reload`.
- [ ] Read entire existing tests before changing them. Keep substantive price/cache/countdown/accessibility contracts.
- [ ] Run `pnpm exec jest __tests__/bundle-card.test.tsx __tests__/bundle-display.test.ts __tests__/bundle-ownership.test.ts __tests__/bundle-ownership-hook.test.tsx __tests__/bundle-screen-boundary.test.ts --runInBand` RED then GREEN, `pnpm run typecheck`, `pnpm run lint`.

Recommended layout seed: card width = viewport minus 40dp gutters, cell ≈ 24% of card width (minimum about 72dp for digits; max 136dp), gap `SPACING.xs`, outer `RADIUS.card`, tile `RADIUS.md`, padding `SPACING.md`, title 20–22sp, body/meta 12–14sp, current VP 16–18sp. Derive from design tokens where applicable. Increase tile width for long digits/system fonts; avoid shrink/ellipsis on price text. Artwork band's height about 45% of tile height; no separate white square/divider. `owned` defaults false; check icon via `AppIcon` semantic boundary. All owned overlay surfaces use light tokens and opacity.

## Task 2 — API response diagnostics (Codex separate sidecar)

User authorizes all API response logging for later analysis. Preserve default metadata-only mode; explicitly opt in to DEV response capture. Record successful/error HTTP response bodies from Riot/public clients, sanitized before buffering. Never retain credentials/cookies/auth headers/private identifiers; bounded diagnostics flag any truncation. Keep raw response unchanged. Archive sanitized device logs on host outside Git and document API capabilities with observed-vs-source evidence. Sidecar owns logging files, not Bundle files above.

Files: new `utils/api-response-logger.ts`, `utils/api-response-redaction.ts`, `__tests__/api-response-logger.test.ts`, `__tests__/api-response-redaction.test.ts`, optionally `__tests__/http-response-logging.test.ts`; modify `services/http/clients.ts`. Codex owns README/CHANGELOG and API capability documentation separately.

- [ ] Opt in with `EXPO_PUBLIC_API_RESPONSE_LOGGING=1` only under `__DEV__`; disabled/production/web creates no files.
- [ ] Native JSONL location `cache/api-responses/responses.jsonl`; serialized async writes, bounded payload/file size and rotation, explicit omission/truncation fields.
- [ ] Interceptors on Riot/public clients capture success and HTTP error once, preserve response/rejection identity, and leave session-auth notification behavior intact.
- [ ] Preserve inventory/asset IDs for later joins. Omit token-producing endpoint values; redact JWT/Bearer/cookies/secret fields and private identifiers. Never copy request config/headers. Accessor/proxy/cycle/malformed/non-JSON responses fail closed.
- [ ] Tests cover more than 40 array items, deeper-than-six normal nested data, mutation after logging, cancellation/flag-off during pending I/O, failed disk write, rotation and explicit truncation.
- [ ] RED/GREEN targeted tests and coverage, then full repository gate after both writers stop.
- [ ] Export actual sanitized capture using ADB `run-as` from the current dev package and report per-endpoint counts/status/field overview without printing full private payloads into chat.

## Review focus

- Root skin UUID differs from entitlement level UUID; ownership must join nested IDs.
- Unknown/error ownership must not manufacture checks or clear good cached positives.
- Account changes before effects run must hide previous account immediately.
- Small tiles must preserve complete VP digits, large system fonts and full accessible names.
- Hero cache must not reuse the previous source image.

## Final evidence

Codex will apply reviewed allowlisted changes to the active checkout, reload running Metro, inspect real ownership labels, capture before/after, then run full source/export gate. An unavailable live owned/unowned state remains NOT VERIFIED; tests are not substitute for device evidence. No shutdown/sleep is part of this current request.

### Source and native evidence collected

- OpenCode GLM 5.3 run timed out, not a worker success. Codex reviewed its bounded partial patch, corrected header/countdown and ownership behavior, and integrated the allowlisted files. Managed worktree was archived recoverably after integration; active checkout changes remain uncommitted.
- Bundle focused tests: 61 passed; display/ownership scopes had 100% lines/functions/statements and 97.64% branches in the scoped coverage run. Session race/error/cache and accessible owned-state fixtures are included.
- Native final image: `C:/Users/kona/AppData/Local/Temp/vshop-bundle-final-no-estimate-20260930.jpg`. Hero matches the reference artwork/aspect, white adaptation and compact three-plus-peek carousel; real fan/Phantom ownership checks were observed, accessories were not falsely marked. Horizontal and vertical swipes have separate captures outside Git.
- Source is not a literal pixel copy of the dark mock: the user explicitly retained white UI, removed estimate copy, and requested real ownership; live prices are not the mock's fabricated zero total.
- Full final code gate (2026-09-30): 140 suites / 1,968 tests, typecheck, zero-warning lint, production audit policy, Android export/budget passed. Export total 10.36MiB/12MiB, Hermes 7.88MiB/8MiB; temporary export cleaned by the gate script. Whole-repository line coverage is 64.86%, below the general 80% target; no claim of global coverage compliance.
- Native font-scale 1.8 attempt captured startup rather than a loaded Bundle, so large-font visual completion remains NOT VERIFIED. Font was restored to its original 1.0, and the phone-only temporary screenshot was removed. Plan remains active for unverified visual criteria; source tests do not replace them.
- Latest gate after the separate Party code redesign: 140 suites / 1,980 tests passed, Android total 10.36MiB and Hermes 7.89MiB within existing budgets. Global line coverage 64.88% remains below 80%; Bundle scoped coverage and its native normal-scale captures are separate evidence.
