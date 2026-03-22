import { useTranslation } from "react-i18next";
import { StyleSheet, View, Text, Image } from "react-native";

import CurrencyIcon from "./CurrencyIcon";
import { useMediaPopupStore } from "./popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import GlassCard from "~/components/ui/GlassCard";
import ValorantButton from "~/components/ui/ValorantButton";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface props {
  item: SkinShopItem;
}

export default function BundleItem(props: React.PropsWithChildren<props>) {
  const { t } = useTranslation();
  const { showMediaPopup } = useMediaPopupStore();
  const { screenshotModeEnabled } = useFeatureStore();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.priceContainer}>
          <CurrencyIcon icon="vp" style={styles.currencyIcon} />
          <Text style={styles.price}>{props.item.price}</Text>
        </View>
        <Text style={styles.separateText}>Included in bundle</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {props.item.displayName}
      </Text>
      <Text style={styles.subtitle}>{t("separate")}</Text>

      <View style={styles.imageFrame}>
        <Image
          resizeMode="contain"
          style={styles.image}
          source={getDisplayIcon(props.item, screenshotModeEnabled)}
        />
      </View>

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
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    marginTop: 6,
  },
  priceContainer: {
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
  separateText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  imageFrame: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE_MUTED,
    padding: 14,
  },
  image: {
    width: "100%",
    height: 140,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    minHeight: 44,
  },
});
