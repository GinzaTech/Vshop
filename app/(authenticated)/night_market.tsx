
import React from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useUserStore } from "~/hooks/useUserStore";
import Countdown from "~/components/Countdown";
import NightMarketItem from "~/components/NightMarketItem";
import CurrencyIcon from "~/components/CurrencyIcon";

function NightMarket() {
  const { t } = useTranslation();
  const user = useUserStore(({ user }) => user);
  const timestamp =
    new Date().getTime() + user.shops.remainingSecs.nightMarket * 1000;

  return (
    <>
      {user.shops.nightMarket.length > 0 ? (
        <ScrollView>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignContent: "center",
              paddingVertical: 0,
              paddingHorizontal: 0,
            }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <CurrencyIcon icon="vp" style={{
                width: 20,
                height: 20,
                marginLeft: 6,
                marginTop: 4
              }}></CurrencyIcon>
              <Text style={{
                color: "white",
                fontSize: 16,
                fontWeight: "bold",
                marginLeft: 5,
                marginTop: 3
              }}>
                {user.balances.vp.toString()}
              </Text>
            </View>
            <Countdown timestamp={timestamp} />
          </View>
          {user.shops.nightMarket.map((item) => (
            <NightMarketItem item={item} key={item.uuid} />
          ))}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            alignContent: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            style={{ textAlign: "center" }}
            name="weather-night"
            size={80}
            color="#fff"
          />
          <Text
            style={{
              textAlign: "center",
              fontSize: 14,
              marginTop: 10,
            }}
          >
            {t("no_nightmarket")}
          </Text>
        </View>
      )}
    </>
  );
}

export default NightMarket;
