import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import SkinShowcaseCard from "./SkinShowcaseCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface BundleItemProps {
  item: SkinShopItem | AccessoryShopItem;
}

function isSkinItem(item: SkinShopItem | AccessoryShopItem): item is SkinShopItem {
  return "levels" in item;
}

const typeLabels: Record<string, string> = {
  Spray: "shop_cards.spray",
  PlayerCard: "shop_cards.player_card",
  PlayerTitle: "shop_cards.player_title",
  Buddy: "shop_cards.buddy",
};

const BundleItem = React.memo(function BundleItem({ item }: BundleItemProps) {
  const { t } = useTranslation();

  if (isSkinItem(item)) {
    return <SkinShowcaseCard item={item} variant="bundle" />;
  }

  return (
    <View style={styles.card}>
      <View style={styles.visualFrame}>
        <Image
          style={styles.image}
          source={{ uri: item.displayIcon }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={item.uuid}
        />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.displayName}
      </Text>
      <View style={styles.metaRow}>
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>{item.price}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 180,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 14,
    overflow: "hidden",
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
  },
  visualFrame: {
    width: "100%",
    height: 80,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
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
    marginTop: 8,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
    minHeight: 36,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    backgroundColor: COLORS.VALORANT_DARK_BLUE,
    borderColor: "rgba(255,255,255,0.08)",
  },
  priceText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "700",
  },
});

export default BundleItem;
