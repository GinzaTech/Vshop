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

interface ShopItemProps {
  item: SkinShopItem;
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

const ShopItem = React.memo(({ item }: React.PropsWithChildren<ShopItemProps>) => {
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
  const weaponName = useMemo(() => {
    const lowerName = item.displayName.toLowerCase();
    return (
      WEAPON_NAMES.find((weapon) =>
        lowerName.includes(weapon.toLowerCase())
      ) || t("store")
    );
  }, [item.displayName, t]);

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

          <Text style={styles.title} numberOfLines={2}>
            {item.displayName}
          </Text>
          <Text style={styles.subtitle}>{weaponName}</Text>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.priceBadge,
                {
                  backgroundColor: tier.badgeBackground,
                  borderColor: tier.border,
                },
              ]}
            >
              <CurrencyIcon icon="vp" style={styles.currencyIcon} />
              <Text style={styles.price}>{item.price}</Text>
            </View>
            <View
              style={[
                styles.rarityBadge,
                {
                  backgroundColor: tier.badgeBackground,
                  borderColor: tier.border,
                },
              ]}
            >
              <View
                style={[styles.rarityDot, { backgroundColor: tier.accent }]}
              />
              <Text style={[styles.rarityText, { color: tier.text }]}>
                {tier.label}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLevelsPress}
              style={[
                styles.actionChip,
                {
                  backgroundColor: tier.badgeBackground,
                  borderColor: tier.border,
                },
              ]}
            >
              <Icon
                name="arrow-up-bold-circle-outline"
                size={16}
                color={tier.text}
              />
              <Text style={[styles.actionChipText, { color: tier.text }]}>
                {t("levels")}
              </Text>
            </TouchableOpacity>
            {item.chromas.length > 1 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleChromasPress}
                style={[
                  styles.actionChip,
                  {
                    backgroundColor: tier.badgeBackground,
                    borderColor: tier.border,
                  },
                ]}
              >
                <Icon
                  name="palette-outline"
                  size={16}
                  color={tier.text}
                />
                <Text style={[styles.actionChipText, { color: tier.text }]}>
                  {t("chromas")}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleLevelsPress}
          style={[
            styles.imageFrame,
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
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 16,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  content: {
    flex: 1,
    paddingRight: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  price: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
  currencyIcon: {
    width: 14,
    height: 14,
  },
  rarityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.chip,
    marginRight: 6,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  imageFrame: {
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE_MUTED,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    width: 134,
    height: 118,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  actionChipText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
  },
});

export default ShopItem;
