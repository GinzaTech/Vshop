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
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

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

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.priceBadge}>
            <CurrencyIcon icon="vp" style={styles.currencyIcon} />
            <Text style={styles.price}>{item.price}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.displayName}
          </Text>
          <Text style={styles.subtitle}>Daily store pick</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleSkin(item.levels[0].uuid)}
          style={[
            styles.favoriteButton,
            isFavorited && styles.favoriteButtonActive,
          ]}
        >
          <Icon
            name={isFavorited ? "heart" : "heart-outline"}
            size={18}
            color={isFavorited ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.imageFrame}>
        <Image
          resizeMode="contain"
          style={styles.image}
          source={getDisplayIcon(item, screenshotModeEnabled)}
        />
      </View>

      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => handleRate(star)}>
            <Icon
              name={star <= rating ? "star" : "star-outline"}
              size={20}
              color={star <= rating ? COLORS.ACCENT : COLORS.TEXT_SECONDARY}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        <ValorantButton
          title={t("levels")}
          onPress={handleLevelsPress}
          variant="secondary"
          style={styles.button}
        />
        <ValorantButton
          title={t("chromas")}
          onPress={handleChromasPress}
          variant="secondary"
          style={styles.button}
        />
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.SURFACE_MUTED,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
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
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButtonActive: {
    backgroundColor: COLORS.PURE_BLACK,
  },
  imageFrame: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE_MUTED,
    padding: 14,
  },
  image: {
    width: "100%",
    height: 168,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 16,
    marginBottom: 16,
    gap: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  button: {
    flex: 1,
  },
});

export default ShopItem;
