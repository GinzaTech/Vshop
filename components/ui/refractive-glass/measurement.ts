import { measure, type AnimatedRef } from "react-native-reanimated";
import { isUIRuntime } from "react-native-worklets";
import type { View } from "react-native";
import type { GlassMeasured } from "./model";

export function readGlassMeasure(ref: AnimatedRef<View>): GlassMeasured | null {
  "worklet";
  if (!isUIRuntime() || ref() == null) return null;
  return measure(ref);
}
