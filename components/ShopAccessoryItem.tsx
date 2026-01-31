import React from "react";
import { StyleSheet, View, Text, Image, Platform } from "react-native";
import { useTheme } from "react-native-paper";
import CurrencyIcon from "./CurrencyIcon";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS } from "~/constants/DesignSystem";

interface props {
  item: AccessoryShopItem;
}

export default function ShopAccessoryItem({ item }: React.PropsWithChildren<props>) {
  const { screenshotModeEnabled } = useFeatureStore();
  const { colors } = useTheme();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {item.displayName}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{item.price}</Text>
          <CurrencyIcon icon="kc" style={styles.currencyIcon} />
        </View>
      </View>

      <Image
        resizeMode="contain"
        style={styles.image}
        source={getDisplayIcon(item, screenshotModeEnabled)}
      />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginBottom: 15,
    padding: 10,
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
    fontFamily: Platform.OS === 'ios' ? 'DIN Alternate' : 'sans-serif-condensed',
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
    height: 150, // Large image matching ShopItem
    marginBottom: 10,
  },
});
