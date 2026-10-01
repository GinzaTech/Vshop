import { View } from "react-native";
import type { RefractionLensProps, RefractionTargetProps } from "./native-refraction.types";

/** No native import on iOS/web or unsupported bundlers. */
export function RefractionTarget({ enabled: _enabled, onTargetReady: _ready, ...props }: RefractionTargetProps) {
  return <View {...props} />;
}
export function RefractionLens(_props: RefractionLensProps) { return null; }
