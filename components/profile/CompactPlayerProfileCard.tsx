// ===== CompactPlayerProfileCard.tsx – Nội dung card hồ sơ thu gọn =====
// Dùng trong hero morph của ProfileScreen. Component chỉ dựng nội dung;
// bề mặt, viền và animation do khung hero sở hữu để hai trạng thái thật sự
// dùng chung một card thay vì cross-fade giữa hai card tách rời.

import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CachedImage as Image } from "~/components/CachedImage";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";

type CompactPlayerProfileCardProps = {
  avatarCacheId?: string;
  avatarUrl?: string | null;
  level: number | null;
  name: string;
  regionLabel: string;
  synced: boolean;
  tag: string;
};

/**
 * CompactPlayerProfileCard – Nội dung hồ sơ ngang khi hero đã thu gọn:
 * tên/tag và metadata ở trái, avatar tròn ở phải.
 */
export function CompactPlayerProfileCard({
  avatarCacheId,
  avatarUrl,
  level,
  name,
  regionLabel,
  synced,
  tag,
}: CompactPlayerProfileCardProps) {
  const avatarInitial = (name || "V").slice(0, 1).toUpperCase();

  return (
    <View style={styles.container}>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.watermark}
      >
        V
      </Text>

      <View style={styles.infoBlock}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {name || "--"}
          </Text>
          {tag ? (
            <View style={styles.tagChip}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Icon
              color={COLORS.TEXT_TERTIARY}
              name="star-circle-outline"
              size={12}
            />
            <Text numberOfLines={1} style={styles.metaText}>
              Cấp {level ?? "--"}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <Icon color={COLORS.TEXT_TERTIARY} name="earth" size={12} />
            <Text numberOfLines={1} style={styles.metaText}>
              {regionLabel || "VAL"}
            </Text>
          </View>
          <View style={styles.metaChip}>
            <View
              style={[
                styles.syncDot,
                {
                  backgroundColor: synced
                    ? COLORS.SUCCESS
                    : COLORS.TEXT_TERTIARY,
                },
              ]}
            />
            <Text numberOfLines={1} style={styles.metaText}>
              {synced ? "Đã đồng bộ" : "Chưa đồng bộ"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.avatarRing}>
        {avatarUrl ? (
          <Image
            accessibilityLabel={`Ảnh đại diện của ${name}`}
            cacheId={avatarCacheId}
            cachePolicy="memory-disk"
            contentFit="cover"
            priority="high"
            recyclingKey={avatarUrl}
            source={{ uri: avatarUrl }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{avatarInitial}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    overflow: "hidden",
  },
  watermark: {
    position: "absolute",
    right: 30,
    top: -24,
    color: COLORS.PURE_WHITE,
    fontSize: 112,
    fontWeight: "700",
    opacity: 0.04,
  },
  infoBlock: {
    flex: 1,
    minWidth: 0,
    gap: SPACING.xxs,
  },
  nameRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  name: {
    flexShrink: 1,
    color: COLORS.PURE_WHITE,
    fontSize: 16,
    fontWeight: "700",
  },
  tagChip: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.ON_DARK_BORDER,
    backgroundColor: COLORS.ON_DARK_BORDER,
  },
  tagText: {
    color: COLORS.ON_DARK_TEXT,
    fontSize: 9,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xxs,
  },
  metaChip: {
    minWidth: 0,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xxs,
    paddingHorizontal: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.ON_DARK_BORDER,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  metaText: {
    flexShrink: 1,
    color: COLORS.ON_DARK_TEXT,
    fontSize: 9,
    fontWeight: "600",
  },
  syncDot: { width: 6, height: 6, borderRadius: RADIUS.chip },
  avatarRing: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.chip,
    borderWidth: 2,
    borderColor: COLORS.TEXT_TERTIARY,
    overflow: "hidden",
    backgroundColor: COLORS.ACCENT_DEEP,
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: COLORS.ON_DARK_TEXT,
    fontSize: 24,
    fontWeight: "700",
  },
});
