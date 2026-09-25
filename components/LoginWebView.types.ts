import type { StyleProp, ViewStyle } from "react-native";

export interface LoginWebViewProps {
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
  expectedAccountId?: string;
}
