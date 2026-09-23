export type ChartPoint = Readonly<{
  x: number;
  y: number;
}>;

export type ChartSegment = Readonly<{
  color: string;
  end: ChartPoint;
  start: ChartPoint;
}>;

type SegmentColorResolver = (
  start: ChartPoint,
  end: ChartPoint,
  index: number
) => string;

/**
 * Builds immutable adjacent line segments for a native canvas renderer.
 * Geometry remains independent from Skia so it is cheap to unit-test and reuse.
 */
export function buildChartSegments(
  points: readonly ChartPoint[],
  resolveColor: SegmentColorResolver
): ChartSegment[] {
  return points.slice(0, -1).map((start, index) => ({
    color: resolveColor(start, points[index + 1], index),
    end: points[index + 1],
    start,
  }));
}
