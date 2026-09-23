import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useProfileState } from "~/features/profile/useProfileState";
import { useProfileFetch } from "~/features/profile/useProfileFetch";
import { fetchCompetitiveRankOutcome, type ProfileWarmCache } from "~/utils/profile-cache";
import { ownedItems, playerLoadout, type PlayerLoadoutResponse } from "~/utils/valorant-api";
import { SessionChangedError } from "~/utils/session-operations";
import type { TFunction } from "i18next";

const mockUser = { id: "user", region: "ap", accessToken: "access", entitlementsToken: "entitlements", ownedSkinIds: ["skin"] } as Parameters<typeof useProfileState>[0]["user"];
let mockLiveUser = mockUser;
let mockCache: ProfileWarmCache;
let mockCacheFresh = true;
const mockIdleTasks: (() => void)[] = [];
const mockGetPublicWeapons = jest.fn(async () => []);
jest.mock("~/utils/valorant-api", () => ({
  playerLoadout: jest.fn(), ownedItems: jest.fn(), extractOwnedItemIds: (value: string[]) => value,
}));
jest.mock("~/utils/profile-cache", () => ({
  fetchCompetitiveRankOutcome: jest.fn(), PROFILE_LOADOUT_CACHE_VERSION: 5, PROFILE_RANK_CACHE_VERSION: 11,
  getSessionAuthKey: () => "ap:user", hasValidCompetitiveRankCache: () => true, isProfileCacheFresh: () => mockCacheFresh,
}));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => ({ cacheByAuth: { "ap:user": mockCache } }) } }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockLiveUser }) } }));
jest.mock("~/utils/idle-task", () => ({ runWhenIdle: (callback: () => void) => {
  mockIdleTasks.push(callback);
  return { cancel: jest.fn() };
} }));
jest.mock("~/mocks/profile-ui", () => ({ PROFILE_DEMO_RANK: null }));
jest.mock("~/services/valorant/public-api", () => ({
  getPublicWeapons: () => mockGetPublicWeapons(),
}));
jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ name: "Error" }) }));

const loadout = { Guns: [], Sprays: [], ActiveExpressions: [], Identity: { PlayerCardID: "old" } } as unknown as PlayerLoadoutResponse;
const rank = { currentName: "Gold" } as ProfileWarmCache["competitiveRank"];
const t = ((key: string) => key) as TFunction;

describe("profile refresh hook", () => {
  let renderer: TestRenderer.ReactTestRenderer;
  let state: ReturnType<typeof useProfileState>;
  let actions: ReturnType<typeof useProfileFetch>;
  const setProfileCache = jest.fn((cache: ProfileWarmCache) => { mockCache = cache; });
  const setUser = jest.fn();
  const fetchMatches = jest.fn();
  const fetchSeasonStats = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLiveUser = mockUser;
    mockCacheFresh = true;
    mockIdleTasks.length = 0;
    mockCache = {
      authKey: "ap:user", loadoutSnapshot: loadout, loadoutCacheVersion: 5, competitiveRank: rank, rankCacheVersion: 11,
      ownedSkinItemIds: ["skin"], ownedSprayItemIds: ["spray"], ownedFlexItemIds: ["flex"],
      ownedPlayerCardItemIds: ["card"], ownedPlayerTitleItemIds: ["title"], updatedAt: 10,
      componentUpdatedAt: { loadout: 10, rank: 20, ownership: [30, 40, 50, 60, 70, 80] },
    };
    jest.mocked(playerLoadout).mockResolvedValue(loadout);
    jest.mocked(ownedItems).mockResolvedValue([] as never);
    jest.mocked(fetchCompetitiveRankOutcome).mockResolvedValue({ status: "failure" });
    function Harness() {
      state = useProfileState({ cachedLoadoutSnapshot: mockCache.loadoutSnapshot, cachedProfile: mockCache,
        user: mockUser, isProfileDemo: false, cachedCompetitiveRank: mockCache.competitiveRank });
      actions = useProfileFetch({ ...state, hasAuth: true, user: mockUser,
        cachedProfile: mockCache, cachedLoadoutSnapshot: mockCache.loadoutSnapshot,
        cachedCompetitiveRank: mockCache.competitiveRank, authKey: "ap:user", isProfileDemo: false,
        setProfileCache, setUser, t, fetchMatches, fetchSeasonStats });
      return null;
    }
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
    setProfileCache.mockClear();
    mockGetPublicWeapons.mockClear();
  });
  afterEach(() => { act(() => renderer.unmount()); });

  it("retains rank and owned items when their refreshes fail", async () => {
    jest.mocked(ownedItems).mockRejectedValue(new Error("offline"));
    await act(async () => { await actions.handleRefresh(); });
    expect(state.competitiveRank).toEqual(rank);
    expect(state.ownedSprayItemIds).toEqual(["spray"]);
    expect(mockCache.componentUpdatedAt?.rank).toBe(20);
    expect(mockCache.componentUpdatedAt?.ownership).toEqual([30, 40, 50, 60, 70, 80]);
    expect(state.refreshing).toBe(false);
  });

  it("clears stale rank after a confirmed unranked result", async () => {
    jest.mocked(fetchCompetitiveRankOutcome).mockResolvedValue({ status: "success", value: null });
    await act(async () => { await actions.handleRefresh(); });
    expect(state.competitiveRank).toBeNull();
    expect(mockCache.competitiveRank).toBeNull();
    expect(mockCache.componentUpdatedAt?.rank).toBeGreaterThan(20);
  });

  it.each(["loadout", "rank", "ownership"])("publishes no cache after %s session invalidation", async (part) => {
    const error = new SessionChangedError();
    if (part === "loadout") jest.mocked(playerLoadout).mockRejectedValue(error);
    else if (part === "rank") jest.mocked(fetchCompetitiveRankOutcome).mockRejectedValue(error);
    else jest.mocked(ownedItems).mockRejectedValue(error);
    await act(async () => { await actions.handleRefresh(); });
    expect(setProfileCache).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
    expect(state.refreshing).toBe(false);
  });

  it("ignores an older forced refresh that completes after a newer one", async () => {
    let finishOld!: (value: PlayerLoadoutResponse) => void;
    const old = new Promise<PlayerLoadoutResponse>((resolve) => { finishOld = resolve; });
    const latest = { ...loadout, Identity: { ...loadout.Identity, PlayerCardID: "latest" } };
    jest.mocked(playerLoadout).mockReturnValueOnce(old).mockResolvedValueOnce(latest);
    let first!: Promise<void>;
    act(() => { first = actions.handleRefresh(); });
    await act(async () => { await actions.handleRefresh(); });
    await act(async () => { finishOld(loadout); await first; });
    expect(mockCache.loadoutSnapshot?.Identity.PlayerCardID).toBe("latest");
    expect(state.loadoutSnapshot?.Identity.PlayerCardID).toBe("latest");
    expect(setProfileCache).toHaveBeenCalledTimes(1);
  });

  it("passes the selected season to refresh and season changes", async () => {
    await act(async () => { await actions.handleStatsRefresh("old-act"); });
    expect(fetchSeasonStats).toHaveBeenCalledWith(mockUser, true, "old-act");
    await act(async () => { await actions.handleSeasonChange("another-act"); });
    expect(fetchSeasonStats).toHaveBeenCalledWith(mockUser, false, "another-act");
  });

  it.each(["accessToken", "entitlementsToken"] as const)("discards a loadout response after only %s changes", async (credential) => {
    let finish!: (value: PlayerLoadoutResponse) => void;
    jest.mocked(playerLoadout).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    let refresh!: Promise<void>;
    act(() => { refresh = actions.handleRefresh(); });
    mockLiveUser = { ...mockUser, [credential]: "renewed" };
    await act(async () => {
      finish({ ...loadout, Identity: { ...loadout.Identity, PlayerCardID: "stale-response" } });
      await refresh;
    });
    expect(state.loadoutSnapshot).toEqual(loadout);
    expect(ownedItems).not.toHaveBeenCalled();
    expect(setProfileCache).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
    expect(state.refreshing).toBe(false);
  });

  it("does not automatically loop refreshes when partial failure leaves the cache stale", async () => {
    mockCacheFresh = false;
    await act(async () => { await actions.handleRefresh(); });
    expect(mockIdleTasks).toHaveLength(0);
    expect(playerLoadout).toHaveBeenCalledTimes(1);
  });

  it("keeps the development demo fully offline", async () => {
    act(() => renderer.unmount());
    function DemoHarness() {
      const demoState = useProfileState({
        cachedLoadoutSnapshot: loadout,
        cachedProfile: mockCache,
        user: mockUser,
        isProfileDemo: true,
        cachedCompetitiveRank: rank,
      });
      useProfileFetch({
        ...demoState,
        hasAuth: false,
        user: mockUser,
        cachedProfile: mockCache,
        cachedLoadoutSnapshot: loadout,
        cachedCompetitiveRank: rank,
        authKey: "demo",
        isProfileDemo: true,
        setProfileCache,
        setUser,
        t,
        fetchMatches,
        fetchSeasonStats,
      });
      return null;
    }

    await act(async () => {
      renderer = TestRenderer.create(<DemoHarness />);
    });

    expect(mockGetPublicWeapons).not.toHaveBeenCalled();
    expect(playerLoadout).not.toHaveBeenCalled();
    expect(ownedItems).not.toHaveBeenCalled();
  });
});
