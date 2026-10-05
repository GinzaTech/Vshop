import React from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Fill, Shader, ImageShader, Skia, rect, type SkRuntimeEffect } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";
import { runWhenIdle } from "~/utils/idle-task";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import { MoreGlassWallpaper } from "../more-glass/MoreGlassWallpaper";
import { useMaterialImage } from "../more-glass/material-image";
import { REFRACTIVE_GLASS_SHADER } from "./shader";
import type { GlassRendererProps } from "./renderer.types";

let cachedProgram: SkRuntimeEffect | null = null;
const silverColor = [1, 3, 5].map(offset => parseInt(MORE_GLASS_MATERIAL.silver.slice(offset, offset + 2), 16) / 255);
class MaterialBoundary extends React.Component<React.PropsWithChildren<{ onFailure: () => void }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
export function GlassRenderer({ width, height, enabled, wallpaperSource, projection, onAvailabilityChange }: GlassRendererProps) {
  const image = useMaterialImage(wallpaperSource);
  const [program, setProgram] = React.useState(() => cachedProgram);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    if (!enabled || program) return;
    const task = runWhenIdle(() => {
      try {
        cachedProgram ??= Skia.RuntimeEffect.Make(REFRACTIVE_GLASS_SHADER);
        if (!cachedProgram) throw new Error("Unified glass shader unavailable");
        setProgram(cachedProgram);
      } catch (error: unknown) {
        setFailed(true);
        if (__DEV__) console.warn("[refractive-glass] Material unavailable", sanitizeErrorForLog(error));
      }
    });
    return () => task.cancel();
  }, [enabled, program]);
  const canDraw = enabled && width > 0 && height > 0 && program !== null && image !== null && !failed;
  React.useEffect(() => { onAvailabilityChange(canDraw); return () => onAvailabilityChange(false); }, [canDraw, onAvailabilityChange]);
  const uniforms = useDerivedValue(() => {
    const { visibleIds: _ids, viewportReady: _ready, ...geometry } = projection.value;
    return { ...geometry, resolution: [width, height], cornerRadius: MORE_GLASS_MATERIAL.radius,
      refraction: MORE_GLASS_MATERIAL.refraction, bevelWidth: MORE_GLASS_MATERIAL.bevelWidth,
      zoom: MORE_GLASS_MATERIAL.magnification, whiteVeil: MORE_GLASS_MATERIAL.whiteVeil,
      wallpaperStrength: MORE_GLASS_MATERIAL.wallpaperStrength, silverColor,
      pageColor: [1, 3, 5].map(offset => parseInt(MORE_GLASS_MATERIAL.background.slice(offset, offset + 2), 16) / 255) };
  }, [projection, width, height]);
  return <View testID="refractive-glass-renderer" pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <MoreGlassWallpaper source={wallpaperSource} />
    {canDraw && program && image ? <MaterialBoundary onFailure={() => setFailed(true)}>
      <Canvas testID="refractive-glass-canvas" style={StyleSheet.absoluteFill}>
        <Fill><Shader source={program} uniforms={uniforms}><ImageShader image={image} fit="cover" rect={rect(0, 0, width, height)} /></Shader></Fill>
      </Canvas>
    </MaterialBoundary> : null}
  </View>;
}
