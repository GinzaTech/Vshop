import type { SharedValue } from "react-native-reanimated";
import type { MoreGlassRects } from "./more-glass-model";
export type MoreGlassSceneRendererProps = {
  width: number;
  height: number;
  rects: MoreGlassRects;
  scrollOffset: SharedValue<number>;
  wallpaperSource: number | string;
  enabled: boolean;
  onAvailabilityChange: (ready: boolean) => void;
};
