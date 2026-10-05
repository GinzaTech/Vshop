# Profile rank typography and five-card color alignment

User asks for full current/peak rank names at a smaller size and matching colors
on the three balance cards above and two rank cards below.

User refinement: use the same light gray on-dark surface as the Level pill
(`COLORS.ON_DARK_BORDER`) with the same subtle border for all five.
Reduce rank names from 15sp to 13sp, allow two
lines and bounded font fitting. Keep rank icons, labels and hero transitions.
Do not alter balances, rank data, player dashboard or account actions.

## Acceptance evidence

- [x] RED/GREEN rendered rank-name fitting and shared five-card material (3 tests).
- [x] Existing Profile motion/icon tests retain their contracts (18 scoped tests).
- [x] Physical QA: `profile-rank-gray-handoff.png` shows full Kim Cương 1/3
  and all five light gray surfaces; Level uses the same token.
- [x] Type/lint/full tests and disposable Android export completed. 187 suites /
  2570 tests PASS; overall check FAIL at existing braces audit advisory 1240992.

Evidence lives outside Git at
`C:/Users/kona/.codex/artifacts/vshop-mobile-full-20261003/`.
QA package `com.android.vshop.startupqa`, native 4.2.0/92, phone45218ba;
Final combined JavaScript from `metro-more-glass-handoff.log` and full names
rechecked in `profile-rank-gray-final-source.png`. No production delivery.
