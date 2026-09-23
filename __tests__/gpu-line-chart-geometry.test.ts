import { buildChartSegments } from "~/utils/chart-geometry";

describe("GPU line-chart geometry", () => {
  it("builds one immutable segment for each adjacent point pair", () => {
    const points = [
      { x: 8, y: 84 },
      { x: 52, y: 42 },
      { x: 96, y: 60 },
    ] as const;

    const segments = buildChartSegments(points, (_start, _end, index) =>
      index === 0 ? "#16d9a5" : "#ff4655"
    );

    expect(segments).toEqual([
      {
        color: "#16d9a5",
        end: { x: 52, y: 42 },
        start: { x: 8, y: 84 },
      },
      {
        color: "#ff4655",
        end: { x: 96, y: 60 },
        start: { x: 52, y: 42 },
      },
    ]);
    expect(points).toEqual([
      { x: 8, y: 84 },
      { x: 52, y: 42 },
      { x: 96, y: 60 },
    ]);
  });

  it("returns no drawable segments for fewer than two points", () => {
    expect(buildChartSegments([], () => "#fff")).toEqual([]);
    expect(buildChartSegments([{ x: 1, y: 2 }], () => "#fff")).toEqual([]);
  });
});
