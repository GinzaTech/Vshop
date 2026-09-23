import React from "react";
import { View, type ViewStyle } from "react-native";

import type { ChartPoint } from "~/utils/chart-geometry";
import type { GpuLineChartCanvasProps } from "./GpuLineChartCanvas.types";

const lineStyle = (
  start: ChartPoint,
  end: ChartPoint,
  color: string,
  strokeWidth: number
): ViewStyle => {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
  return {
    backgroundColor: color,
    height: strokeWidth,
    left: (start.x + end.x - distance) / 2,
    position: "absolute",
    top: (start.y + end.y - strokeWidth) / 2,
    transform: [{ rotate: `${angle}deg` }],
    width: distance,
  };
};

/** Lightweight web fallback avoids loading the 2.9 MB CanvasKit runtime. */
export function GpuLineChartCanvas({
  dots = [],
  gridLines = [],
  height,
  segments,
  strokeWidth = 2,
  width,
}: GpuLineChartCanvasProps) {
  return (
    <View pointerEvents="none" style={{ height, left: 0, position: "absolute", top: 0, width }}>
      {gridLines.map((line, index) => (
        <View
          key={`grid-${index}-${line.y}`}
          style={{
            backgroundColor: line.color,
            height: 1,
            left: line.startX ?? 0,
            opacity: line.opacity ?? 1,
            position: "absolute",
            top: line.y,
            width: (line.endX ?? width) - (line.startX ?? 0),
          }}
        />
      ))}
      {segments.map((segment, index) => (
        <View
          key={`segment-${index}`}
          style={lineStyle(segment.start, segment.end, segment.color, strokeWidth)}
        />
      ))}
      {dots.map((dot, index) => {
        const radius = dot.radius ?? 4.5;
        return (
          <View
            key={`dot-${index}`}
            style={{
              backgroundColor: dot.color,
              borderColor: dot.strokeColor,
              borderRadius: radius,
              borderWidth: dot.strokeWidth ?? 0,
              height: radius * 2,
              left: dot.point.x - radius,
              position: "absolute",
              top: dot.point.y - radius,
              width: radius * 2,
            }}
          />
        );
      })}
    </View>
  );
}
