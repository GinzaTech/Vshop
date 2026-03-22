import React, { useCallback, useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";

interface SkinShowcaseCardProps {
  item: SkinShopItem;
  subtitle: string;
  variant?: "store" | "bundle";
}

const WEAPON_NAMES = [
  "Classic",
  "Shorty",
  "Frenzy",
  "Ghost",
  "Sheriff",
  "Stinger",
  "Spectre",
  "Bucky",
  "Judge",
  "Bulldog",
  "Guardian",
  "Phantom",
  "Vandal",
  "Marshal",
  "Operator",
  "Ares",
  "Odin",
  "Melee",
];

const buildPreviewLabel = (value?: string | null) => {
  if (!value) return null;

  return value.replace(/\s*\([^)]*\)/g, "").trim().toUpperCase();
};

const SkinShowcaseCard = React.memo(function SkinShowcaseCard({
  item,
  subtitle,
  variant = "store",
}: SkinShowcaseCardProps) {
  const { t } = useTranslation();
  const { showMediaPopup } = useMediaPopupStore();
  const skinIds = useWishlistStore((state) => state.skinIds);
  const toggleSkin = useWishlistStore((state) => state.toggleSkin);
  const { screenshotModeEnabled } = useFeatureStore();

  const handleLevelsPress = useCallback(() => {
    showMediaPopup(
      item.levels.map(
        (level) => level.streamedVideo || level.displayIcon || ""
      ),
      t("levels")
    );
  }, [item.levels, showMediaPopup, t]);

  const handleChromasPress = useCallback(() => {
    showMediaPopup(
      item.chromas.map(
        (chroma) => chroma.streamedVideo || chroma.fullRender
      ),
      t("chromas")
    );
  }, [item.chromas, showMediaPopup, t]);

  const isFavorited = useMemo(
    () => skinIds.includes(item.levels[0].uuid),
    [item.levels, skinIds]
  );
  const tier = useMemo(
    () => getContentTierVisual(item.contentTierUuid),
    [item.contentTierUuid]
  );
  const weaponType = useMemo(() => {
    const lowerName = item.displayName.toLowerCase();
    return WEAPON_NAMES.find((weapon) =>
      lowerName.includes(weapon.toLowerCase())
    );
  }, [item.displayName]);
  const upgradeLabel = useMemo(() => {
    const levelCount = item.levels.length || 1;
    return levelCount > 1 ? `Lv ${levelCount}/${levelCount}` : "Lv 1";
  }, [item.levels.length]);
  const previewChips = useMemo(() => {
    const chips: {
      key: "levels" | "chromas";
      label: string;
      onPress: () => void;
    }[] = [];

    const levelLabel = buildPreviewLabel(
      item.levels[item.levels.length - 1]?.displayName ||
        item.levels[0]?.displayName ||
        item.displayName
    );
    if (levelLabel) {
      chips.push({
        key: "levels",
        label: levelLabel,
        onPress: handleLevelsPress,
      });
    }

    const chromaLabel = buildPreviewLabel(
      item.chromas.find(
        (chroma) => chroma.displayName && chroma.displayName !== item.displayName
      )?.displayName
    );
    if (chromaLabel) {
      chips.push({
        key: "chromas",
        label: chromaLabel,
        onPress: handleChromasPress,
      });
    }

    return chips;
  }, [handleChromasPress, handleLevelsPress, item.chromas, item.displayName, item.levels]);
  const isBundleVariant = variant === "bundle";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tier.cardBackground,
          borderColor: tier.border,
        },
      ]}
    >
      <View style={styles.mainRow}>
        <View style={styles.content}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {weaponType || "Weapon"}
          </Text>

          <Text style={styles.title} numberOfLines={1}>
            {item.displayName}
          </Text>

          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>

          <View style={isBundleVariant ? styles.bundleBadgeRow : styles.badgeRow}>
            <View
              style={[
                styles.metaBadge,
                {
                  backgroundColor: tier.badgeBackground,
                  borderColor: tier.border,
                },
              ]}
            >
              <View
                style={[styles.rarityDot, { backgroundColor: tier.accent }]}
              />
              <Text style={[styles.metaBadgeText, { color: tier.text }]}>
                {tier.label}
              </Text>
            </View>

            {isBundleVariant ? (
              <View style={styles.bundleStatsColumn}>
                <View
                  style={[
                    styles.metaBadge,
                    styles.bundleStatBadge,
                    {
                      backgroundColor: tier.badgeBackground,
                      borderColor: tier.border,
                    },
                  ]}
                >
                  <Icon
                    name="arrow-up-bold-circle-outline"
                    size={15}
                    color={tier.text}
                  />
                  <Text style={[styles.metaBadgeText, { color: tier.text }]}>
                    {upgradeLabel}
                  </Text>
                </View>

                <View
                  style={[
                    styles.metaBadge,
                    styles.bundleStatBadge,
                    {
                      backgroundColor: tier.badgeBackground,
                      borderColor: tier.border,
                    },
                  ]}
                >
                  <CurrencyIcon icon="vp" style={styles.currencyIcon} />
                  <Text style={[styles.metaBadgeText, { color: tier.text }]}>
                    {item.price}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View
                  style={[
                    styles.metaBadge,
                    {
                      backgroundColor: COLORS.SURFACE_MUTED,
                      borderColor: COLORS.BORDER,
                    },
                  ]}
                >
                  <Icon
                    name="arrow-up-bold-circle-outline"
                    size={15}
                    color={COLORS.TEXT_SECONDARY}
                  />
                  <Text style={styles.metaBadgeText}>{upgradeLabel}</Text>
                </View>

                <View
                  style={[
                    styles.metaBadge,
                    {
                      backgroundColor: COLORS.SURFACE_MUTED,
                      borderColor: COLORS.BORDER,
                    },
                  ]}
                >
                  <CurrencyIcon icon="vp" style={styles.currencyIcon} />
                  <Text style={styles.metaBadgeText}>{item.price}</Text>
                </View>
              </>
            )}
          </View>

          {!isBundleVariant ? (
            <View style={styles.chipsRow}>
              {previewChips.map((chip) => (
                <TouchableOpacity
                  key={chip.key}
                  activeOpacity={0.85}
                  onPress={chip.onPress}
                  style={styles.previewChip}
                >
                  <Text style={styles.previewChipText} numberOfLines={1}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {previewChips.length === 0 ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleLevelsPress}
                  style={styles.previewChip}
                >
                  <Text style={styles.previewChipText} numberOfLines={1}>
                    {t("levels").toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={isBundleVariant ? styles.bundleMediaColumn : styles.mediaColumn}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => toggleSkin(item.levels[0].uuid)}
            style={[
              styles.favoriteButton,
              {
                backgroundColor: isFavorited
                  ? tier.accent
                  : tier.badgeBackground,
                borderColor: isFavorited ? tier.accent : tier.border,
              },
            ]}
          >
            <Icon
              name={isFavorited ? "heart" : "heart-outline"}
              size={18}
              color={isFavorited ? COLORS.PURE_WHITE : tier.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleLevelsPress}
            style={[
              styles.imageFrame,
              isBundleVariant && styles.bundleImageFrame,
              {
                backgroundColor: tier.visualBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              style={styles.image}
              source={getDisplayIcon(item, screenshotModeEnabled)}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 16,
  },
  eyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 19,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  bundleBadgeRow: {
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  metaBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
  bundleStatsColumn: {
    marginTop: 10,
    gap: 10,
  },
  bundleStatBadge: {
    alignSelf: "flex-start",
  },
  rarityDot: {
    width: 9,
    height: 9,
    borderRadius: RADIUS.chip,
    marginRight: 6,
  },
  currencyIcon: {
    width: 14,
    height: 14,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  previewChip: {
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderColor: COLORS.BORDER,
  },
  previewChipText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "700",
  },
  mediaColumn: {
    width: 140,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bundleMediaColumn: {
    width: 140,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  favoriteButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  bundleImageFrame: {
    marginTop: 8,
  },
  imageFrame: {
    width: 128,
    height: 128,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

export default SkinShowcaseCard;
