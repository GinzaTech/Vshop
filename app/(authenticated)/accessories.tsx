import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import Countdown from "~/components/Countdown";
import ShopAccessoryItem from "~/components/ShopAccessoryItem";
import { useUserStore } from "~/hooks/useUserStore";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useTheme } from "react-native-paper";
import { COLORS } from "~/constants/DesignSystem";

function AccessoryShop() {
  const user = useUserStore((state) => state.user);
  const { colors } = useTheme();
  const timestamp = new Date().getTime() + user.shops.remainingSecs.accessory * 1000;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.balanceContainer}>
          <CurrencyIcon
            icon="kc"
            style={styles.currencyIcon}
          />
          <Text style={styles.balanceText}>
            {user.balances.kc.toString()}
          </Text>
        </View>
        <Countdown timestamp={timestamp} />
      </View>
      {user.shops.accessory.map((item) => (
        <ShopAccessoryItem item={item} key={item.uuid} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16, // Consistent padding
    marginBottom: 5
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "center"
  },
  currencyIcon: {
    width: 20,
    height: 20,
    marginRight: 6,
    marginTop: 4
  },
  balanceText: {
    color: COLORS.PURE_WHITE,
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 3
  }
});

export default AccessoryShop;
