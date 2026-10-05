import React from "react";
import { useImage, type SkImage } from "@shopify/react-native-skia";

let cachedWallpaper: { source: number | string; image: SkImage } | null = null;
/** One source-qualified public wallpaper is shared by all viewport materials. */
export function useMaterialImage(source: number | string) {
  const retained = cachedWallpaper?.source === source ? cachedWallpaper.image : null;
  const decoded = useImage(retained ? null : source);
  React.useEffect(() => { if (decoded) cachedWallpaper = { source, image: decoded }; }, [decoded, source]);
  return decoded ?? retained;
}
