import { StyleSheet } from "react-native";

import { COLORS, GLASS_MATERIAL, RADIUS, SPACING, TYPOGRAPHY } from "~/constants/DesignSystem";

export const expressionStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "stretch",
    gap: SPACING.xs,
  },
  overflowRow: { flexGrow: 1 },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: SPACING.xxs,
    paddingVertical: SPACING.xs,
    gap: SPACING.xxs,
    alignItems: "center",
    borderRadius: RADIUS.md,
    overflow: "hidden",
    backgroundColor: GLASS_MATERIAL.surface,
    borderColor: GLASS_MATERIAL.border,
    borderWidth: 1,
  },
  // Unexpected extra upstream slots stay reachable without shrinking targets.
  overflowCard: { minWidth: 48 },
  image: { width: "100%", maxWidth: 28, height: 28 },
  kind: {
    width: "100%",
    fontSize: TYPOGRAPHY.caption,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
  },
  slot: {
    width: "100%",
    fontSize: TYPOGRAPHY.caption,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
  },
});
