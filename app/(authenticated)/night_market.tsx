import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import NightMarketItem from "~/components/NightMarketItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import PageIntro from "~/components/ui/PageIntro";

function NightMarket() {
  const { t } = useTranslation();
  const user = useUserStore(({ user }) => user);
  const timestamp =
    new Date().getTime() + user.shops.remainingSecs.nightMarket * 1000;

  if (user.shops.nightMarket.length === 0) {
    return (
      <EmptyStateCard
        centered
        icon={<Icon name="weather-night" size={36} color={COLORS.TEXT_PRIMARY} />}
        title={t("night_market_page.empty_title")}
        subtitle={t("night_market_page.empty_subtitle")}
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("night_market_page.title")}
        subtitle={t("night_market_page.subtitle")}
        style={styles.header}
      />

      <View style={styles.metricRow}>
        <InfoPill style={[styles.metricPill, styles.balanceMetricPill]}>
          <CurrencyIcon icon="vp" style={styles.metricIcon} />
          <Text style={styles.metricText}>{user.balances.vp}</Text>
        </InfoPill>
        <InfoPill style={styles.metricPill}>
          <Icon name="clock-outline" size={16} color={COLORS.TEXT_PRIMARY} />
          <Countdown timestamp={timestamp} />
        </InfoPill>
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
  header: {
    marginBottom: 18,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  metricPill: {
    flex: 1,
  },
  balanceMetricPill: {
    backgroundColor: COLORS.SURFACE_MUTED,
    borderColor: "rgba(23, 26, 31, 0.10)",
  },
  metricIcon: {
    width: 14,
    height: 14,
  },
  metricText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
});

export default NightMarket;
