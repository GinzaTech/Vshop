import React from "react";
import { View } from "react-native";
import { Canvas, Circle, Line } from "@shopify/react-native-skia";

import type { GpuLineChartCanvasProps } from "./GpuLineChartCanvas.types";

/**
 * One native Skia surface for chart grids, segments and dots. The wrapper never
 * receives touches; consumers keep semantic Pressables above it.
 */
export function GpuLineChartCanvas({
  dots = [],
  gridLines = [],
  height,
  segments,
  strokeWidth = 2,
  width,
}: GpuLineChartCanvasProps) {
  return (
    <View
      pointerEvents="none"
      style={{ height, left: 0, position: "absolute", top: 0, width }}
    >
      <Canvas style={{ height, width }}>
        {gridLines.map((line, index) => (
          <Line
            key={`grid-${index}-${line.y}`}
            color={line.color}
            opacity={line.opacity ?? 1}
            p1={{ x: line.startX ?? 0, y: line.y }}
            p2={{ x: line.endX ?? width, y: line.y }}
            strokeWidth={1}
          />
        ))}
        {segments.map((segment, index) => (
          <Line
            key={`segment-${index}`}
            color={segment.color}
            p1={segment.start}
            p2={segment.end}
            strokeWidth={strokeWidth}
          />
        ))}
        {dots.map((dot, index) => (
          <React.Fragment key={`dot-${index}`}>
            <Circle
              color={dot.color}
              cx={dot.point.x}
              cy={dot.point.y}
              r={dot.radius ?? 4.5}
            />
            {dot.strokeColor && (dot.strokeWidth ?? 0) > 0 ? (
              <Circle
                color={dot.strokeColor}
                cx={dot.point.x}
                cy={dot.point.y}
                r={dot.radius ?? 4.5}
                style="stroke"
                strokeWidth={dot.strokeWidth}
              />
            ) : null}
          </React.Fragment>
        ))}
      </Canvas>
    </View>
  );
}
