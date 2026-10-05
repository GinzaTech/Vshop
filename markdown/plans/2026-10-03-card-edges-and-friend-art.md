# Night Market/Combat card edges and friend art

User reports blurred halos on Night Market and Combat cards and missing friend
card images. Keep the mobile regression effort active while correcting these.

## Accepted scope

Night Market and Combat/Party repeated cards use a flat opaque surface with one
clear border, zero elevation/shadow and no extra optical rim. Keep existing tier
colors, radius, media, prices, read-only actions and disabled permissions. Add an
explicit reusable flat variant; default glass elsewhere keeps its contract.
Do not remove navigation optics or unrelated dialog depth.

Friends: derive actual card art from trustworthy presence identity and the
existing public catalog. Inspect presence parsing and late asset readiness.
Preserve last usable same-session metadata and owner/reset boundaries. Never
invent a friend's chosen card or bulk-fetch private account data to hide missing
metadata. Use sanitized aggregate DEV diagnostics if runtime inputs are needed.

## Evidence

- [x] RED/GREEN tests for flat edges, opaque backgrounds and unchanged actions.
- [x] RED/GREEN fixture coverage for known card normalization/late catalog readiness.
- [x] Physical before/after Night Market, Combat and Friends on45218ba/QA92,
  with final Metro source provenance. No live account mutation.
- [x] Final type/lint/test/export, independent review and mobile report update.

## Completed scope and remaining data limits — 2026-10-04

Combat cards are96dp with two-line status; offline/away/DND and validated root idle
are excluded only from the Party projection. Known card identities resolve;
the observed31 online users have10 known card IDs and21 missing identities.
The latter retain honest placeholders. Full user-authorized related responses
are captured outside Git with credentials redacted; final capture flag is off.
Latest source187 suites/2570 tests PASS, export9.13MiB/Hermes7.82MiB PASS;
overall check remains FAIL at the upstream braces audit. Broader live-game,
positive login/handoff, release-performance and80% total-coverage gaps remain.
