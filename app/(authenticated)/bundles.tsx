import React from "react";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";
import BundleImage from "~/components/BundleImage";
import BundleItem from "~/components/BundleItem";
import { useUserStore } from "~/hooks/useUserStore";
import Icon from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";

function Bundles() {
  const { t } = useTranslation();
  const user = useUserStore(({ user }) => user);

  return user.shops.bundles.length !== 0 ? (
    <ScrollView>
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