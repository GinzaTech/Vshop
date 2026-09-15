import { buildProfileRefreshCache, updateProfileLoadoutCache } from "~/features/profile/profile-refresh-data";
import type { ProfileWarmCache } from "~/utils/profile-cache";
import { SessionChangedError } from "~/utils/session-operations";
import type { PlayerLoadoutResponse } from "~/utils/valorant-api";

jest.mock("~/utils/profile-cache", () => ({
  PROFILE_LOADOUT_CACHE_VERSION: 5, PROFILE_RANK_CACHE_VERSION: 11,
}));

const loadout = { Guns: [], Sprays: [], Identity: { PlayerCardID: "card" } } as unknown as PlayerLoadoutResponse;
const previous: ProfileWarmCache = {
  authKey: "ap:user", loadoutSnapshot: loadout, loadoutCacheVersion: 4,
  competitiveRank: { currentName: "Gold" } as ProfileWarmCache["competitiveRank"], rankCacheVersion: 10,
  ownedSkinItemIds: ["skin"], ownedSprayItemIds: ["spray"], ownedFlexItemIds: ["flex"],
  ownedPlayerCardItemIds: ["card"], ownedPlayerTitleItemIds: ["title"],
  componentUpdatedAt: { loadout: 10, rank: 20, ownership: [30, 40, 50, 60, 70, 80] }, updatedAt: 10,
};
const success = (value: string[]): PromiseSettledResult<string[]> => ({ status: "fulfilled", value });
const failure: PromiseSettledResult<string[]> = { status: "rejected", reason: new Error("offline") };
const options = {
  authKey: previous.authKey, previous, loadoutSnapshot: loadout, rankOutcome: { status: "failure" } as const,
  ownership: Array.from({ length: 6 }, () => failure), ownedSkinIds: ["store-skin"], now: 100,
};

describe("profile refresh cache reconciliation", () => {
  it("preserves failed rank and ownership components and their successful timestamps", () => {
    const before = JSON.stringify(previous);
    const next = buildProfileRefreshCache(options);
    expect(next).toMatchObject({ competitiveRank: previous.competitiveRank, rankCacheVersion: 10,
      ownedSkinItemIds: ["skin", "store-skin"], ownedSprayItemIds: ["spray"], ownedFlexItemIds: ["flex"],
      ownedPlayerCardItemIds: ["card"], ownedPlayerTitleItemIds: ["title"],
      componentUpdatedAt: { loadout: 100, rank: 20, ownership: [30, 40, 50, 60, 70, 80] }, updatedAt: 20 });
    expect(JSON.stringify(previous)).toBe(before);
  });
  it("treats confirmed unranked as success and only freshens successful ownership categories", () => {
    const next = buildProfileRefreshCache({ ...options, rankOutcome: { status: "success", value: null },
      ownership: [success(["level"]), success(["chroma"]), failure, success(["new-flex"]), failure, failure] });
    expect(next).toMatchObject({ competitiveRank: null, rankCacheVersion: 11,
      ownedSkinItemIds: ["skin", "store-skin", "level", "chroma"], ownedFlexItemIds: ["flex", "new-flex"],
      componentUpdatedAt: { loadout: 100, rank: 100, ownership: [100, 100, 50, 100, 70, 80] }, updatedAt: 50 });
  });
  it("never gives initial failures a schema version or a fresh timestamp", () => {
    const next = buildProfileRefreshCache({ ...options, previous: null, loadoutSnapshot: null });
    expect(next.rankCacheVersion).toBeUndefined();
    expect(next.loadoutCacheVersion).toBeUndefined();
    expect(next.updatedAt).toBe(0);
    expect(next.componentUpdatedAt).toEqual({ loadout: 0, rank: 0, ownership: [0, 0, 0, 0, 0, 0] });
  });
  it("keeps legacy components conservatively stale until each succeeds", () => {
    const next = buildProfileRefreshCache({ ...options, previous: { ...previous, componentUpdatedAt: undefined } });
    expect(next.updatedAt).toBe(0);
    expect(next.componentUpdatedAt?.rank).toBe(0);
  });
  it("becomes fresh only after every component succeeds", () => {
    const next = buildProfileRefreshCache({ ...options, rankOutcome: { status: "success", value: null },
      ownership: Array.from({ length: 6 }, () => success([])) });
    expect(next.updatedAt).toBe(100);
  });
  it("propagates session invalidation in ownership results", () => {
    const reason = new SessionChangedError();
    expect(() => buildProfileRefreshCache({ ...options, ownership: [{ status: "rejected", reason }] })).toThrow(reason);
  });
  it("does not stamp optimistic loadout changes or unrelated rank/ownership data as fresh", () => {
    const optimistic = updateProfileLoadoutCache(previous, loadout);
    expect(optimistic.componentUpdatedAt).toEqual(previous.componentUpdatedAt);
    expect(optimistic.updatedAt).toBe(10);
    const confirmed = updateProfileLoadoutCache(previous, loadout, 100);
    expect(confirmed.componentUpdatedAt).toEqual({ ...previous.componentUpdatedAt, loadout: 100 });
    expect(confirmed.updatedAt).toBe(20);
  });
});
