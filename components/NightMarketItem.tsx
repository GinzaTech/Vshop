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
          <Text style={styles.title} numberOfLines={1}>
            {props.item.displayName}
          </Text>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.metaBadge,
                {
                  backgroundColor: COLORS.PURE_BLACK,
                  borderColor: COLORS.PURE_BLACK,
                },
              ]}
            >
              <Text style={styles.discountLabel}>-{props.item.discountPercent}%</Text>
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
              <View
                style={[styles.rarityDot, { backgroundColor: tier.accent }]}
              />
              <Text style={[styles.metaBadgeText, { color: tier.text }]}>
                {tier.label}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.priceBadge,
              {
                backgroundColor: tier.badgeBackground,
                borderColor: tier.border,
              },
            ]}
          >
            <Text style={styles.originalPrice}>{props.item.price}</Text>
            <CurrencyIcon icon="vp" style={styles.currencyIcon} />
            <Text style={[styles.salePrice, { color: tier.text }]}>
              {props.item.discountedPrice}
            </Text>
          </View>

          {props.item.chromas.length > 1 ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                showMediaPopup(
                  props.item.chromas.map(
                    (chroma) => chroma.streamedVideo || chroma.fullRender
                  ),
                  t("chromas")
                )
              }
              style={styles.previewChip}
            >
              <Text style={styles.previewChipText}>{t("chromas")}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.mediaColumn}>
          <View
            style={[
              styles.discountCorner,
              {
                backgroundColor: COLORS.PURE_BLACK,
                borderColor: COLORS.PURE_BLACK,
              },
            ]}
          >
            <Text style={styles.discountCornerText}>
              {t("night_market_page.deal")}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              showMediaPopup(
                props.item.levels.map(
                  (level) => level.streamedVideo || level.displayIcon || ""
                ),
                t("levels")
              )
            }
            style={[
              styles.imageFrame,
              {
                backgroundColor: tier.visualBackground,
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
    paddingRight: 10,
  },
  mediaColumn: {
    width: 114,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
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
  rarityDot: {
    width: 9,
    height: 9,
    borderRadius: RADIUS.chip,
    marginRight: 6,
  },
  metaBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
  discountLabel: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "700",
  },
  originalPrice: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    textDecorationLine: "line-through",
  },
  salePrice: {
    fontSize: 16,
    fontWeight: "700",
  },
  currencyIcon: {
    width: 14,
    height: 14,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  previewChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    backgroundColor: COLORS.SURFACE_MUTED,
    borderColor: COLORS.BORDER,
  },
  previewChipText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "700",
  },
  discountCorner: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    marginBottom: 6,
  },
  discountCornerText: {
    color: COLORS.PURE_WHITE,
    fontSize: 11,
    fontWeight: "700",
  },
  imageFrame: {
    width: 104,
    height: 104,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
