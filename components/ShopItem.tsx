import { useTranslation } from "react-i18next";
import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { StyleSheet, View, Text, Image, Platform, TouchableOpacity } from "react-native";
import GlassCard from "~/components/ui/GlassCard";
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS } from "~/constants/DesignSystem";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

interface ShopItemProps {
  item: SkinShopItem;
}

const ShopItem = React.memo(({ item }: React.PropsWithChildren<ShopItemProps>) => {
  const { t } = useTranslation();
  const { showMediaPopup } = useMediaPopupStore();
  const { skinIds } = useWishlistStore();
  const { screenshotModeEnabled } = useFeatureStore();
  const [rating, setRating] = useState(0);

  useEffect(() => {
    // Load rating
    AsyncStorage.getItem(`RATING_${item.uuid}`).then((val) => {
      if (val) setRating(parseInt(val, 10));
    });
  }, [item.uuid]);

  const handleRate = async (newRating: number) => {
    setRating(newRating);
    await AsyncStorage.setItem(`RATING_${item.uuid}`, newRating.toString());
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

  const isFavorited = useMemo(() => skinIds.includes(item.levels[0].uuid), [skinIds, item.levels]);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {isFavorited ? `⭐ ${item.displayName}` : item.displayName}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{item.price}</Text>
          <CurrencyIcon icon="vp" style={styles.currencyIcon} />
        </View>
      </View>

      <Image
        resizeMode="contain"
        style={styles.image}
        source={getDisplayIcon(item, screenshotModeEnabled)}
      />

      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => handleRate(star)}>
            <Icon
              name={star <= rating ? "star" : "star-outline"}
              size={20}
              color={star <= rating ? COLORS.VALORANT_RED : COLORS.GLASS_WHITE_DIM}
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
    margin: 10,
    marginBottom: 15,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    color: COLORS.PURE_WHITE,
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    marginRight: 10,
    textTransform: "uppercase",
    fontFamily: Platform.OS === 'ios' ? 'DIN Alternate' : 'sans-serif-condensed', // Attempting to match Valorant font style
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  price: {
    color: COLORS.GLASS_WHITE_DIM,
    fontSize: 16,
    fontWeight: "600",
    marginRight: 4,
  },
  currencyIcon: {
    width: 16,
    height: 16,
  },
  image: {
    width: "100%",
    height: 150,
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
    gap: 4
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
