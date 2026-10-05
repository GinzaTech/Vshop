import React from "react";
import { MoreGlassWallpaper } from "../more-glass/MoreGlassWallpaper";
import type { GlassRendererProps } from "./renderer.types";
export function GlassRenderer({ wallpaperSource, onAvailabilityChange }: GlassRendererProps) {
  React.useEffect(() => { onAvailabilityChange(false); }, [onAvailabilityChange]);
  return <MoreGlassWallpaper source={wallpaperSource} />;
}
