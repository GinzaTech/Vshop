import React from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import BundleImage from "~/components/BundleImage";
import BundleItem from "~/components/BundleItem";
import { useUserStore } from "~/hooks/useUserStore";
import Icon from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import CurrencyIcon from "~/components/CurrencyIcon";

function Bundles() {
  const { t } = useTranslation();
  const user = useUserStore(({ user }) => user);

  return user.shops.bundles.length !== 0 ? (
    <ScrollView>
      {/* Header - Copied from Shop.tsx for consistency */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <CurrencyIcon icon="vp" style={{
            width: 20,
            height: 20,
            marginTop: 4
          }} />
          <Text style={{
            color: "white",
            fontSize: 16,
            fontWeight: "bold",
            marginLeft: 8,
            marginTop: 3
          }}>
            {user.balances.vp.toString()}
          </Text>
        </View>
        {/* Bundles have individual timers, but we can show main timer or nothing. 
              Let's show main timer as global shop reset context, or just empty if confusing. 
              Shop.tsx shows main timer. Keeping it consistent. */}
        {/* <Countdown timestamp={timestamp} /> */}
        {/* Actually, bundles usually expire differently. Let's JUST show balance to keep it clean, 
              since each bundle card has its own timer in BundleImage */ }
      </View>

      {user.shops.bundles.map((bundle, i) => (
        <View key={bundle.uuid}>
          <BundleImage
            bundle={bundle}
            remainingSecs={user.shops.remainingSecs.bundles[i]}
          />
          {bundle.items.map((item, i) => (
            <BundleItem item={item} key={item.uuid} />
          ))}
        </View>
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
        name="question-mark"
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
        {t("no_bundle")}
      </Text>
    </View>
  );
}

export default Bundles;