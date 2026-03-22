import React from "react";
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

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
  const timestamp = new Date().getTime() + remainingSecs * 1000;
  const { screenshotModeEnabled } = useFeatureStore();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.touchable}
    >
      <ImageBackground
        style={styles.hero}
        imageStyle={styles.heroImage}
        source={{ uri: bundle.displayIcon }}
        resizeMode="cover"
      >
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
              <Text style={styles.topBadgeText}>Featured bundle</Text>
            </View>

            <View style={styles.timerPill}>
              <Countdown timestamp={timestamp} color={COLORS.PURE_WHITE} />
            </View>
          </View>

          <View>
            <Text style={styles.eyebrow}>Collection drop</Text>
            <Text style={styles.title}>{bundle.displayName}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Icon
                  name="layers-triple-outline"
                  size={15}
                  color={COLORS.PURE_WHITE}
                />
                <Text style={styles.metaText}>{bundle.items.length} items</Text>
              </View>
              <View style={styles.metaPill}>
                <CurrencyIcon icon="vp" style={styles.currency} />
                <Text style={styles.metaText}>{bundle.price}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionPill}>
            <Text style={styles.actionText}>
              {expanded ? "Hide included skins" : "Show included skins"}
            </Text>
            <Icon
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={COLORS.PURE_WHITE}
            />
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 20,
  },
  hero: {
    minHeight: 280,
    borderRadius: 30,
    overflow: "hidden",
  },
  heroImage: {
    borderRadius: 30,
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
