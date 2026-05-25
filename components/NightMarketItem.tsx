import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { getDisplayIconUri } from "~/utils/misc";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";

interface props {
  item: NightMarketItem;
}

export default function NightMarketItem(props: React.PropsWithChildren<props>) {
  const { t } = useTranslation();
  const { showMediaPopup } = useMediaPopupStore();
  const { screenshotModeEnabled } = useFeatureStore();
  const tier = getContentTierVisual(props.item.contentTierUuid);

  const imageSource = React.useMemo(() => {
    const uri = getDisplayIconUri(props.item);

    if (uri && !screenshotModeEnabled) {
      return { uri, cacheKey: uri };
    }

    return require("~/assets/images/noimage.png");
  }, [props.item, screenshotModeEnabled]);

  const weaponType = React.useMemo(() => {
    const lowerName = props.item.displayName.toLowerCase();
    const WEAPON_TYPES = [
      "Knife", "Melee", "Classic", "Shorty", "Frenzy", "Ghost", "Sheriff", 
      "Stinger", "Spectre", "Bucky", "Judge", "Bulldog", "Guardian", 
      "Phantom", "Vandal", "Marshal", "Outlaw", "Operator", "Ares", "Odin"
    ];
    const match = WEAPON_TYPES.find((w) => lowerName.includes(w.toLowerCase()));
    if (match) {
      if (match === "Knife" || match === "Melee") return t("equip_page.categories.Melee Weapons");
      if (["Classic", "Shorty", "Frenzy", "Ghost", "Sheriff"].includes(match)) return t("equip_page.categories.Sidearm");
      if (["Stinger", "Spectre"].includes(match)) return t("equip_page.categories.SMG");
      if (["Bucky", "Judge"].includes(match)) return t("equip_page.categories.Shotgun");
      if (["Bulldog", "Guardian", "Phantom", "Vandal"].includes(match)) return t("equip_page.categories.Rifle");
      if (["Marshal", "Outlaw", "Operator"].includes(match)) return t("equip_page.categories.Sniper");
      if (["Ares", "Odin"].includes(match)) return t("equip_page.categories.Heavy");
    }
    return t("equip_page.categories.Other");
  }, [props.item.displayName, t]);

  const specialBadge = React.useMemo(() => {
    if (tier.label === "Premium" || tier.label === "Ultra" || tier.label === "Exclusive") {
      return t("night_market_page.limited_badge");
    }
    return t("night_market_page.special_offer_badge");
  }, [tier.label, t]);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: tier.border,
        },
      ]}
    >
      <View style={styles.mainRow}>
        <View style={styles.content}>
          
          {/* Header Row: Rarity + Weapon Type + Special Badge */}
          <View style={styles.headerInfo}>
            <View style={styles.rarityLabelWrapper}>
              <Text style={[styles.rarityText, { color: tier.text }]}>
                {tier.label.toUpperCase()}
              </Text>
              <Text style={styles.weaponTypeText}>
                {"  •  "}{weaponType}
              </Text>
            </View>
            <View style={styles.specialBadge}>
              <Text style={styles.specialBadgeText}>{specialBadge}</Text>
            </View>
          </View>

          {/* Weapon Name */}
          <Text style={styles.title} numberOfLines={1}>
            {props.item.displayName}
          </Text>

          {/* Pricing & Discount Row */}
          <View style={styles.priceRow}>
            {/* Discount Badge */}
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{props.item.discountPercent}% {t("night_market_page.off_label")}</Text>
            </View>

            {/* Original Price */}
            <Text style={styles.originalPrice}>
              {props.item.price}
            </Text>

            {/* Discounted Price */}
            <View style={styles.salePriceWrapper}>
              <View style={styles.vpIconWrapper}>
                <Text style={styles.vpIconText}>Ⓢ</Text>
              </View>
              <Text style={styles.salePrice}>
                {props.item.discountedPrice}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Weapon Image Frame */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            showMediaPopup(
              props.item.levels.map(
                (level) => level.streamedVideo || level.displayIcon || ""
              ),
              props.item.displayName
            )
          }
          style={[
            styles.imageFrame,
            {
              backgroundColor: tier.cardBackground,
              borderColor: tier.border,
            },
          ]}
        >
          <Image
            style={styles.image}
            source={imageSource}
            contentFit="contain"
            cachePolicy="memory-disk"
            priority="high"
            transition={120}
            recyclingKey={props.item.uuid}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.SURFACE,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: COLORS.PURE_BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingRight: 16,
    justifyContent: "center",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  rarityLabelWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  rarityText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  weaponTypeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  specialBadge: {
    backgroundColor: COLORS.PURE_BLACK,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  specialBadgeText: {
    color: COLORS.PURE_WHITE,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  discountBadge: {
    backgroundColor: COLORS.PURE_BLACK,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discountText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "800",
  },
  originalPrice: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  salePriceWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  vpIconWrapper: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.PURE_BLACK,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  vpIconText: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.PURE_WHITE,
  },
  salePrice: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  imageFrame: {
    width: 96,
    height: 96,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
