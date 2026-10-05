import React from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Fill, ImageShader, Shader, Skia, rect, type SkRuntimeEffect } from "@shopify/react-native-skia";
import { useDerivedValue } from "react-native-reanimated";
import { runWhenIdle } from "~/utils/idle-task";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import type { MoreGlassSceneRendererProps } from "./MoreGlassSceneRenderer.types";
import { buildMoreGlassSceneUniforms } from "./more-glass-scene-model";
import { MORE_GLASS_SCENE_SHADER } from "./more-glass-scene-shader";
import { MoreGlassWallpaper } from "./MoreGlassWallpaper";
import { useMaterialImage } from "./material-image";

let cachedProgram: SkRuntimeEffect | null = null;
class CanvasBoundary extends React.Component<React.PropsWithChildren<{ onFailure: (error: unknown) => void }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.onFailure(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function MoreGlassSceneRenderer({ width, height, rects, scrollOffset, wallpaperSource, enabled, onAvailabilityChange }: MoreGlassSceneRendererProps) {
  const [program, setProgram] = React.useState<SkRuntimeEffect | null>(() => cachedProgram);
  const [failed, setFailed] = React.useState(false);
  const image = useMaterialImage(wallpaperSource);
  const geometry = React.useMemo(() => buildMoreGlassSceneUniforms(width, height, rects), [width, height, rects]);
  const uniforms = useDerivedValue(() => {
    const { ready: _ready, ...values } = buildMoreGlassSceneUniforms(width, height, rects, scrollOffset.value);
    return values;
  }, [width, height, rects, scrollOffset]);
  React.useEffect(() => {
    if (!enabled || !geometry.ready || program) return;
    const task = runWhenIdle(() => {
      try {
        cachedProgram ??= Skia.RuntimeEffect.Make(MORE_GLASS_SCENE_SHADER);
        if (!cachedProgram) throw new Error("More wallpaper glass shader did not compile");
        setProgram(cachedProgram);
      } catch (error: unknown) {
        setFailed(true);
        if (__DEV__) console.warn("[more-glass] Wallpaper material unavailable", sanitizeErrorForLog(error));
      }
    });
    return () => task.cancel();
  }, [enabled, geometry.ready, program]);
  const canDraw = enabled && geometry.ready && program !== null && image !== null && !failed;
  React.useEffect(() => {
    onAvailabilityChange(canDraw);
    return () => onAvailabilityChange(false);
  }, [canDraw, onAvailabilityChange]);
  const failure = React.useCallback((error: unknown) => {
    setFailed(true);
    if (__DEV__) console.warn("[more-glass] Wallpaper canvas failed", sanitizeErrorForLog(error));
  }, []);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} testID="more-glass-scene-renderer">
    <MoreGlassWallpaper source={wallpaperSource} />
    {canDraw && program && image ? <CanvasBoundary key={String(wallpaperSource)} onFailure={failure}>
      <Canvas style={StyleSheet.absoluteFill} testID="more-glass-scene-canvas">
        <Fill><Shader source={program} uniforms={uniforms}>
          <ImageShader image={image} fit="cover" rect={rect(0, 0, width, height)} />
        </Shader></Fill>
      </Canvas>
    </CanvasBoundary> : null}
  </View>;
}
