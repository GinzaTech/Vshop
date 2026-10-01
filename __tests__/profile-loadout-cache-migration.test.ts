import {
  hasValidCompetitiveRankCache,
  hasValidProfileLoadoutCache,
  PROFILE_LOADOUT_CACHE_VERSION,
  type ProfileWarmCache,
} from "~/utils/profile-cache";
import { buildProfileRefreshCache } from "~/features/profile/profile-refresh-data";
import {
  cacheUpdatedLoadout,
  clearCachedLoadout,
  getCachedPlayerLoadout,
} from "~/services/riot/loadout-cache";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";

// Keep cache validation/reconciliation real while isolating native storage and APIs.
jest.mock("~/utils/valorant-api", () => ({}));
jest.mock("~/hooks/useProfileCacheStore", () => ({
  useProfileCacheStore: { getState: () => ({ cacheByAuth: {} }) },
}));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ competitiveTiers: [] }) }));
jest.mock("~/services/riot/request-context", () => ({
  getPlayerResourceKey: (region: string, id: string) => `${region}|${id}`,
}));

const serverLoadout = (): PlayerLoadoutResponse => ({
  Subject: "migration-player", Version: 42, SourceApiVersion: "v3",
  Guns: [], Sprays: [], ActiveExpressions: [], DynamicOptions: {}, Incognito: false,
  Identity: {
    PlayerCardID: "server-card", PlayerTitleID: "title", AccountLevel: 10,
    PreferredLevelBorderID: "border", HideAccountLevel: false,
  },
});

// HEAD's legacy selection persisted a local card with the server Version unchanged.
const legacyCache = (): ProfileWarmCache => {
  const server = serverLoadout();
  return {
    authKey: "ap|migration-player", loadoutCacheVersion: 5,
    loadoutSnapshot: { ...server, Identity: { ...server.Identity, PlayerCardID: "optimistic-card" } },
    rankCacheVersion: 11,
    competitiveRank: {
      currentTier: 12, currentName: "Gold 1", currentIcon: null,
      peakTier: 15, peakName: "Platinum 1", peakIcon: null,
      actSeasonId: "season", actWins: 10, actLosses: 5, actGames: 15,
    },
    ownedSkinItemIds: ["skin"], ownedSprayItemIds: ["spray"], ownedFlexItemIds: ["flex"],
    ownedPlayerCardItemIds: ["server-card", "optimistic-card"], ownedPlayerTitleItemIds: ["title"],
    componentUpdatedAt: { loadout: 100, rank: 200, ownership: [300, 400, 500, 600, 700, 800] },
    updatedAt: 100,
  };
};

describe("profile loadout cache schema migration", () => {
  beforeEach(() => clearCachedLoadout());
  afterEach(() => clearCachedLoadout());

  it("rejects persisted schema 5 optimistic selection as initial loadout authority", () => {
    const legacy = legacyCache();
    expect(legacy.loadoutSnapshot?.Version).toBe(serverLoadout().Version);
    expect(legacy.loadoutSnapshot?.Identity.PlayerCardID).toBe("optimistic-card");
    expect(hasValidProfileLoadoutCache(legacy)).toBe(false);
  });

  it("retains rank, ownership, and all timestamps when refreshing an excluded legacy loadout fails", () => {
    const legacy = legacyCache();
    const before = JSON.stringify(legacy);
    expect(hasValidProfileLoadoutCache(legacy)).toBe(false);
    expect(hasValidCompetitiveRankCache(legacy)).toBe(true);
    const next = buildProfileRefreshCache({
      authKey: legacy.authKey, previous: legacy, loadoutSnapshot: null,
      rankOutcome: { status: "failure" }, ownedSkinIds: [], now: 1_000,
      ownership: Array.from({ length: 6 }, (): PromiseSettledResult<string[]> => ({
        status: "rejected", reason: new Error("offline"),
      })),
    });
    expect(next).toEqual(legacy);
    expect(hasValidProfileLoadoutCache(next)).toBe(false);
    expect(hasValidCompetitiveRankCache(next)).toBe(true);
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it("accepts a current-schema GET snapshot and refreshes only its loadout age", () => {
    const legacy = legacyCache();
    const server = serverLoadout();
    const next = buildProfileRefreshCache({
      authKey: legacy.authKey, previous: legacy, loadoutSnapshot: server,
      rankOutcome: { status: "failure" }, ownedSkinIds: [], now: 1_000,
      ownership: Array.from({ length: 6 }, (): PromiseSettledResult<string[]> => ({
        status: "rejected", reason: new Error("offline"),
      })),
    });
    expect(PROFILE_LOADOUT_CACHE_VERSION).toBe(6);
    expect(next).toEqual({
      ...legacy, loadoutSnapshot: server, loadoutCacheVersion: PROFILE_LOADOUT_CACHE_VERSION,
      componentUpdatedAt: { ...legacy.componentUpdatedAt, loadout: 1_000 }, updatedAt: 200,
    });
    expect(hasValidProfileLoadoutCache(next)).toBe(true);
    expect(hasValidProfileLoadoutCache({ ...next, loadoutSnapshot: null })).toBe(false);
  });

  it("accepts same-Version GET authority with different selection when legacy initial is excluded", async () => {
    const legacy = legacyCache();
    const server = serverLoadout();
    // Model the validity gate used before seeding initial authority.
    if (hasValidProfileLoadoutCache(legacy) && legacy.loadoutSnapshot) {
      cacheUpdatedLoadout("ap", server.Subject, legacy.loadoutSnapshot);
    }
    const get = jest.fn(async () => server);
    const result = await getCachedPlayerLoadout(
      "test-token", "test-entitlements", "ap", server.Subject, { force: true }, get,
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toEqual(server);
    expect(result?.Version).toBe(legacy.loadoutSnapshot?.Version);
    expect(result?.Identity.PlayerCardID).toBe("server-card");
    expect(await getCachedPlayerLoadout(
      "test-token", "test-entitlements", "ap", server.Subject, {}, get,
    )).toEqual(server);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
