# Responsive language selection

The physical QA baseline vi -> en leaves the pressed language row on screen for
about ten seconds before returning to More (external video and polling record).
The current handler broadcasts i18next language changes before requesting Back;
every retained translated screen then schedules an urgent React update.

Request Back first and schedule the translation broadcast as a React transition.
This gives native navigation and urgent touch feedback priority while retained
screens reconcile their text. Keep bundled resources and existing locale storage;
do not add timers, asset refreshes, bootstrap runs or remount whole navigators.
Validate supported locale, ignore duplicate selection, and report change failures.

The first priority-only change closed the modal quickly but kept a roughly ten
second translation delay. A single shared language provider/hook removes the
per-consumer language subscriptions. Each retained primary tab pins its last
committed locale while hidden, then adopts the latest on focus. Root/header
translations also use the bridge; fixed translators change with locale so
memoized derived labels stay current. Snapshot writes occur in layout effects,
never speculative renders. Existing namespace readiness and standalone hook
fallbacks remain available; no source imports use the old per-label hook.

Instrumented native observations on QA92/45218ba: i18next change resolves in
about 93–125ms. Provider commit for the unbounded shared tree took 9.225s;
with hidden-tab boundaries VI→EN took 504.65ms and EN→VI 350.58ms. Passive ADB
video and screenshots show complete translated More by the one-second capture.
These are DEV observations, not a production FPS or exact touch-to-pixel claim.
Temporary numerical timing logs are removed from source.

- [x] RED/GREEN actual route handler order, transition priority and guards.
  Actual i18next consumers prove one listener, derived-label refresh, retained
  hidden state and interrupted-render ownership, plus namespace/prefix/tuple
  contracts. Combined More/Profile/navigation scope has42 tests.
- [x] Physical vi/en switches, return destination and stored locale after reload.
  Final source without timing logs: `rank-more-language-handoff.json`, two
  passive captures at host elapsed 1.646/1.649s show translated More. Locale vi
  survived the initial cold reload and was restored after both switches.
- [x] Compare video timing with the recorded baseline; never infer smoothness
  from source tests alone. Report remaining delay if it persists.

Full source: 187 suites / 2570 tests PASS, type/lint PASS. Disposable Android
export PASS, 9.13MiB total / 7.82MiB Hermes. Overall `check` remains FAIL at
the existing braces audit. Total statement coverage73.88% remains below80%.
After the latest More glass refinements, `more-glass-language-final.json` records
both switches on final source, complete translated More in passive captures
at host elapsed2.081/1.602s and restored vi. Exact pixel latency remains unmeasured.
