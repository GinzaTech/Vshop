// 📦 BatteryOptimizationWarning.tsx – Cảnh báo tối ưu pin Android
// Hiển thị banner khi thông báo wishlist được bật nhưng thiết bị
// đang có chế độ tối ưu pin, có thể ảnh hưởng đến background fetch

import { Banner } from "react-native-paper";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isBatteryOptimizationEnabledAsync } from "expo-battery";
import { startActivityAsync, ActivityAction } from "expo-intent-launcher";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { AppState, Platform } from "react-native";
import { COLORS } from "~/constants/DesignSystem";

/**
 * BatteryOptimizationWarning – Component hiển thị cảnh báo tối ưu pin
 * Chỉ hoạt động trên Android, kiểm tra trạng thái tối ưu pin khi app focus,
 * cho phép người dùng mở trang cài đặt tối ưu pin chung. Ứng dụng không yêu
 * cầu quyền miễn trừ trực tiếp vì quyền đó không phù hợp với một companion app.
 */
export default function BatteryOptimizationWarning() {
  // State: có đang bị tối ưu pin không?
  const [batteryOptimizationEnabled, setBatteryOptimizationEnabled] =
    useState(false);
  const { t } = useTranslation();
  // Chỉ hiển thị khi người dùng đã bật thông báo wishlist
  const notificationEnabled = useWishlistStore(
    (state) => state.notificationEnabled
  );

  // Effect: Kiểm tra tối ưu pin khi mount và mỗi khi app focus lại
  useEffect(() => {
    if (Platform.OS !== "android") return;

    void checkBatteryOptimizations();

    const sub = AppState.addEventListener("focus", () => {
      void checkBatteryOptimizations();
    });

    return () => {
      sub.remove();
    };
  }, []);

  /**
   * checkBatteryOptimizations – Kiểm tra trạng thái tối ưu pin hiện tại
   */
  const checkBatteryOptimizations = async () => {
    try {
      const enabled = await isBatteryOptimizationEnabledAsync();
      setBatteryOptimizationEnabled(enabled);
    } catch {
      setBatteryOptimizationEnabled(false);
    }
  };

  /**
   * openBatteryOptimizationSettings – Mở danh sách cài đặt chung để người
   * dùng tự quyết định, không gửi yêu cầu miễn trừ trực tiếp cho VShop.
   */
  const openBatteryOptimizationSettings = async () => {
    try {
      await startActivityAsync(
        ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS
      );
      await checkBatteryOptimizations();
    } catch {
      setBatteryOptimizationEnabled(false);
    }
  };

  return (
    // Banner chỉ visible khi notificationEnabled && batteryOptimizationEnabled
    <Banner
      visible={notificationEnabled && batteryOptimizationEnabled}
      style={{
        backgroundColor: COLORS.WARNING_SURFACE,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: COLORS.WARNING_BORDER,
        marginBottom: 16,
      }}
      actions={[
        {
          label: t("battery_optimization_warning.action"),
          onPress: () => openBatteryOptimizationSettings(),
        },
      ]}
      icon={({ color, size }) => (
        <Icon name="battery-alert" color={COLORS.WARNING} size={size} />
      )}
    >
      {t("battery_optimization_warning.description")}
    </Banner>
  );
}
