import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { CachedImage as Image } from "~/components/CachedImage";
import { FALLBACK_IMAGE, type EquippedWeapon } from "~/components/GalleryProfile";
import { styles } from "~/features/profile/profile-screen.styles";
import { formatUpgradeLevel } from "~/features/profile/profile-loadout";
import { getContentTierVisual } from "~/utils/content-tier";

export interface CompactProfileSkinCardProps {
  weapon: EquippedWeapon;   // Vũ khí cần hiển thị
  width: number;            // Chiều rộng của card
  disabled?: boolean;       // Disable tương tác?
  onPress?: () => void;     // Callback khi nhấn
}

/**
 * CompactProfileSkinCard — Card hiển thị skin vũ khí dạng nhỏ gọn.
 *
 * Memoized với React.memo để tránh re-render không cần thiết.
 *
 * Hiển thị:
 * - Badge tier (màu sắc theo content tier).
 * - Badge upgrade level (nếu có).
 * - Ảnh skin.
 * - Tên vũ khí + tên skin.
 *
 * Nếu có onPress, bọc trong TouchableOpacity. Nếu không, dùng View có accessibility.
 *
 * @returns {JSX.Element} Card skin nhỏ gọn.
 */
export const CompactProfileSkinCard = React.memo(function CompactProfileSkinCard({
                                                                            weapon,
                                                                            width,
                                                                            disabled = false,
                                                                            onPress,
                                                                          }: CompactProfileSkinCardProps) {
  const tier = getContentTierVisual(
      weapon.contentTierUuid,
      weapon.contentTierName
  );
  const upgradeLabel = formatUpgradeLevel(weapon);
  const cardStyle = [
    styles.profileSkinCard,
    {
      width,
      borderColor: tier.border,
      opacity: disabled ? 0.72 : 1,
    },
  ];
  const content = (
      <>
        <View
            style={[
              styles.profileSkinVisual,
              {
                backgroundColor: tier.cardBackground,
                borderBottomColor: tier.border,
              },
            ]}
        >
          {/* Badge tier (VD: DELUXE, EXCLUSIVE, ...) */}
          <View
              style={[
                styles.profileSkinTierBadge,
                { backgroundColor: tier.badgeBackground },
              ]}
          >
            <Text
                style={[styles.profileSkinTierText, { color: tier.text }]}
                numberOfLines={1}
            >
              {(weapon.contentTierName || tier.label).toUpperCase()}
            </Text>
          </View>
          {/* Badge upgrade level (VD: 2/4) */}
          {upgradeLabel ? (
              <View style={styles.profileSkinLevelBadge}>
                <Text style={styles.profileSkinLevelText}>{upgradeLabel}</Text>
              </View>
          ) : null}
          <Image
              cacheId={`skin-image:${
                  weapon.chromaId || weapon.skinLevelId || weapon.skinId
              }:display`}
              source={weapon.image ? { uri: weapon.image } : FALLBACK_IMAGE}
              style={styles.profileSkinImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="low"
              recyclingKey={weapon.skinId || weapon.weaponId}
          />
        </View>

        {/* Tên vũ khí + skin */}
        <View style={styles.profileSkinContent}>
          <Text style={styles.profileSkinWeaponName} numberOfLines={1}>
            {weapon.weaponName}
          </Text>
          <Text style={styles.profileSkinName} numberOfLines={2}>
            {weapon.skinName}
          </Text>
        </View>
      </>
  );

  if (onPress) {
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${weapon.weaponName}, ${weapon.skinName}`}
            activeOpacity={0.86}
            disabled={disabled}
            onPress={onPress}
            style={cardStyle}
        >
          {content}
        </TouchableOpacity>
    );
  }

  return (
      <View
          accessible
          accessibilityLabel={`${weapon.weaponName}, ${weapon.skinName}`}
          style={cardStyle}
      >
        {content}
      </View>
  );
});

/**
 * normalizeWeaponKey — Chuẩn hóa tên vũ khí để so sánh.
 * Loại bỏ dấu, chuyển lowercase, thay ký tự đặc biệt bằng khoảng trắng.
 *
 * @param {string | undefined} value - Tên gốc.
 * @returns {string} Tên đã chuẩn hóa.
 */
