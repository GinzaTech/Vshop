# Neutral gray sampling texture

2026-10-04: user requests gray page backgrounds everywhere, through Expo.
This deterministic2x2 opaque PNG contains only COLORS.BACKGROUND (#eceef0),
updated to the stronger neutral gray on2026-10-05 from the captured user feedback.
Prepared with installed Expo generateImageBackgroundAsync(width2,height2,
contain,backgroundColor#eceef0). No drawing or AI generation.
The shader's pageColor uniform and native backdrop use the same design token.
Previous white/patterned textures are historical artifacts, not runtime sources.
