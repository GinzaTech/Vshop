import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SPACING } from "~/constants/DesignSystem";

/** Loading is local to the option badge; artwork and text keep their opacity. */
export function ProfilePickerOptionBusy({ busy, color }: { busy: boolean; color: string }) {
  if (!busy) return null;
  return (
    <View testID="profile-picker-option-busy" pointerEvents="none" accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={presentationStyles.busyBadge}>
      <ActivityIndicator animating color={color} size="small" />
    </View>
  );
}

const presentationStyles = StyleSheet.create({
  busyBadge: { position: "absolute", right: SPACING.xs, bottom: SPACING.xs },
});
