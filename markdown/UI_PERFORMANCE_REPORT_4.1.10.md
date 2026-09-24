# VShop 4.1.10 UI Performance Report

**Status:** Baseline captured; final local-release measurement pending  
**Device:** Android `45218ba` (`23013PC75G`, 1080×2400)  
**Package:** `com.android.vshop`

## Baseline

Production `4.1.9 (90)` with OTA group
`5ba85a7f-a273-45a0-8ccc-90c13c1fc97a` was measured after startup and tab
content reached steady state. `gfxinfo` was reset immediately before each
Profile-entry interaction.

| Warm transition | Janky frames | P95 | P99 |
|---|---:|---:|---:|
| Bundles → Profile | 6.52% | 121 ms | 150 ms |
| Shop → Profile | 6.82% | 101 ms | 125 ms |
| Night Market → Profile | 8.89% | 69 ms | 125 ms |
| Settings → Profile | 7.27% | 22 ms | 27 ms |
| Bundles → Profile, repeat | 8.70% | 113 ms | 150 ms |

The baseline confirms intermittent native attach/layout spikes rather than a
uniformly slow 220 ms transition. Cold startup/reload frames are excluded.

## Source changes under test

- Android primary scenes remain attached after preload.
- Secondary screens freeze while inactive.
- Floating indicator adopts the accepted destination icon immediately.
- Hidden Profile dashboard mount waits for focus, transition completion, and an
  idle slot; blur cancels pending work.
- System chrome stores ignore identical writes.

## Acceptance gate

```text
Profile-entry median jank <= 5%
Profile-entry P95 <= 32 ms
No repeated warm frame >= 100 ms
No blank/double scene or stale indicator icon
No monotonic memory growth over ten primary-tab cycles
No TypeError/FATAL/ANR/SIGSEGV
```

## Final local-release evidence

Pending installation of the locally signed `4.1.10 (91)` production APK. Raw
measurement JSON will be stored under `.codex-tmp/performance/` and will not be
committed because it contains device/session timing metadata.
