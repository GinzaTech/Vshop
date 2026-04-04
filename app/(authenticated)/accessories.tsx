import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import ShopAccessoryItem from "~/components/ShopAccessoryItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import PageIntro from "~/components/ui/PageIntro";

function AccessoryShop() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const [query, setQuery] = React.useState("");
  const timestamp =
    new Date().getTime() + user.shops.remainingSecs.accessory * 1000;

  const items = React.useMemo(() => {
    return user.shops.accessory.filter((item) =>
      item.displayName.toLowerCase().includes(query.trim().toLowerCase())
    );
  }, [query, user.shops.accessory]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("accessories_page.title")}
        subtitle={t("accessories_page.subtitle")}
        style={styles.header}
      />

      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("accessories_page.search_placeholder")}
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.metricRow}>
        <InfoPill style={styles.metricPill}>
          <CurrencyIcon icon="kc" style={styles.metricIcon} />
          <Text style={styles.metricText}>{user.balances.kc}</Text>
        </InfoPill>
        <InfoPill style={styles.metricPill}>
          <Icon name="clock-outline" size={16} color={COLORS.TEXT_PRIMARY} />
          <Countdown timestamp={timestamp} />
        </InfoPill>
      </View>

      {items.length > 0 ? (
        items.map((item) => <ShopAccessoryItem item={item} key={item.uuid} />)
      ) : (
        <EmptyStateCard
          title={t("accessories_page.empty_title")}
          subtitle={t("accessories_page.empty_subtitle")}
        />
      )}
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
    paddingBottom: 36,
  },
  header: {
    marginBottom: 18,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    minHeight: 56,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  metricPill: {
    flex: 1,
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

export default AccessoryShop;
