import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import NightMarketItem from "~/components/NightMarketItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

function NightMarket() {
  const { t } = useTranslation();
  const user = useUserStore(({ user }) => user);
  const timestamp =
    new Date().getTime() + user.shops.remainingSecs.nightMarket * 1000;

  if (user.shops.nightMarket.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyBadge}>
          <Icon name="weather-night" size={36} color={COLORS.TEXT_PRIMARY} />
        </View>
        <Text style={styles.emptyTitle}>{t("no_nightmarket")}</Text>
        <Text style={styles.emptySubtitle}>
          No discounted offers are available in this rotation yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Night market</Text>
      <Text style={styles.subtitle}>
        Limited-time deals with reduced prices on selected skins.
      </Text>

      <View style={styles.metricRow}>
        <View style={styles.metricPill}>
          <CurrencyIcon icon="vp" style={styles.metricIcon} />
          <Text style={styles.metricText}>{user.balances.vp}</Text>
        </View>
        <View style={styles.metricPill}>
          <Icon name="clock-outline" size={16} color={COLORS.TEXT_PRIMARY} />
          <Countdown timestamp={timestamp} />
        </View>
      </View>

      {user.shops.nightMarket.map((item) => (
        <NightMarketItem item={item} key={item.uuid} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  metricPill: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  metricIcon: {
    width: 14,
    height: 14,
  },
  metricText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: COLORS.BACKGROUND,
  },
  emptyBadge: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
  },
});

export default NightMarket;
