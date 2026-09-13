// ===== StickyShareBar.tsx =====
// Thanh chia sẻ cố định đáy màn chi tiết trận, chèn safe-area bottom.
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";

/**
 * StickyShareBarProps – Props của StickyShareBar.
 *
 * @param onShare – Callback khi bấm nút chia sẻ trận.
 */
type StickyShareBarProps = {
  onShare: () => void;
};

/**
 * StickyShareBar – Thanh nút "Chia sẻ" full-width ghim dưới màn hình.
 * Padding dưới tự thích ứng safe-area (insets.bottom, tối thiểu 6).
 * Thuần presentational, không side effect.
 *
 * @param onShare – Callback chia sẻ (xem StickyShareBarProps).
 * @returns View thanh ngang chứa nút share.
 */
export function StickyShareBar({ onShare }: StickyShareBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("match_ui.actions.share_match")}
        onPress={onShare}
        style={({ pressed }) => [
          styles.shareButton,
          pressed && styles.shareButtonPressed,
        ]}
      >
        <Icon name="share-variant-outline" size={21} color={MATCH_COLORS.textPrimary} />
        <Text style={styles.shareLabel}>{t("match_ui.actions.share")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: MATCH_LAYOUT.shareBarHeight,
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.lg,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surface,
  },
  shareButton: {
    minHeight: MATCH_LAYOUT.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: MATCH_SPACING.sm,
    borderRadius: MATCH_RADIUS.medium,
    backgroundColor: MATCH_COLORS.tabIndicator,
  },
  shareButtonPressed: {
    opacity: 0.78,
  },
  shareLabel: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
});
