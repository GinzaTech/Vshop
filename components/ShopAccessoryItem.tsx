import React from "react";
import { StyleSheet, View, Text, Image } from "react-native";

import CurrencyIcon from "./CurrencyIcon";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface props {
  item: AccessoryShopItem;
}

export default function ShopAccessoryItem({
  item,
}: React.PropsWithChildren<props>) {
  const { screenshotModeEnabled } = useFeatureStore();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.priceBadge}>
          <CurrencyIcon icon="kc" style={styles.currencyIcon} />
          <Text style={styles.price}>{item.price}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {item.displayName}
      </Text>
      <Text style={styles.subtitle}>Accessory rotation</Text>

      <View style={styles.imageFrame}>
        <Image
          resizeMode="contain"
          style={styles.image}
          source={getDisplayIcon(item, screenshotModeEnabled)}
        />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    marginTop: 6,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
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
  imageFrame: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE_MUTED,
    padding: 16,
  },
  image: {
    width: "100%",
    height: 150,
  },
});
