import { View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";
import { COLORS } from "~/constants/DesignSystem";

interface props {
  msg?: string;
}
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
