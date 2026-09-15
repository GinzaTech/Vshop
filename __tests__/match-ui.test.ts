import type { MatchDetailsData, MatchHistoryRecord } from "~/types/match-ui";
import {
  buildMatchDetailViewModel,
  buildMatchHistoryRecord,
  buildMatchHistoryGroups,
  compactRankUpdate,
  createMatchAssetCatalog,
  enrichMatchHistoryAssets,
  toMatchHistoryItem,
} from "~/utils/match-ui";
import { getMatchHistoryResult, resolveMatchOutcome } from "~/utils/match-result";
import { normalizeRoundOutcome, sideForPlayer, teamASideForRound } from "~/utils/match-transform/common";

// Incomplete payloads model cache/transport data that can omit API fields.
const matchDetails = (
  teams: unknown = [
    { teamId: "Blue", won: true, roundsWon: 13 },
    { teamId: "Red", won: false, roundsWon: 10 },
  ],
  info: Record<string, unknown> = {},
): MatchDetailsData => ({
  matchInfo: {
    matchId: "match-1", mapId: "/Game/Maps/Test/Test", gameStartMillis: 1,
    gameLengthMillis: 1000, queueID: "competitive", seasonId: "act-2",
    isCompleted: true, completionState: "Completed", ...info,
  },
  players: ["Blue", "Red"].map((teamId) => ({
    subject: teamId, teamId, characterId: "AGENT-ID", competitiveTier: 18,
    stats: { score: 100, roundsPlayed: 23, kills: 1, deaths: 1, assists: 1 },
  })),
  roundResults: [], teams,
} as unknown as MatchDetailsData);

jest.mock("~/utils/valorant-assets", () => ({
  getAssets: () => ({
    maps: [
      {
        mapUrl: "/Game/Maps/Test/Test",
        displayName: "Test Map",
        listViewIcon: "https://assets.example/map.png",
      },
    ],
    competitiveTiers: [
      {
        tiers: [
          {
            tier: 18,
            tierName: "Diamond 1",
            smallIcon: "https://assets.example/rank.png",
          },
        ],
      },
    ],
    weapons: [{ uuid: "weapon-id", displayName: "Vandal", displayIcon: "weapon.png" }],
  }),
  getAgent: () => ({
    agents: [
      {
        uuid: "AGENT-ID",
        displayName: "Test Agent",
        displayIcon: "https://assets.example/agent.png",
      },
    ],
  }),
}));

const cachedRecord: MatchHistoryRecord = {
  MatchID: "match-1",
  GameStartTime: 1,
  QueueID: "competitive",
  stats: {
    kda: "1/1/1",
    kills: 1,
    deaths: 1,
    assists: 1,
    score: 100,
    acs: 100,
    adr: 100,
    kd: 1,
    kdRatio: "1.00",
    headshotPercent: 10,
    headshotPct: "10%",
    placement: 1,
    roundsPlayed: 1,
    won: true,
    roundsWon: 1,
    roundsLost: 0,
    agentIcon: null,
    agentId: "agent-id",
    agentName: "Agent",
    agentPortrait: null,
    mapId: "/game/maps/test/test",
    mapName: "/game/maps/test/test",
    mapImage: null,
    gameMode: "competitive",
    rankTier: 18,
    rankName: null,
    rankIcon: null,
    rrEarned: null,
    rrAfter: null,
    rrBefore: null,
    rrPerformanceBonus: null,
    rrAfkPenalty: null,
    competitiveMovement: null,
  },
};

describe("enrichMatchHistoryAssets", () => {
  it("repairs cached visual metadata using case-insensitive identifiers", () => {
    const [enriched] = enrichMatchHistoryAssets(
      [cachedRecord],
      createMatchAssetCatalog()
    );

    expect(enriched.stats).toMatchObject({
      agentName: "Test Agent",
      agentIcon: "https://assets.example/agent.png",
      mapName: "Test Map",
      mapImage: "https://assets.example/map.png",
      rankName: "Diamond 1",
      rankIcon: "https://assets.example/rank.png",
    });
  });

  it("preserves object identity when metadata is already current", () => {
    const catalog = createMatchAssetCatalog();
    const [enriched] = enrichMatchHistoryAssets([cachedRecord], catalog);
    const [unchanged] = enrichMatchHistoryAssets([enriched], catalog);

    expect(unchanged).toBe(enriched);
  });
});

describe("toMatchHistoryItem", () => {
  it("preserves current RR and the RR change for a competitive match", () => {
    const item = toMatchHistoryItem({
      ...cachedRecord,
      stats: {
        ...cachedRecord.stats!,
        rrAfter: 62,
        rrEarned: -16,
      },
    });

    expect(item).toMatchObject({
      rrAfter: 62,
      rrChange: -16,
    });
  });

  it("derives deducted RR from before and after values when earned is absent", () => {
    const item = toMatchHistoryItem({
      ...cachedRecord,
      rankUpdate: {
        RankedRatingBeforeUpdate: 78,
        RankedRatingAfterUpdate: 62,
      },
      stats: {
        ...cachedRecord.stats!,
        rrAfter: null,
        rrBefore: null,
        rrEarned: null,
      },
    });

    expect(item).toMatchObject({
      rrAfter: 62,
      rrChange: -16,
    });
  });
});

describe("match results across detail and history", () => {
  it.each(["Blue", "Red"])("keeps a 14-14 draw neutral for %s", (playerId) => {
    const details = matchDetails([
      { teamId: "Blue", won: false, roundsWon: 14 },
      { teamId: "Red", won: false, roundsWon: 14 },
    ]);
    expect(buildMatchDetailViewModel(details, playerId).match).toMatchObject({
      winningTeam: null, result: "draw",
    });
    const record = buildMatchHistoryRecord(cachedRecord, details, playerId);
    expect(record.stats).toMatchObject({ won: false, result: "draw", seasonId: "act-2" });
    expect(toMatchHistoryItem(record)?.result).toBe("draw");
  });

  it.each([["Blue", "win", true], ["Red", "loss", false]] as const)(
    "keeps normal %s results consistent", (playerId, result, won) => {
      const details = matchDetails();
      expect(buildMatchDetailViewModel(details, playerId).match).toMatchObject({
        winningTeam: "A", result,
      });
      const record = buildMatchHistoryRecord(cachedRecord, details, playerId);
      expect(record.stats).toMatchObject({ won, result });
      expect(toMatchHistoryItem(record)?.result).toBe(result);
    },
  );

  it.each([10, 13])("prefers authoritative winner over score %s-13", (score) => {
    const details = matchDetails([
      { teamId: "Blue", won: true, roundsWon: score },
      { teamId: "Red", won: false, roundsWon: 13 },
    ]);
    const record = buildMatchHistoryRecord(cachedRecord, details, "Blue");
    expect(buildMatchDetailViewModel(details, "Blue").match.winningTeam).toBe("A");
    expect(toMatchHistoryItem(record)?.result).toBe("win");
  });

  it.each([
    ["no teams", null], ["empty teams", []],
    ["one score", [{ teamId: "Blue", roundsWon: 13 }, { teamId: "Red" }]],
    ["one team", [{ teamId: "Blue", roundsWon: 13 }]],
    ["null scores", [{ teamId: "Blue", roundsWon: null }, { teamId: "Red", roundsWon: null }]],
    ["zero scores", [{ teamId: "Blue", roundsWon: 0 }, { teamId: "Red", roundsWon: 0 }]],
    ["unrecognized teams", [{ teamId: "Other", roundsWon: 13 }, { teamId: "Red", roundsWon: 10 }]],
  ])("does not invent a winner or draw for %s", (_name, teams) => {
    const details = matchDetails(teams);
    expect(buildMatchDetailViewModel(details, "Blue").match).toMatchObject({
      winningTeam: null, result: "unknown",
    });
    const record = buildMatchHistoryRecord(cachedRecord, details, "Blue");
    expect(record.stats).toMatchObject({ won: false, result: "unknown" });
    expect(toMatchHistoryItem(record)?.result).toBe("unknown");
  });

  it("uses complete scores when winner flags are absent", () => {
    const details = matchDetails([
      { teamId: "Blue", roundsWon: 10 }, { teamId: "Red", roundsWon: 13 },
    ]);
    expect(buildMatchDetailViewModel(details, "Blue").match).toMatchObject({
      winningTeam: "B", result: "loss",
    });
  });

  it("does not interpret an in-progress tie as a draw", () => {
    const details = matchDetails([
      { teamId: "Blue", won: false, roundsWon: 8 },
      { teamId: "Red", won: false, roundsWon: 8 },
    ], { isCompleted: false, completionState: "" });
    expect(buildMatchDetailViewModel(details, "Blue").match).toMatchObject({
      winningTeam: null, result: "unknown",
    });
  });

  it("honors a voted draw even if scores are incomplete", () => {
    const details = matchDetails(null, { completionState: "VoteDraw" });
    const record = buildMatchHistoryRecord(cachedRecord, details, "Blue");
    expect(toMatchHistoryItem(record)?.result).toBe("draw");
  });

  it.each(["Cancelled", "Aborted", "Remake"])("keeps %s neutral despite scores", (completionState) => {
    const details = matchDetails(undefined, { completionState });
    expect(buildMatchDetailViewModel(details, "Blue").match).toMatchObject({
      winningTeam: null, result: "cancelled",
    });
    expect(toMatchHistoryItem(buildMatchHistoryRecord(cachedRecord, details, "Blue"))?.result)
      .toBe("cancelled");
  });

  it("repairs legacy equal-score records with won=true as draws", () => {
    expect(toMatchHistoryItem({ ...cachedRecord, stats: {
      ...cachedRecord.stats!, won: true, roundsWon: 14, roundsLost: 14,
    } })?.result).toBe("draw");
  });

  it("does not label a legacy 0-0 cache record as a draw", () => {
    expect(toMatchHistoryItem({ ...cachedRecord, stats: {
      ...cachedRecord.stats!, won: true, roundsWon: 0, roundsLost: 0,
    } })?.result).toBe("unknown");
  });

  it("does not assign a result to a missing player", () => {
    expect(resolveMatchOutcome(matchDetails(), "absent")).toEqual({
      result: "unknown", winningTeam: "A",
    });
  });

  it("does not guess when both teams claim victory or both deny an unequal-score victory", () => {
    for (const won of [true, false]) {
      expect(resolveMatchOutcome(matchDetails([
        { teamId: "Blue", won, roundsWon: 13 },
        { teamId: "Red", won, roundsWon: 10 },
      ]), "Blue")).toEqual({ result: "unknown", winningTeam: null });
    }
  });

  it.each([-1, 1.5, Number.NaN, Infinity, "13"])("rejects invalid score %s", (roundsWon) => {
    expect(resolveMatchOutcome(matchDetails([
      { teamId: "Blue", roundsWon }, { teamId: "Red", roundsWon: 10 },
    ]), "Blue").result).toBe("unknown");
  });

  it("handles records without statistics", () => {
    expect(getMatchHistoryResult(null)).toBe("unknown");
    expect(getMatchHistoryResult(undefined)).toBe("unknown");
    expect(toMatchHistoryItem({ ...cachedRecord, stats: null })).toBeNull();
    expect(buildMatchHistoryRecord(cachedRecord, null, "Blue").stats).toBeNull();
    expect(buildMatchHistoryRecord(cachedRecord, matchDetails(), "absent").stats).toBeNull();
  });
});

describe("extracted match transformations", () => {
  it("does not turn absent RR fields into an earned zero", () => {
    const rank = compactRankUpdate({ RankedRatingEarned: null, AFKPenalty: "", TierAfterUpdate: false });
    expect(rank?.RankedRatingEarned).toBeUndefined();
    expect(rank?.AFKPenalty).toBeUndefined();
    expect(rank?.TierAfterUpdate).toBeUndefined();
    expect(compactRankUpdate(null)).toBeNull();
    expect(compactRankUpdate("invalid")).toBeNull();
    expect(compactRankUpdate({ RankedRatingEarned: 0, CompetitiveMovement: "PROMOTED" }))
      .toMatchObject({ RankedRatingEarned: 0, CompetitiveMovement: "PROMOTED" });
  });

  it("uses normalized agent metadata in details and player performance", () => {
    const model = buildMatchDetailViewModel(matchDetails(), "Blue");
    expect(model.players[0].agent.name).toBe("Test Agent");
    expect(model.playerPerformance.Blue.summary.agentName).toBe("Test Agent");
    expect(model.playerPerformance.Blue.opponents[0].opponentAgentName).toBe("Test Agent");
  });

  it("preserves combat, round events, weapon, and economy transformations", () => {
    const details = matchDetails();
    const kill = (killer: string, victim: string, roundTime: number) => ({
      killer, victim, roundTime, assistants: ["Blue"],
      finishingDamage: { damageItem: "weapon-id" },
      playerLocations: [{ subject: killer, location: { x: 300, y: 400 } }],
      victimLocation: { x: 0, y: 0 },
    });
    const rawRound = {
      roundNum: 0, winningTeam: "Blue", roundResult: "Eliminated", roundResultCode: "",
      bombPlanter: "Blue", plantRoundTime: 30000, bombDefuser: "Red", defuseRoundTime: 60000,
      playerStats: [
        { subject: "Blue", kills: [kill("Blue", "Red", 1000), kill("Blue", "Red2", 2000)],
          damage: [{ receiver: "Red", damage: 200, headshots: 2, bodyshots: 1, legshots: 1 }],
          economy: { spent: 1000, loadoutValue: 3000, remaining: 500, weapon: "weapon-id" } },
        { subject: "Red", kills: [kill("Red", "Blue", 5000)],
          damage: [{ receiver: "Blue", damage: 100, headshots: 1, bodyshots: 0, legshots: 0 }],
          economy: { spent: 2000, loadoutValue: 4000, remaining: 1000, weapon: "weapon-id" } },
      ],
    };
    const enriched = { ...details, roundResults: [rawRound],
      playerIdentities: [{ Subject: "Blue", GameName: "Sample", TagLine: "123" }],
    } as unknown as MatchDetailsData;
    const before = JSON.stringify(enriched);
    const model = buildMatchDetailViewModel(enriched, "Blue");
    expect(model.players[0]).toMatchObject({ playerName: "Sample#123", firstKills: 1, multiKills: 2,
      headshotPercent: 50, economyRating: 200 });
    expect(model.playerPerformance.Blue).toMatchObject({
      sideStats: { defense: { kills: 2, deaths: 1, assists: 3, kd: 2 } },
      opponents: [expect.objectContaining({ killsAgainst: 1, deathsAgainst: 1, damageDealt: 200, damageTaken: 100 })],
      weapons: [{ weaponId: "weapon-id", weaponName: "Vandal", weaponImageUrl: "weapon.png", kills: 2, damage: 200 }],
    });
    expect(model.economy[0]).toMatchObject({ teamAEconomy: 3000, teamBEconomy: 4000,
      teamASpent: 1000, teamBSpent: 2000, difference: -1000, winningTeam: "A" });
    expect(model.rounds[0]).toMatchObject({ roundNumber: 1, sideForTeamA: "defense", outcome: "elimination",
      teamAAverageLoadout: 3000, teamBAverageCredits: 1000 });
    expect(model.rounds[0].events.map((event) => event.type)).toEqual(["kill", "kill", "kill", "plant", "defuse", "round_end"]);
    expect(model.rounds[0].events[0]).toMatchObject({ distanceMeters: 5, timestampSeconds: 1 });
    expect(JSON.stringify(enriched)).toBe(before);
  });

  it.each([
    ["BombDefused", "spike_defused"], ["BombDetonated", "spike_detonated"],
    ["Eliminated", "elimination"], ["TimeExpired", "time_expired"],
    ["Surrendered", "surrender"], [undefined, "unknown"],
  ] as const)("retains round outcome %s", (raw, expected) => {
    expect(normalizeRoundOutcome(raw, undefined)).toBe(expected);
  });

  it("retains halftime and overtime side switching", () => {
    expect([0, 12, 24, 25].map(teamASideForRound)).toEqual(["defense", "attack", "defense", "attack"]);
    expect(sideForPlayer("A", 12)).toBe("attack");
    expect(sideForPlayer("B", 12)).toBe("defense");
  });

  it("groups days in reverse time order without mutating cached records", () => {
    const day1 = new Date(2026, 8, 13, 12).getTime();
    const day2 = new Date(2026, 8, 14, 12).getTime();
    const records = [
      { ...cachedRecord, MatchID: "older", GameStartTime: day1 },
      { ...cachedRecord, MatchID: "latest", GameStartTime: day2 + 1000 },
      { ...cachedRecord, MatchID: "same-day", GameStartTime: day2 },
      { ...cachedRecord, MatchID: "no-stats", GameStartTime: day2, stats: null },
    ];
    const before = JSON.stringify(records);
    const groups = buildMatchHistoryGroups(records, "en-US");
    expect(groups.map((group) => group.dateKey)).toEqual(["2026-09-14", "2026-09-13"]);
    expect(groups[0].matches.map((match) => match.id)).toEqual(["latest", "same-day"]);
    expect(groups[0].summary).toMatchObject({ matchCount: 2, averageKD: 1, averageACS: 100, averageADR: 100 });
    expect(JSON.stringify(records)).toBe(before);
    expect(buildMatchHistoryGroups([], "en-US")).toEqual([]);
  });
});
