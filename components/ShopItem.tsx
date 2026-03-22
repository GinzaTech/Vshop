import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";

interface ShopItemProps {
  item: SkinShopItem;
}

const ShopItem = React.memo(({ item }: React.PropsWithChildren<ShopItemProps>) => {
  const { t } = useTranslation();
  const { showMediaPopup } = useMediaPopupStore();
  const skinIds = useWishlistStore((state) => state.skinIds);
  const toggleSkin = useWishlistStore((state) => state.toggleSkin);
  const { screenshotModeEnabled } = useFeatureStore();
  const [rating, setRating] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(`RATING_${item.uuid}`).then((value) => {
      if (value) {
        setRating(Number.parseInt(value, 10));
      }
    });
  }, [item.uuid]);

  const handleRate = async (nextRating: number) => {
    setRating(nextRating);
    await AsyncStorage.setItem(`RATING_${item.uuid}`, nextRating.toString());
  };

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

  return (
    <GlassCard
      style={[
        styles.card,
        {
          backgroundColor: tier.cardBackground,
          borderColor: tier.border,
        },
      ]}
    >
      <View style={styles.topRow}>
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
      </View>

      <View style={styles.mainRow}>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {item.displayName}
          </Text>
          <Text style={styles.subtitle}>Daily store pick</Text>

          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleRate(star)}>
                <Icon
                  name={star <= rating ? "star" : "star-outline"}
                  size={18}
                  color={star <= rating ? tier.accent : COLORS.TEXT_SECONDARY}
                />
              </TouchableOpacity>
            ))}
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
          </View>
        </View>

        <View
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
        </View>
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
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
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 4,
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
  },
  imageFrame: {
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE_MUTED,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    width: 126,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 12,
    marginBottom: 12,
    gap: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
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
