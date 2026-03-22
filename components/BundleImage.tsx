import { ImageBackground, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import CurrencyIcon from "./CurrencyIcon";
import Countdown from "./Countdown";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface props {
  bundle: BundleShopItem;
  remainingSecs: number;
}

export default function Bundle({ bundle, remainingSecs }: props) {
  const timestamp = new Date().getTime() + remainingSecs * 1000;
  const { screenshotModeEnabled } = useFeatureStore();

  return (
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
              : "rgba(23,26,31,0.58)",
          },
        ]}
      >
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <Icon name="package-variant-closed" size={14} color={COLORS.PURE_WHITE} />
            <Text style={styles.badgeText}>Featured bundle</Text>
          </View>
          <View style={styles.timerWrap}>
            <Countdown timestamp={timestamp} color={COLORS.PURE_WHITE} />
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.title}>{bundle.displayName}</Text>
          <View style={styles.priceRow}>
            <CurrencyIcon icon="vp" style={styles.currency} />
            <Text style={styles.price}>{bundle.price}</Text>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 280,
    marginBottom: 20,
    borderRadius: RADIUS.card,
    overflow: "hidden",
  },
  heroImage: {
    borderRadius: RADIUS.card,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(23,26,31,0.42)",
  },
  badgeText: {
    color: COLORS.PURE_WHITE,
    fontWeight: "600",
  },
  timerWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(23,26,31,0.42)",
  },
  bottom: {
    gap: 8,
  },
  title: {
    color: COLORS.PURE_WHITE,
    fontWeight: "700",
    fontSize: 30,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  currency: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  price: {
    color: COLORS.PURE_WHITE,
    fontSize: 16,
    fontWeight: "600",
  },
});
