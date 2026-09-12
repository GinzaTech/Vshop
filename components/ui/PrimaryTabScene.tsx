import type { ReactNode } from "react";
import { useIsFocused } from "expo-router";
import { StyleSheet, View } from "react-native";
import { COLORS } from "~/constants/DesignSystem";

/** A stable host keeps the previous page's content out of the incoming fade. */
export default function PrimaryTabScene({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  return (
    <View
      collapsable={false}
      pointerEvents={focused ? "auto" : "none"}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? "auto" : "no-hide-descendants"}
      style={[styles.scene, !focused && styles.hidden]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  hidden: { opacity: 0 },
});
