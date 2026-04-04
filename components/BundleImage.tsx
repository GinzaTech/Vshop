import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "./CurrencyIcon";
import Countdown from "./Countdown";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface BundleImageProps {
  bundle: BundleShopItem;
  remainingSecs: number;
  expanded: boolean;
  onPress: () => void;
}

export default function BundleImage({
  bundle,
  remainingSecs,
  expanded,
  onPress,
}: BundleImageProps) {
  const { t } = useTranslation();
  const timestamp = new Date().getTime() + remainingSecs * 1000;
  const { screenshotModeEnabled } = useFeatureStore();
  const heroSource = React.useMemo(() => {
    const uri = bundle.displayIcon || bundle.displayIcon2 || bundle.verticalPromoImage;

    if (uri && !screenshotModeEnabled) {
      return { uri, cacheKey: uri };
    }

    return require("~/assets/images/noimage.png");
  }, [bundle.displayIcon, bundle.displayIcon2, bundle.verticalPromoImage, screenshotModeEnabled]);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.touchable}
    >
      <View style={styles.hero}>
        <Image
          source={heroSource}
          style={styles.heroImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={140}
          recyclingKey={bundle.uuid}
        />
        <View
          style={[
            styles.overlay,
            {
              backgroundColor: screenshotModeEnabled
                ? COLORS.PURE_BLACK
                : COLORS.OVERLAY,
              borderColor: "rgba(255,255,255,0.14)",
            },
          ]}
        >
          <View style={styles.topRow}>
            <View
              style={[
                styles.topBadge,
                {
                  backgroundColor: "rgba(255,255,255,0.14)",
                  borderColor: "rgba(255,255,255,0.16)",
                },
              ]}
            >
              <Icon
                name="package-variant-closed"
                size={14}
                color={COLORS.PURE_WHITE}
              />
              <Text style={styles.topBadgeText}>
                {t("bundles_page.hero_badge")}
              </Text>
            </View>

            <View style={styles.timerPill}>
              <Countdown timestamp={timestamp} color={COLORS.PURE_WHITE} />
            </View>
          </View>

          <View>
            <Text style={styles.eyebrow}>{t("bundles_page.hero_eyebrow")}</Text>
            <Text style={styles.title}>{bundle.displayName}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Icon
                  name="layers-triple-outline"
                  size={15}
                  color={COLORS.PURE_WHITE}
                />
                <Text style={styles.metaText}>
                  {t("bundles_page.items_count", { count: bundle.items.length })}
                </Text>
              </View>
              <View style={styles.metaPill}>
                <CurrencyIcon icon="vp" style={styles.currency} />
                <Text style={styles.metaText}>{bundle.price}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionPill}>
            <Text style={styles.actionText}>
              {expanded
                ? t("bundles_page.toggle_hide")
                : t("bundles_page.toggle_show")}
            </Text>
            <Icon
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={COLORS.PURE_WHITE}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 20,
  },
  hero: {
    position: "relative",
    minHeight: 280,
    borderRadius: 30,
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
    borderWidth: 1,
    borderRadius: 30,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  topBadgeText: {
    marginLeft: 6,
    color: COLORS.PURE_WHITE,
    fontWeight: "700",
    fontSize: 13,
  },
  timerPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  eyebrow: {
    color: COLORS.PURE_WHITE,
    fontSize: 14,
    opacity: 0.92,
  },
  title: {
    marginTop: 8,
    color: COLORS.PURE_WHITE,
    fontWeight: "700",
    fontSize: 30,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  metaText: {
    color: COLORS.PURE_WHITE,
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 7,
  },
  actionText: {
    color: COLORS.PURE_WHITE,
    fontSize: 14,
    fontWeight: "700",
  },
  currency: {
    width: 14,
    height: 14,
  },
});
