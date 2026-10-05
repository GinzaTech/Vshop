import React from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Fill, Shader, Skia, type SkRuntimeEffect } from "@shopify/react-native-skia";
import { runWhenIdle } from "~/utils/idle-task";
import { sanitizeErrorForLog } from "~/utils/log-redaction";
import type { MoreGlassRendererProps } from "./MoreGlassRenderer.types";
import { buildMoreGlassUniforms } from "./more-glass-model";
import { MORE_GLASS_SHADER } from "./more-glass-shader";
import { MoreGlassField } from "./MoreGlassField";

let cachedProgram: SkRuntimeEffect | null = null;
class CanvasBoundary extends React.Component<React.PropsWithChildren<{ onFailure: (error: unknown) => void }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.onFailure(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function MoreGlassRenderer({ width, height, rects, enabled, onAvailabilityChange }: MoreGlassRendererProps) {
  const [program, setProgram] = React.useState<SkRuntimeEffect | null>(null);
  const [failed, setFailed] = React.useState(false);
  const geometry = React.useMemo(() => buildMoreGlassUniforms(width, height, rects), [width, height, rects]);
  const { ready, ...uniforms } = geometry;
  React.useEffect(() => {
    if (!enabled || !ready) return;
    const task = runWhenIdle(() => {
      try {
        cachedProgram ??= Skia.RuntimeEffect.Make(MORE_GLASS_SHADER);
        if (!cachedProgram) throw new Error("More glass shader did not compile");
        setProgram(cachedProgram);
      } catch (error: unknown) {
        setFailed(true);
        if (__DEV__) console.warn("[more-glass] GPU material unavailable", sanitizeErrorForLog(error));
      }
    });
    return () => task.cancel();
  }, [enabled, ready]);
  const canDraw = enabled && ready && program !== null && !failed;
  React.useEffect(() => {
    onAvailabilityChange(canDraw);
    return () => onAvailabilityChange(false);
  }, [canDraw, onAvailabilityChange]);
  const failure = React.useCallback((error: unknown) => {
    setFailed(true);
    if (__DEV__) console.warn("[more-glass] GPU draw failed", sanitizeErrorForLog(error));
  }, []);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} testID="more-glass-renderer">
    <MoreGlassField />
    {canDraw && program ? <CanvasBoundary onFailure={failure}>
      <Canvas style={StyleSheet.absoluteFill} testID="more-glass-native-canvas">
        <Fill><Shader source={program} uniforms={uniforms} /></Fill>
      </Canvas>
    </CanvasBoundary> : null}
  </View>;
}
