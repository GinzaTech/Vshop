import React, { useCallback, useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";

interface SkinShowcaseCardProps {
  item: SkinShopItem;
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

const SkinShowcaseCard = React.memo(function SkinShowcaseCard({
  item,
  variant = "store",
}: SkinShowcaseCardProps) {
  const { showMediaPopup } = useMediaPopupStore();
  const skinIds = useWishlistStore((state) => state.skinIds);
  const toggleSkin = useWishlistStore((state) => state.toggleSkin);
  const { screenshotModeEnabled } = useFeatureStore();

  const handlePreviewPress = useCallback(() => {
    const media = [
      ...item.levels.map((level) => level.streamedVideo || level.displayIcon || ""),
      ...item.chromas.map((chroma) => chroma.streamedVideo || chroma.fullRender || ""),
    ].filter(Boolean);

    if (media.length > 0) {
      showMediaPopup(media, item.displayName);
    }
  }, [item.chromas, item.displayName, item.levels, showMediaPopup]);

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
    return (
      WEAPON_NAMES.find((weapon) => lowerName.includes(weapon.toLowerCase())) ||
      (variant === "bundle" ? "Bundle skin" : "Store skin")
    );
  }, [item.displayName, variant]);
  const upgradeLabel = useMemo(() => {
    const levelCount = item.levels.length || 1;
    return levelCount > 1 ? `Lv ${levelCount}/${levelCount}` : "Lv 1";
  }, [item.levels.length]);

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
      <View style={styles.cardHeader}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {weaponType}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleSkin(item.levels[0].uuid)}
          style={[
            styles.favoriteButton,
            {
              backgroundColor: isFavorited ? tier.accent : tier.badgeBackground,
              borderColor: isFavorited ? tier.accent : tier.border,
            },
          ]}
        >
          <Icon
            name={isFavorited ? "heart" : "heart-outline"}
            size={16}
            color={isFavorited ? COLORS.PURE_WHITE : tier.text}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePreviewPress}
        style={[
          styles.visualFrame,
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

      <Text style={styles.title} numberOfLines={2}>
        {item.displayName}
      </Text>

      <View style={styles.metaRow}>
        <View
          style={[
            styles.metaBadge,
            {
              backgroundColor: tier.badgeBackground,
              borderColor: tier.border,
            },
          ]}
        >
          <View style={[styles.rarityDot, { backgroundColor: tier.accent }]} />
          <Text style={[styles.metaBadgeText, { color: tier.text }]} numberOfLines={1}>
            {tier.label}
          </Text>
        </View>

        <View
          style={[
            styles.metaBadge,
            {
              backgroundColor: tier.badgeBackground,
              borderColor: tier.border,
            },
          ]}
        >
          <Icon
            name="arrow-up-bold-circle-outline"
            size={13}
            color={tier.text}
          />
          <Text style={[styles.metaBadgeText, { color: tier.text }]}>
            {upgradeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View
          style={[
            styles.metaBadge,
            styles.priceBadge,
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
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 238,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrow: {
    flex: 1,
    marginRight: 10,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  visualFrame: {
    width: "100%",
    height: 112,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  title: {
    marginTop: 12,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    minHeight: 40,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  priceRow: {
    marginTop: 8,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  priceBadge: {
    minWidth: 78,
  },
  metaBadgeText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  currencyIcon: {
    width: 13,
    height: 13,
  },
});

export default SkinShowcaseCard;
