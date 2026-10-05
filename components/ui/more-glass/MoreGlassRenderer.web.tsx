import React from "react";
import { MoreGlassField } from "./MoreGlassField";
import type { MoreGlassRendererProps } from "./MoreGlassRenderer.types";

/** No CanvasKit download or native imports on web; preserve the clear vector material. */
export function MoreGlassRenderer({ onAvailabilityChange }: MoreGlassRendererProps) {
  React.useEffect(() => { onAvailabilityChange(false); }, [onAvailabilityChange]);
  return <MoreGlassField />;
}
