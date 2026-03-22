import { useNavigation } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { RadioButton } from "react-native-paper";
import { resources } from "~/utils/localization";
import { COLORS } from "~/constants/DesignSystem";
import GlassCard from "~/components/ui/GlassCard";

function Language() {
  const { i18n, t } = useTranslation();
  const navigation = useNavigation();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.BACKGROUND }}>
      <View style={{ padding: 20 }}>
        <GlassCard>
          <RadioButton.Group
            onValueChange={(value) => {
              i18n.changeLanguage(value);
              navigation.goBack();
            }}
            value={i18n.language}
          >
            {Object.keys(resources).map((lang) => (
              <RadioButton.Item
                key={lang}
                label={`${t(`languages.${lang}`)} (${lang})`}
                value={lang}
                color={COLORS.PURE_BLACK}
                uncheckedColor={COLORS.TEXT_SECONDARY}
                labelStyle={{ color: COLORS.TEXT_PRIMARY }}
              />
            ))}
          </RadioButton.Group>
        </GlassCard>
      </View>
    </ScrollView>
  );
}

export default Language;
