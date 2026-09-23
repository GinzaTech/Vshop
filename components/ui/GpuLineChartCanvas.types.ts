import type { ChartPoint, ChartSegment } from "~/utils/chart-geometry";

export type GpuChartDot = Readonly<{
  color: string;
  point: ChartPoint;
  radius?: number;
  strokeColor?: string;
  strokeWidth?: number;
}>;

export type GpuChartGridLine = Readonly<{
  color: string;
  endX?: number;
  opacity?: number;
  startX?: number;
  y: number;
}>;

export type GpuLineChartCanvasProps = {
  dots?: readonly GpuChartDot[];
  gridLines?: readonly GpuChartGridLine[];
  height: number;
  segments: readonly ChartSegment[];
  strokeWidth?: number;
  width: number;
};
