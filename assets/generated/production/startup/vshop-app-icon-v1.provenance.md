# VShop launcher icon derived from the approved startup mark

Date: 2026-10-04. Explicit user request: use the newly created startup logo as
the application's logo. Design source: the original built-in ImageGen output
documented in [launch-mark.md](../../prompts/startup/launch-mark.md).

No new generation, drawing, retouching or style change. Deterministic Expo
image utilities only resize, encode, center and composite the existing artwork.
Reproduce with `pnpm exec node scripts/generate-launcher-icons.cjs`.

## Source

`assets/generated/concepts/startup/vshop-launch-mark-v1.png`: 1254x1254 RGBA,
1,116,289 bytes. SHA-256:
`ee57c098f9aa59903b4126631643b625e70cac1754b518cadc5e5d062d777258`.
The original 256px startup/splash derivative is preserved.

## Launcher derivatives

| Asset | Format | Preparation | SHA-256 |
| --- | --- | --- | --- |
| vshop-app-icon-v1.png | 1024x1024 RGB; opaque; 557,296 bytes | Original resized with contain and composited over startup #f4f6f9 | 0469a577a59d893952564d52d71ab0164dcba48395bcb37e03799678bc55f950 |
| vshop-app-icon-foreground-v1.png | 1024x1024 RGBA; alpha0..254; 208,167 bytes | Original resized to552px and centered at236,236 on a transparent canvas | 203043157c3a76cd2425c9afa3e8e7d5c537e6054a1848db42135d7d9633e1c0 |

Android background is #f4f6f9. Visible foreground pixels with alpha>=16 have a
maximum center radius of263.55px, inside the312.89px safe circle corresponding
to66/108 of the canvas. Faint alpha below16 comes from the original transparent
image; it is not a new opaque background. Safe-circle guidance:
[Android Developers](https://developer.android.com/codelabs/basic-android-kotlin-compose-training-change-app-icon).

## Verification boundary

Source asset preview, dimensions, alpha, config regressions and Expo resource
generation can be verified locally. Installed launcher appearance requires a
new native build and a device screenshot; JS export or OTA cannot establish it.
