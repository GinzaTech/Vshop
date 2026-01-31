import { useTranslation } from "react-i18next";
import { StyleSheet, View, Text, Image, Platform } from "react-native";
import { useTheme } from "react-native-paper";
import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import GlassCard from "~/components/ui/GlassCard";
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS } from "~/constants/DesignSystem";

interface props {
  item: SkinShopItem;
}

export default function BundleItem(props: React.PropsWithChildren<props>) {
  const { t } = useTranslation();
  const { showMediaPopup } = useMediaPopupStore();
  const { screenshotModeEnabled } = useFeatureStore();
  const { colors } = useTheme();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {props.item.displayName}
        </Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{props.item.price}</Text>
          <CurrencyIcon icon="vp" style={styles.currencyIcon} />
          <Text style={styles.separateText}>({t("separate")})</Text>
        </View>
      </View>

      <Image
        resizeMode="contain"
        style={styles.image}
        source={getDisplayIcon(props.item, screenshotModeEnabled)}
      />

      <View style={styles.actions}>
        <ValorantButton
          title={t("levels")}
          onPress={() =>
            showMediaPopup(
              props.item.levels.map(
                (level) => level.streamedVideo || level.displayIcon || ""
              ),
              t("levels")
            )
          }
          variant="secondary"
          style={styles.button}
        />
        <ValorantButton
          title={t("chromas")}
          onPress={() =>
            showMediaPopup(
              props.item.chromas.map(
                (chroma) => chroma.streamedVideo || chroma.fullRender
              ),
              t("chromas")
            )
          }
          variant="secondary"
          style={styles.button}
        />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  title: {
    color: COLORS.PURE_WHITE,
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: "600",
    marginRight: 4,
  },
  currencyIcon: {
    width: 14,
    height: 14,
  },
  separateText: {
    color: COLORS.GLASS_WHITE_DIM,
    fontSize: 10,
    marginLeft: 4,
    fontStyle: 'italic'
  },
  image: {
    width: "100%",
    height: 120, // Slightly smaller than ShopItem
    marginBottom: 10,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6
  },
  button: {
    flex: 1,
    minHeight: 44, // Taller touch target
  },
});
