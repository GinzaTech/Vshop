import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import Countdown from "~/components/Countdown";
import ShopAccessoryItem from "~/components/ShopAccessoryItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

function AccessoryShop() {
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
      <Text style={styles.title}>Accessory rotation</Text>
      <Text style={styles.subtitle}>
        Cards, sprays, buddies and titles available for kingdom credits.
      </Text>

      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search accessories"
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricPill}>
          <CurrencyIcon icon="kc" style={styles.metricIcon} />
          <Text style={styles.metricText}>{user.balances.kc}</Text>
        </View>
        <View style={styles.metricPill}>
          <Icon name="clock-outline" size={16} color={COLORS.TEXT_PRIMARY} />
          <Countdown timestamp={timestamp} />
        </View>
      </View>

      {items.map((item) => (
        <ShopAccessoryItem item={item} key={item.uuid} />
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
    paddingBottom: 36,
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
});

export default AccessoryShop;
