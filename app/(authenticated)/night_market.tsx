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
      {/* Premium Custom Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Vshop</Text>
          <View style={styles.marketBadge}>
            <Icon name="moon-waning-crescent" size={10} color="#ff4655" style={{ marginRight: 4 }} />
            <Text style={styles.marketBadgeText}>{t("night_market_page.badge")}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerBalance}>
            <Text style={styles.headerBalanceText}>{user.balances.vp} {t("vp")}</Text>
            <Text style={styles.headerBalanceSubText}>{user.name || "KONA_Prime"}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user.name || "V").slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Intro Text */}
      <View style={styles.introContainer}>
        <Text style={styles.introTitle}>{t("night_market_page.title")}</Text>
        <Text style={styles.introSubtitle}>
          {t("night_market_page.subtitle")}
        </Text>
      </View>

      {/* Black Countdown Pill Banner */}
      <View style={styles.countdownContainer}>
        <View style={styles.countdownPill}>
          <Icon name="clock-outline" size={16} color={COLORS.PURE_WHITE} style={{ marginRight: 6 }} />
          <Text style={styles.countdownPillLabel}>{t("night_market_page.ends_in")}</Text>
          <Countdown timestamp={timestamp} textStyle={{ color: COLORS.PURE_WHITE, fontWeight: "700" }} />
        </View>
      </View>

      {/* Items List */}
      <View style={styles.list}>
        {user.shops.nightMarket.map((item) => (
          <NightMarketItem item={item} key={item.uuid} />
        ))}
      </View>

      {/* Bottom Info Note */}
      <View style={styles.infoNoteCard}>
        <Icon name="information-outline" size={20} color={COLORS.TEXT_SECONDARY} style={{ marginRight: 12 }} />
        <Text style={styles.infoNoteText}>
          {t("night_market_page.info_note")}
        </Text>
      </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 10,
  },
  headerLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  marketBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 70, 85, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  marketBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ff4655",
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerBalance: {
    alignItems: "flex-end",
    marginRight: 10,
  },
  headerBalanceText: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  headerBalanceSubText: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.PURE_BLACK,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  introContainer: {
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 6,
  },
  introSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
  countdownContainer: {
    marginBottom: 20,
    alignItems: "flex-start",
  },
  countdownPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.PURE_BLACK,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  countdownPillLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
  },
  list: {
    gap: 16,
    marginBottom: 24,
  },
  infoNoteCard: {
    flexDirection: "row",
    backgroundColor: COLORS.SURFACE,
    padding: 16,
    borderRadius: 16,
    borderColor: COLORS.BORDER,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 16,
  },
});

export default NightMarket;
