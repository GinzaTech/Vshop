import React from "react";
import { MoreGlassWallpaper } from "./MoreGlassWallpaper";
import type { MoreGlassSceneRendererProps } from "./MoreGlassSceneRenderer.types";
export function MoreGlassSceneRenderer({ wallpaperSource, onAvailabilityChange }: MoreGlassSceneRendererProps) {
  React.useEffect(() => { onAvailabilityChange(false); }, [onAvailabilityChange]);
  return <MoreGlassWallpaper source={wallpaperSource} />;
}
