# Larger daily Store cards and responsive primary navigation

## Accepted direction

Run the actual main application through Expo dev client/Metro on device45218ba.
All pages use the existing light-gray COLORS.BACKGROUND token. Keep restored
materials and compact cards elsewhere; enlarge the four daily Store offers
into a two-by-two phone grid. Bundle stays initially closed with tap-to-reveal
details and retains its horizontal scroll owner.

## Execution

- [ ] Store-only behavioral RED for two columns, then responsive geometry and
  callback/filter regression GREEN. No Night/Bundle/Profile geometry change.
- [ ] Measure actual primary-tab press delivery, navigation dispatch and React
  commit through a bounded opt-in DEV-only timing buffer read via Expo/Hermes.
  No token/account payloads. Capture an isolated native navigation frame window.
- [ ] Identify and fix the measured delay; preserve tabPress preventDefault,
  rapid latest-intent, hidden/secondary/unmount and Reduce Motion guards.
- [ ] Re-run scoped navigation suites and final full checks/export after freeze.
- [ ] Physical Expo screenshots and read-only interactions: five primary pages,
  larger Store cards, Bundle reveal/scroll/close/reopen, Profile picker open/close,
  More secondary routes, navigation rapid retarget and log/crash inspection.

Timing qualifications: JS press-to-commit is not first presented pixel latency.
gfxinfo is a bounded Android frame sample, not an automatic60fps claim. Keep
the exact installed package/version distinct from the served development source.

## Expo/native measurement result

Main installed package com.android.vshop4.1.10/code91 accepts the current Expo
development source. Same12 primary presses were injected by ADB using cached
UI-grounded coordinates, with no UIAutomator tree reads between touch and commit.
Before:80.17–990.87ms press-callback→React-commit; median766.15ms.
After Profile/More presentation retention:82.69–124.76ms; median95.755ms.
Native UI kickoff/dispatch generally remains around1–2ms.

The corrected DEV recorder preserved renderer samples and identified Profile
focus/blur updates629–666ms plus More~200ms. Profile now retains JSX with all
86 capture dependencies; More retains content/API and inert SVG rim owners.
An instant-glyph experiment did not improve response and was fully reverted.
Original morph/lens motion and all lifecycle/prevented-press guards remain.

Before gfxinfo471frames/177janky37.58%,P95=40ms; after465/17437.42%,P95=48ms.
Responsiveness improved; this window does **not** prove improved animation FPS
or first-presented-pixel latency. No60fps claim. Raw nav-clean-before/after logs,
events, renderer samples and frame stats are outside Git in app-test-20261004/.
