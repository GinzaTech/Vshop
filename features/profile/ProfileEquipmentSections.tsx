// ===== ProfileEquipmentSections.tsx – Các section trang bị của màn Profile =====
// Gồm: IdentitySection (player card + title + cấp tài khoản) và
// ExpressionSection (graffiti/flex đã trang bị, fallback spray legacy).
// Component thuần hiển thị — toàn bộ state/mutation nằm ở ProfileScreen.

import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { TFunction } from "i18next";

import { CachedImage as Image } from "~/components/CachedImage";
import { LiquidGlassDecoration } from "~/components/ui/LiquidGlassSurface";
import {
  FALLBACK_IMAGE,
  formatSpraySlot,
  type EquippedSpray,
  type IdentityDetails,
} from "~/components/GalleryProfile";
import { COLORS, RADIUS, SHADOWS } from "~/constants/DesignSystem";
import type { EquippedExpression } from "~/features/profile/profile-loadout";
import { styles } from "~/features/profile/profile-screen.styles";
import { expressionStyles } from "~/features/profile/profile-expression.styles";

/**
 * ProfileEquipmentSectionsProps – Props chung của các section trang bị.
 * Props của từng component được chọn riêng qua Pick<> để interface rõ ràng.
 */
export type ProfileEquipmentSectionsProps = {
  expressionDetails: EquippedExpression[];
  identityDetails: IdentityDetails | null;
  onOpenExpressionPicker: (expression: EquippedExpression) => void;
  onOpenIdentityPicker: (type: "player-card" | "player-title") => void;
  onOpenSprayPicker: (spray: EquippedSpray) => void;
  sprayDetails: EquippedSpray[];
  t: TFunction;
};

export { ProfileIdentitySection } from "./ProfileIdentitySection";

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

  const kindLabel = (kind: EquippedExpression["kind"]) =>
    kind === "flex"
      ? t("equip_page.expressions.flex", { defaultValue: "Flex" })
      : t("equip_page.expressions.graffiti", { defaultValue: "Graffiti" });
  const overflow =
    (hasExpressionSlots ? expressionDetails.length : sprayDetails.length) > 4;
  const cells = hasExpressionSlots
    ? expressionDetails.map((expression) => (
        <ProfileExpressionCell
          key={`${expression.slotIndex}-${expression.kind}-${expression.id}`}
          cacheId={`${expression.kind}:${expression.id}:display`}
          icon={expression.icon}
          name={expression.name}
          kind={kindLabel(expression.kind)}
          slot={t("equip_page.expressions.slot", {
            slot: expression.slotIndex + 1,
            defaultValue: `Vị trí ${expression.slotIndex + 1}`,
          })}
          overflow={overflow}
          onPress={() => onOpenExpressionPicker(expression)}
        />
      ))
    : sprayDetails.map((spray) => (
        <ProfileExpressionCell
          key={`${spray.slot}-${spray.id}`}
          cacheId={`spray:${spray.id}:display`}
          icon={spray.icon}
          name={spray.name}
          kind={kindLabel("spray")}
          slot={formatSpraySlot(spray.slot, t)}
          overflow={overflow}
          onPress={() => onOpenSprayPicker(spray)}
        />
      ));

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
      {overflow ? (
        <ScrollView
          testID="profile-expression-row"
          horizontal
          contentContainerStyle={[
            expressionStyles.row,
            expressionStyles.overflowRow,
          ]}
        >
          {cells}
        </ScrollView>
      ) : (
        <View testID="profile-expression-row" style={expressionStyles.row}>
          {cells}
        </View>
      )}
    </View>
  );
}
function ProfileExpressionCell({
  cacheId,
  icon,
  name,
  kind,
  slot,
  overflow,
  onPress,
}: {
  cacheId: string;
  icon?: string;
  name: string;
  kind: string;
  slot: string;
  overflow: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${kind}, ${slot}`}
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        expressionStyles.card,
        SHADOWS.xs,
        overflow && expressionStyles.overflowCard,
      ]}
    >
      <LiquidGlassDecoration radius={RADIUS.md} density="dense" tone="light" />
      <Image
        accessible={false}
        cacheId={cacheId}
        source={icon ? { uri: icon } : FALLBACK_IMAGE}
        style={expressionStyles.image}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="normal"
        recyclingKey={icon}
      />
      <Text style={expressionStyles.kind}>{kind}</Text>
      <Text style={expressionStyles.slot}>{slot}</Text>
    </TouchableOpacity>
  );
}
