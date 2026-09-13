// ===== PrimaryTabScene.tsx =====
// Host ổn định cho từng scene trong tab chính. Khi tab mất focus, nội dung
// bị ẩn bằng opacity (thay vì unmount) và bị loại khỏi vùng tiếp nhận touch
// + accessibility, tránh fade nhầm nội dung trang cũ vào trang mới.
import type { ReactNode } from "react";
import { useIsFocused } from "expo-router";
import { StyleSheet, View } from "react-native";
import { COLORS } from "~/constants/DesignSystem";

/**
 * PrimaryTabScene – Container giữ nguyên nội dung khi chuyển tab.
 * - focused = true  : nhận touch, hiển thị bình thường cho screen reader.
 * - focused = false : opacity 0, pointerEvents "none", ẩn khỏi accessibility.
 *
 * @param children – React node nội dung của tab scene.
 * @returns View full màn hình (nền BACKGROUND) bọc nội dung tab.
 */
export default function PrimaryTabScene({ children }: { children: ReactNode }) {
  // focused: tab hiện tại có đang hiển thị không (expo-router useIsFocused)
  const focused = useIsFocused();
  return (
    <View
      // collapsable=false: đảm bảo View không bị native flatten để style luôn áp dụng
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

// styles:
//   scene  – flex 1, nền BACKGROUND đồng bộ với app
//   hidden – opacity 0 khi tab không focus (vẫn giữ layout)
const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  hidden: { opacity: 0 },
});
