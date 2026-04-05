import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface Props {
  item: AccessoryShopItem;
}

export default function ShopAccessoryItem({ item }: Props) {
  const { t } = useTranslation();
  const { screenshotModeEnabled } = useFeatureStore();

  const imageSource = React.useMemo(() => {
    const uri = getDisplayIconUri(item);

    if (uri && !screenshotModeEnabled) {
      return { uri, cacheKey: uri };
    }

    return require("~/assets/images/noimage.png");
  }, [item, screenshotModeEnabled]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {t("accessories_page.card_subtitle")}
        </Text>
      </View>

      <View style={styles.visualFrame}>
        <Image
          style={styles.image}
          source={imageSource}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={120}
          recyclingKey={item.uuid}
        />
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.displayName}
      </Text>

      <View style={styles.metaRow}>
        <View style={[styles.metaBadge, styles.priceBadge]}>
          <CurrencyIcon icon="kc" style={styles.currencyIcon} />
          <Text style={styles.metaBadgeText}>{item.price}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 228,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  eyebrow: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
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
    backgroundColor: COLORS.WARNING_SURFACE,
    borderColor: COLORS.WARNING_BORDER,
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
    minWidth: 82,
    backgroundColor: COLORS.VALORANT_DARK_BLUE,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metaBadgeText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  currencyIcon: {
    width: 13,
    height: 13,
    tintColor: COLORS.PURE_WHITE,
  },
});
