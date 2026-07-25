// 📄 app/language.tsx — Màn hình chọn ngôn ngữ (dạng modal)
// Cho phép người dùng chọn ngôn ngữ hiển thị từ danh sách resources.
// Sau khi chọn, tự động đóng modal và quay lại màn hình trước.

import { useNavigation } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { RadioButton } from "react-native-paper";
import { resources } from "~/utils/localization";
import { COLORS } from "~/constants/DesignSystem";
import GlassCard from "~/components/ui/GlassCard";

/**
 * Language — Component chọn ngôn ngữ.
 *
 * State:
 * - i18n (từ useTranslation): Đối tượng i18n chứa language hiện tại
 *   và phương thức changeLanguage.
 * - t (từ useTranslation): Hàm dịch.
 * - navigation (từ useNavigation): Điều hướng, dùng để goBack sau khi chọn.
 *
 * resources: Object chứa tất cả các ngôn ngữ có sẵn (key = mã ngôn ngữ).
 *
 * Behavior:
 * - Khi người dùng chọn một RadioButton, gọi i18n.changeLanguage(value)
 *   và gọi navigation.goBack() để đóng modal.
 *
 * @returns {JSX.Element} Màn hình modal chọn ngôn ngữ.
 */
function Language() {
  const { i18n, t } = useTranslation();
  const navigation = useNavigation();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.BACKGROUND }}>
      <View style={{ padding: 20 }}>
        <GlassCard>
          <RadioButton.Group
            onValueChange={(value) => {
              // Đổi ngôn ngữ và quay lại
              i18n.changeLanguage(value);
              navigation.goBack();
            }}
            value={i18n.language} // Ngôn ngữ hiện tại được chọn
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
