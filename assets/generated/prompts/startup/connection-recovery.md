# VShop connection recovery asset brief

**Status:** generated and visually reviewed on physical QA; approved for this source candidate.
**Purpose:** A small original supporting illustration in the exceptional startup-recovery state. The normal launch screen shows only the actual application icon.
**Output:** Square transparent PNG; recognizable at64–88dp; target compressed runtime footprint<180KiB.
**Direction:** Neutral light VShop palette, restrained frosted material, charcoal shopping cart cue from existing identity, clean silhouette and generous alpha margins. No glow/background scene/typography or game characters.
**Reference:** Existing project-owned `assets/images/icon-v2.png` cart identity; permission supplied by the user to create application assets. Do not replace the launcher logo or reproduce Riot artwork.

## Prompt

Use case: stylized-concept. Asset type: small application connection-recovery illustration, transparent square PNG. Create an original minimal frosted-glass shopping-cart sculpture paired with a single small disconnected-link symbol. Reference image shows VShop's charcoal/white cart identity; use it only as a brand cue, preserve the app's simple neutral character. Cart is charcoal gray with a softly frosted white basket and two small circular wheels; disconnected-link cue is restrained graphite, visually secondary. Front three-quarter view with modest depth, smooth crisp edges, minimal studio shading, centered composition occupying60% of square and ample transparent safe margin. No text, letters, slogans, currency, UI panels, skin/agent/game imagery, neon, strong glow, environment, watermark or artist imitation. Must remain readable when rendered at72dp on #f4f6f9. Output genuinely transparent background.

## Provenance

- Tool: built-in ImageGen, authorized by user.
- Date:2026-10-03.
- Reviewer: Codex technical/visual review; actual render evidence required before runtime promotion.
- Original: `assets/generated/concepts/startup/vshop-connection-recovery-v1.png`.
- Runtime: `assets/generated/production/startup/vshop-connection-recovery-v1.png`,
  256x256 RGBA, 35,327 bytes, alpha range0..254, SHA-256
  `2CCA81882460A011D2AF90815F8370A34B73750FECA46EC24CE6746191E95788`.
- Physical render at72dp reviewed in external `new-startup-recovery-final.png`.
  Model identifier was not exposed by the tool. Downscaling/PNG encoding only.

## Checks

- [x] Alpha/crop and device-size readability reviewed.
- [x] Identity/palette compatible; no copyrighted external artwork.
- [x] Optimized footprint and Android export budget pass.
- [x] Recovery screenshot reviewed; asset used only in recovery. User's later
  approved normal design includes a separate launch mark, status and progress.
