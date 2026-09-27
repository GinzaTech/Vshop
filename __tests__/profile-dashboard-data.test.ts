// Pure-data tests for the profile dashboard aggregation helpers.
// The legacy dashboard component was removed (replaced by PlayerInfoView);
// these cases now import directly from the shared data module.
import { aggregateMatches, buildActivityWeeks } from "~/components/profile/player-stats-data";
import type { MatchHistoryRecord, MatchHistoryStats } from "~/types/match-ui";

const record = (stats: Partial<MatchHistoryStats>): MatchHistoryRecord => ({
  MatchID: "match", GameStartTime: 1, QueueID: "competitive",
  stats: {
    agentId: "agent", agentName: "Agent", mapId: "map", mapName: "Map",
    kills: 10, deaths: 5, adr: 100, headshotPercent: 20,
    roundsWon: 13, roundsLost: 10, won: true, ...stats,
  } as MatchHistoryStats,
});

describe("profile match aggregation", () => {
  it.each(["agents", "maps"] as const)("does not count a legacy draw as a win in %s", (mode) => {
    const matches = [
      record({ won: true }), record({ won: false, roundsWon: 10, roundsLost: 13 }),
      record({ won: true, roundsWon: 14, roundsLost: 14 }),
    ];
    const before = JSON.stringify(matches);
    const [row] = aggregateMatches(matches, mode);
    expect(row.games).toBe(3);
    expect(row.winPercent).toBeCloseTo(100 / 3);
    expect(JSON.stringify(matches)).toBe(before);
  });

  it("excludes zero-score unknown matches from the win percentage", () => {
    const [row] = aggregateMatches([
      record({ won: true }), record({ won: false, roundsWon: 0, roundsLost: 0 }),
    ], "agents");
    expect(row.winPercent).toBe(100);
  });

  it("uses authoritative results and excludes cancelled/unknown records", () => {
    const [row] = aggregateMatches([
      record({ result: "win", roundsWon: 13, roundsLost: 13 }),
      record({ result: "loss", won: true }),
      record({ result: "draw", won: true }),
      record({ result: "cancelled", won: true }),
      record({ result: "unknown", won: true }),
    ], "agents");
    expect(row.winPercent).toBeCloseTo(100 / 3);
  });

  it("preserves weighted K/D, average ADR, and missing HS behavior", () => {
    const [row] = aggregateMatches([
      record({ kills: 20, deaths: 5, adr: 200, headshotPercent: 30 }),
      record({ kills: 10, deaths: 10, adr: 100, headshotPercent: null }),
    ], "maps");
    expect(row).toMatchObject({ games: 2, kd: 2, adr: 150, headshotPercent: 30 });
  });

  it("sorts the top six without mutating records", () => {
    const matches = Array.from({ length: 8 }, (_, index) => record({
      agentId: `agent-${index}`, kills: index + 1, deaths: 1,
    }));
    const before = JSON.stringify(matches);
    expect(aggregateMatches(matches, "agents").map((row) => row.id))
      .toEqual(["agent-7", "agent-6", "agent-5", "agent-4", "agent-3", "agent-2"]);
    expect(JSON.stringify(matches)).toBe(before);
  });

  it("ignores empty metadata and keeps zero-death K/D finite", () => {
    expect(aggregateMatches([{ ...record({}), stats: null }, record({ agentId: "", agentName: "" })], "agents")).toEqual([]);
    const [row] = aggregateMatches([record({ kills: 10, deaths: 0, headshotPercent: null,
      agentId: "", agentPortrait: "portrait.png", mapId: "", mapImage: "map.png" })], "agents");
    expect(row).toMatchObject({ id: "Agent", imageUrl: "portrait.png", kd: 10, headshotPercent: 0 });
    expect(aggregateMatches([record({ mapId: "" })], "maps")[0].id).toBe("Map");
  });

  it("builds Monday-aligned activity weeks across a year boundary", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 2, 12));
    try {
      const matches = Array.from({ length: 7 }, (_, index) => ({
        ...record({}), MatchID: `day-${index}`, GameStartTime: new Date(2026, 0, 1, 12).getTime(),
      }));
      const weeks = buildActivityWeeks([...matches, { ...record({}), GameStartTime: 0 }]);
      expect(weeks).toHaveLength(12);
      expect(weeks.every((week) => week.length === 7 && week[0].date.getDay() === 1)).toBe(true);
      expect(weeks.flat().find((cell) => cell.dateKey === "2026-01-01"))
        .toMatchObject({ count: 7, level: 5, future: false });
      expect(weeks.flat().find((cell) => cell.dateKey === "2026-01-03")?.future).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
