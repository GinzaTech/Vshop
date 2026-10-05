# Reference skin preview for Store, Bundle and Night Market

User supplied C:/Users/kona/Downloads/IMG_3584.png. Implement its composition:
white rounded sheet, rarity icon and full skin name beside a48dp close button,
large contained16:9 weapon art on its real tier tint, opt-in Video chip,
level segmented tabs with red selection, and variant swatch tiles underneath.
Use current typography/radius/color/spacing tokens and public Riot catalog art;
no generated bitmap or copied fake variants. Localized labels retain existing
levels/chromas/level text with a new singular Video/Image label if needed.

Latest clarification: keep the viewer as a centered floating popup, not a
full-screen or bottom sheet. Reserve16dp horizontal and visible vertical space,
round all four corners, cap height at88% of the viewport and scroll only the
popup body when needed. The backdrop stays light enough to preserve context.

## Owners and data

Preserve MediaPopup's lazy Portal ordering, cache identities, decoder/error
lifetime guards, Back/close, and primary-nav accessibility isolation. Extend
MediaPopupEntry with optional still/video/swatch/tier metadata so legacy callers
stay compatible. Store gets atomic image/video mode resets; selection controls
must reject stale owner callbacks after another viewer opens.

Selectors preserve the original single selected media model: clicking a level
shows that level's actual still/clip; clicking a variant shows that variant's
actual still/clip. Do not imply unsupported combined level+variant rendering.
Video and still source always belong to the same selected entry. A rich skin
with only video opens an honest missing-image placeholder until Video is pressed;
legacy generic video-only callers retain their existing autoplay behavior.

Extract the shared old commerce media mapping into utils/skin-preview.ts before
its metadata behavior is extended. Store/Night use it; Night gains actual chromas.
Bundle weapon cells become preview buttons with the same prices/ownership and
horizontal disclosure/carousel. Non-weapon accessory cells remain display-only.
Single-tap Store preview and double-tap wishlist/cancellation remain unchanged.
No purchase/equip/account/network mutation is introduced.

## Tasks

- [x] Inspect reference and observe actual old viewer before authoring tests.
- [x] RED for actual image-first sheet/header/tabs/swatches/video behavior and
  shared metadata mapping; no missing-module RED.
- [x] Implement model/store/media lifetimes and reference-based adaptive sheet.
- [x] Wire three commerce surfaces, preserving interactions/ownership.
- [x] Scoped regressions and independent source review, then freeze writes.
- [x] Full source checks and Android export with exact audit/coverage outcomes.
- [ ] Reload main Expo, capture Store/Night/Bundle viewer; video/selection/Back
  replay without wishlist/purchase/equip mutation. Compact mode button also capture.

Evidence: C:/Users/kona/.codex/artifacts/vshop-skin-preview-20261005/.
Reference acceptance at default phone size is separate from mocked/generic tests.

## Evidence and current boundary

Old actual viewer captured as viewer-before.png/XML before tests. RED checkpoints:
model-popup-red.log5 behavior failures/1 pass; play-owner-red.log2 failures;
missing-photo-red.log2 failures; selection-media-red.log1 failure; popup-red.log
1 failure for the latest centered-popup clarification. All preceded their source
changes. Commerce integration19/19 and preservation9/9 PASS. Current integrated
scope211/211 tests in10 suites; centered popup subset35/35 in4. Tier URI builder
45/45 and existing public API combined49/49 PASS; real Select tier PNG HEAD returned
HTTP200. Source review approved final single-selection ownership, fallback/cache,
callback and commerce boundaries before the centered layout-only follow-up.

Final frozen source check: TypeScript/lint PASS,217suites/3021tests PASS,
60.425s. Overall check FAIL only at existing braces advisory1240992; statement
coverage remains below the project80% requirement. Android export PASS:
9.18/12MiB total,7.87/8MiB Hermes,0.92/1.5MiB largest; unique temp removed.
Diffcheck PASS. Logs check-popup-final.log/export-popup-final.log.

Metro remains running on8081 and main com.android.vshop loaded the new source.
Native viewer replay was interrupted because another foreground app owns the
phone; fail-closed guard injected no input. Store/Night/Bundle centered popup,
video/level/variant and Back screenshots remain physically pending.
