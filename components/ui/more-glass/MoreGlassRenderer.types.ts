import type { MoreGlassRects } from "./more-glass-model";

export type MoreGlassRendererProps = {
  width: number;
  height: number;
  rects: MoreGlassRects;
  enabled: boolean;
  onAvailabilityChange: (available: boolean) => void;
};
