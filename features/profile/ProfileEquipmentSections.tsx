// ===== ProfileEquipmentSections.tsx – Các section trang bị của màn Profile =====
// Gồm: IdentitySection (player card + title + cấp tài khoản) và
// ExpressionSection (graffiti/flex đã trang bị, fallback spray legacy).
// Component thuần hiển thị — toàn bộ state/mutation nằm ở ProfileScreen.

import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { TFunction } from "i18next";

import { CachedImage as Image } from "~/components/CachedImage";
import AppIcon from "~/components/ui/AppIcon";
import {
  FALLBACK_IMAGE,
  formatSpraySlot,
  type EquippedSpray,
  type IdentityDetails,
} from "~/components/GalleryProfile";
import { COLORS, SHADOWS } from "~/constants/DesignSystem";
import type { EquippedExpression } from "~/features/profile/profile-loadout";
import { styles } from "~/features/profile/profile-screen.styles";

/**
 * ProfileEquipmentSectionsProps – Props chung của các section trang bị.
 * Props của từng component được chọn riêng qua Pick<> để interface rõ ràng.
 */
type ProfileEquipmentSectionsProps = {
  expressionDetails: EquippedExpression[];
  identityDetails: IdentityDetails | null;
  onOpenExpressionPicker: (expression: EquippedExpression) => void;
  onOpenIdentityPicker: (type: "player-card" | "player-title") => void;
  onOpenSprayPicker: (spray: EquippedSpray) => void;
  sprayDetails: EquippedSpray[];
  t: TFunction;
};

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
            backgroundColor: COLORS.PURE_WHITE,
            borderColor: COLORS.BORDER,
            borderWidth: 1,
          },
        ]}
      >
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
        <View style={styles.identityInfo}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={() => onOpenIdentityPicker("player-card")}
            style={styles.identityCardNameRow}
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

/**
 * ProfileExpressionSection – Section biểu cảm đã trang bị: ưu tiên slot
 * graffiti/flex từ ActiveExpressions (v3); nếu rỗng, fallback sang danh sách
 * spray legacy theo EquipSlotID. Không có gì để hiện → trả null.
 * @param {EquippedExpression[]} expressionDetails - Graffiti/Flex đang trang bị.
 * @param {Function} onOpenExpressionPicker - Mở picker cho 1 expression.
 * @param {Function} onOpenSprayPicker - Mở picker cho 1 spray (legacy path).
 * @param {EquippedSpray[]} sprayDetails - Spray legacy đang trang bị.
 * @param {TFunction} t - Hàm dịch i18next.
 * @returns {JSX.Element | null} Section biểu cảm hoặc null khi rỗng.
 */
export function ProfileExpressionSection({
  expressionDetails,
  onOpenExpressionPicker,
  onOpenSprayPicker,
  sprayDetails,
  t,
}: Pick<
  ProfileEquipmentSectionsProps,
  | "expressionDetails"
  | "onOpenExpressionPicker"
  | "onOpenSprayPicker"
  | "sprayDetails"
  | "t"
>) {
  const hasExpressionSlots = expressionDetails.length > 0;
  if (!hasExpressionSlots && sprayDetails.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          { color: COLORS.TEXT_PRIMARY, marginTop: 12 },
        ]}
      >
        {t("equip_page.expressions.equipped_title", {
          defaultValue: "Graffiti & Flex đã trang bị",
        })}
      </Text>
      <View style={styles.sprayList}>
        {hasExpressionSlots
          ? expressionDetails.map((expression) => (
              <TouchableOpacity
                key={`${expression.slotIndex}-${expression.kind}-${expression.id}`}
                activeOpacity={0.9}
                onPress={() => onOpenExpressionPicker(expression)}
                style={[
                  styles.sprayCard,
                  SHADOWS.xs,
                  { borderColor: COLORS.BORDER, borderWidth: 1 },
                ]}
              >
                <Image
                  cacheId={`${expression.kind}:${expression.id}:display`}
                  source={
                    expression.icon
                      ? { uri: expression.icon }
                      : FALLBACK_IMAGE
                  }
                  style={styles.sprayImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="normal"
                  recyclingKey={expression.icon}
                />
                <Text
                  style={[styles.sprayName, { color: COLORS.TEXT_PRIMARY }]}
                >
                  {expression.kind === "flex"
                    ? t("equip_page.expressions.flex", {
                        defaultValue: "Flex",
                      })
                    : t("equip_page.expressions.graffiti", {
                        defaultValue: "Graffiti",
                      })}
                </Text>
                <Text
                  style={[styles.spraySlot, { color: COLORS.TEXT_SECONDARY }]}
                >
                  {t("equip_page.expressions.slot", {
                    slot: expression.slotIndex + 1,
                    defaultValue: `Vị trí ${expression.slotIndex + 1}`,
                  })}
                </Text>
              </TouchableOpacity>
            ))
          : sprayDetails.map((spray) => (
              <TouchableOpacity
                key={`${spray.slot}-${spray.id}`}
                activeOpacity={0.9}
                onPress={() => onOpenSprayPicker(spray)}
                style={[
                  styles.sprayCard,
                  SHADOWS.xs,
                  { borderColor: COLORS.BORDER, borderWidth: 1 },
                ]}
              >
                <Image
                  cacheId={`spray:${spray.id}:display`}
                  source={spray.icon ? { uri: spray.icon } : FALLBACK_IMAGE}
                  style={styles.sprayImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="normal"
                  recyclingKey={spray.icon}
                />
                <Text
                  style={[styles.sprayName, { color: COLORS.TEXT_PRIMARY }]}
                >
                  {t("equip_page.expressions.graffiti", {
                    defaultValue: "Graffiti",
                  })}
                </Text>
                <Text
                  style={[styles.spraySlot, { color: COLORS.TEXT_SECONDARY }]}
                >
                  {formatSpraySlot(spray.slot, t)}
                </Text>
              </TouchableOpacity>
            ))}
      </View>
    </View>
  );
}
