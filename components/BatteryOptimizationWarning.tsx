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
import * as Application from "expo-application";
import { COLORS } from "~/constants/DesignSystem";

/**
 * BatteryOptimizationWarning – Component hiển thị cảnh báo tối ưu pin
 * Chỉ hoạt động trên Android, kiểm tra trạng thái tối ưu pin khi app focus,
 * cho phép người dùng yêu cầu tắt tối ưu pin cho ứng dụng
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

    checkBatteryOptimizations();

    const sub = AppState.addEventListener("focus", () => {
      checkBatteryOptimizations();
    });

    return () => {
      sub.remove();
    };
  }, []);

  /**
   * checkBatteryOptimizations – Kiểm tra trạng thái tối ưu pin hiện tại
   */
  const checkBatteryOptimizations = async () => {
    const enabled = await isBatteryOptimizationEnabledAsync();
    setBatteryOptimizationEnabled(enabled);
  };

  /**
   * requestIgnoreBatteryOptimizations – Mở settings Android để người dùng
   * tắt tối ưu pin cho app này
   */
  const requestIgnoreBatteryOptimizations = async () => {
    await startActivityAsync(
      ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${Application.applicationId}` }
    );
    await checkBatteryOptimizations();
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
          onPress: () => requestIgnoreBatteryOptimizations(),
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
