// ===== Loading.tsx =====
// Component hiển thị màn hình loading với ActivityIndicator và thông báo tùy chọn.
import { View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { COLORS } from "~/constants/DesignSystem";

// Interface định nghĩa props cho Loading
// msg: thông báo tùy chọn hiển thị bên dưới spinner (nếu có)
interface props {
  msg?: string;
}

// Loading: Component chính
// Full màn hình (flex:1), căn giữa, nền BACKGROUND
// Hiển thị ActivityIndicator màu ACCENT, size large
// Nếu có msg, hiển thị text bên dưới spinner
export default function Loading({ msg }: props) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.BACKGROUND,
      }}
    >
      <ActivityIndicator animating={true} color={COLORS.ACCENT} size="large" />
      {msg && (
        <Text style={{ marginTop: 10, color: COLORS.TEXT_PRIMARY }}>{msg}</Text>
      )}
    </View>
  );
}
