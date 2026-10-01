import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import LiquidGlassBackdrop from "~/components/ui/LiquidGlassBackdrop";
import { FALLBACK_IMAGE } from "~/components/GalleryProfile";
import { COLORS, GLASS_MATERIAL, RADIUS, SHADOWS } from "~/constants/DesignSystem";
import { styles } from "./profile-screen.styles";
import type { ProfileEquipmentSectionsProps } from "./ProfileEquipmentSections";

const presentationStyles = StyleSheet.create({
  featuredInfo: { backgroundColor: GLASS_MATERIAL.denseSurface },
  identityAction: { minHeight: 48 },
});

/**
 * ProfileIdentitySection – Section danh tính: ảnh player card (bấm mở picker),
 * tên card (sửa), khẩu hiệu/title (sửa) và cấp tài khoản.
 * @param {IdentityDetails | null} identityDetails - Dữ liệu identity đã enrich;
 *   null → section ẩn hoàn toàn.
 * @param {Function} onOpenIdentityPicker - Mở picker "player-card"|"player-title".
 * @param {TFunction} t - Hàm dịch i18next.
 * @returns {JSX.Element | null} Section identity hoặc null nếu không có dữ liệu.
 */
export function ProfileIdentitySection({
  identityDetails,
  onOpenIdentityPicker,
  t,
}: Pick<
  ProfileEquipmentSectionsProps,
  "identityDetails" | "onOpenIdentityPicker" | "t"
>) {
  if (!identityDetails) return null;

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.identityContainer,
          SHADOWS.xs,
          {
            backgroundColor: GLASS_MATERIAL.surface,
            borderColor: GLASS_MATERIAL.border,
            borderWidth: 1,
          },
        ]}
      >
        <LiquidGlassBackdrop radius={RADIUS.card} artworkUri={identityDetails.cardArt}
          cacheId={`player-card:${identityDetails.cardId}:display-icon`} />
        <LiquidGlassDecoration radius={RADIUS.card} tone="light" />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("equip_page.identity.card_picker_title", {
            defaultValue: "Chọn ảnh đại diện",
          })}
          activeOpacity={0.86}
          onPress={() => onOpenIdentityPicker("player-card")}
          style={styles.identityImageFrame}
        >
          <Image
            cacheId={`player-card:${identityDetails.cardId}:display-icon`}
            source={
              identityDetails.cardArt
                ? { uri: identityDetails.cardArt }
                : FALLBACK_IMAGE
            }
            style={styles.identityImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            recyclingKey={identityDetails.cardArt}
          />
          <View style={styles.identityLevelBadge}>
            <AppIcon
              color={COLORS.PURE_WHITE}
              decorative
              name="rank"
              size={13}
            />
            <Text style={styles.identityLevelText}>{identityDetails.level}</Text>
          </View>
        </TouchableOpacity>
        <View style={[styles.identityInfo, presentationStyles.featuredInfo]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${t("equip_page.identity.card_picker_title", {
              defaultValue: "Chọn ảnh đại diện",
            })}, ${identityDetails.cardName || t("equip_page.identity.card_fallback")}`}
            activeOpacity={0.75}
            onPress={() => onOpenIdentityPicker("player-card")}
            style={[styles.identityCardNameRow, presentationStyles.identityAction]}
          >
            <Text
              style={[styles.identityTitle, { color: COLORS.TEXT_PRIMARY }]}
              numberOfLines={2}
            >
              {identityDetails.cardName ||
                t("equip_page.identity.card_fallback")}
            </Text>
            <AppIcon
              decorative
              name="edit"
              size={16}
              color={COLORS.TEXT_SECONDARY}
            />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${t("equip_page.identity.motto", {
              defaultValue: "Khẩu hiệu",
            })}, ${identityDetails.titleName || t("equip_page.identity.title_fallback")}`}
            activeOpacity={0.75}
            onPress={() => onOpenIdentityPicker("player-title")}
            style={styles.identityTitleAction}
          >
            <View style={styles.identityActionText}>
              <Text style={styles.identityActionLabel}>
                {t("equip_page.identity.motto", {
                  defaultValue: "Khẩu hiệu",
                })}
              </Text>
              <Text
                style={[
                  styles.identityActionValue,
                  { color: COLORS.TEXT_PRIMARY },
                ]}
                numberOfLines={2}
              >
                {identityDetails.titleName ||
                  t("equip_page.identity.title_fallback")}
              </Text>
            </View>
            <AppIcon
              decorative
              name="forward"
              size={18}
              color={COLORS.TEXT_SECONDARY}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.identityAccountLevel,
              { color: COLORS.TEXT_SECONDARY },
            ]}
          >
            {t("equip_page.identity.account_level", {
              level: identityDetails.level,
              defaultValue: "Cấp tài khoản: {{level}}",
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}
