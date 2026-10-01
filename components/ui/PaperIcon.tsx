// ===== PaperIcon.tsx =====
// Icon renderer cho react-native-paper: paper yêu cầu một thư viện icon
// (MaterialCommunityIcons/vector-icons) cho các icon mặc định của component
// như Searchbar ("magnify", "close") hay Appbar.BackAction ("arrow-left").
// App đã bỏ @expo/vector-icons nên thay vì cài lại dependency, ta map tên icon
// của paper sang hệ AppIcon (MorphIcons) sẵn có qua `settings.icon` của
// PaperProvider — một nơi duy nhất, không phụ thuộc vector-icons.
import { StyleSheet, View } from "react-native";

import AppIcon from "~/components/ui/AppIcon";
import { COLORS } from "~/constants/DesignSystem";
import type { AppIconName } from "~/components/ui/app-icon-registry";

/** Props mà react-native-paper truyền cho icon component trong settings.icon. */
interface PaperIconProps {
  name: string;
  color?: string;
  size: number;
  allowFontScaling?: boolean;
  testID?: string;
}

/** Map tên icon MaterialCommunityIcons của paper → semantic AppIconName. */
const PAPER_ICON_MAP: Readonly<Record<string, AppIconName>> = {
  magnify: "search",
  close: "close",
  "arrow-left": "back",
  check: "check",
};

/**
 * PaperIcon – Bridge icon giữa react-native-paper và AppIcon.
 * Tên lạ (không có trong map) fail-closed về "circleHelp" để không crash.
 *
 * @param props - Xem PaperIconProps ở trên (paper truyền vào).
 * @returns AppIcon tương ứng với tên paper.
 */
export default function PaperIcon({ name, color = COLORS.TEXT_PRIMARY, size, testID }: PaperIconProps) {
  const mapped = PAPER_ICON_MAP[name] ?? "circleHelp";
  return (
    <View style={styles.icon} testID={testID}>
      <AppIcon name={mapped} size={size} color={color} decorative />
    </View>
  );
}

const styles = StyleSheet.create({
  // Paper đo icon theo size; bọc View để nhận style paper mà AppIcon không hỗ trợ.
  icon: { alignItems: "center", justifyContent: "center" },
});
