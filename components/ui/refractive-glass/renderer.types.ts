import type { SharedValue } from "react-native-reanimated";
import type { GlassProjection } from "./types";
export type GlassRendererProps = {
  width: number; height: number; enabled: boolean; wallpaperSource: number | string;
  projection: SharedValue<GlassProjection>; onAvailabilityChange: (ready: boolean) => void;
};
