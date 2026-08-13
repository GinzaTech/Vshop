import type { MatchHistoryRecord } from "~/types/match-ui";
import {
  createMatchAssetCatalog,
  enrichMatchHistoryAssets,
} from "~/utils/match-ui";

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
    weapons: [],
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
