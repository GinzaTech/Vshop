import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useProfileState } from "~/features/profile/useProfileState";
import { useProfileFetch } from "~/features/profile/useProfileFetch";
import { fetchCompetitiveRankOutcome, type ProfileWarmCache } from "~/utils/profile-cache";
import { ownedItems, playerLoadout, type PlayerLoadoutResponse } from "~/utils/valorant-api";
import { SessionChangedError } from "~/utils/session-operations";
import type { TFunction } from "i18next";
import { profileLoadoutRegistry } from "~/features/profile/profile-loadout-queue-registry";
import { getSessionGeneration, invalidateSessionOperations } from "~/utils/session-operations";
import { defaultUser } from "~/utils/valorant-user";
import type { PublicWeaponMetadata } from "~/services/valorant/public-api";
import { VItemTypes } from "~/utils/misc";

const mockUser = { ...defaultUser, id: "user", region: "ap", accessToken: "access", entitlementsToken: "entitlements", ownedSkinIds: ["skin"] };
let mockLiveUser = mockUser;
let mockCache: ProfileWarmCache;
let mockCacheFresh = true;
let mockHasRankCache = true;
const mockIdleTasks: (() => void)[] = [];
const mockIdleCancels: jest.Mock[] = [];
const mockGetPublicWeapons = jest.fn<Promise<PublicWeaponMetadata[]>, []>();
jest.mock("~/utils/valorant-api", () => ({
  playerLoadout: jest.fn(), ownedItems: jest.fn(), extractOwnedItemIds: (value: string[]) => value,
}));
jest.mock("~/utils/profile-cache", () => ({
  fetchCompetitiveRankOutcome: jest.fn(), PROFILE_LOADOUT_CACHE_VERSION: 5, PROFILE_RANK_CACHE_VERSION: 11,
  getSessionAuthKey: (user: typeof mockUser) => `${user.region}:${user.id}`, hasValidCompetitiveRankCache: () => mockHasRankCache, isProfileCacheFresh: () => mockCacheFresh,
}));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => ({ cacheByAuth: { [mockCache.authKey]: mockCache } }) } }));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockLiveUser }) } }));
jest.mock("~/utils/idle-task", () => ({ runWhenIdle: (callback: () => void) => {
  mockIdleTasks.push(callback);
  const cancel = jest.fn();
  mockIdleCancels.push(cancel);
  return { cancel };
} }));
jest.mock("~/mocks/profile-ui", () => ({ PROFILE_DEMO_RANK: null }));
jest.mock("~/services/valorant/public-api", () => ({
  getPublicWeapons: () => mockGetPublicWeapons(),
}));
jest.mock("~/utils/log-redaction", () => ({ sanitizeErrorForLog: () => ({ name: "Error" }) }));

const loadout: PlayerLoadoutResponse = {
  Subject: "user", Version: 1, SourceApiVersion: "v3", Guns: [], Sprays: [], ActiveExpressions: [],
  DynamicOptions: {}, Incognito: false,
  Identity: { PlayerCardID: "old", PlayerTitleID: "title", AccountLevel: 1, PreferredLevelBorderID: "border", HideAccountLevel: false },
};
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
  type HarnessProps = { hasAuth?: boolean; isProfileDemo?: boolean; snapshot?: PlayerLoadoutResponse | null; user?: typeof mockUser; cache?: ProfileWarmCache | null };
  function Harness({ hasAuth = true, isProfileDemo = false, cache = mockCache, snapshot = cache?.loadoutSnapshot ?? null, user = mockUser }: HarnessProps) {
    state = useProfileState({ cachedLoadoutSnapshot: snapshot, cachedProfile: cache,
      user, isProfileDemo, cachedCompetitiveRank: cache?.competitiveRank ?? null });
    actions = useProfileFetch({ ...state, hasAuth, user,
      cachedProfile: cache, cachedLoadoutSnapshot: snapshot,
      cachedCompetitiveRank: cache?.competitiveRank ?? null, authKey: `${user.region}:${user.id}`, isProfileDemo,
      setProfileCache, setUser, t, fetchMatches, fetchSeasonStats });
    return null;
  }
  async function remount(props: HarnessProps = {}) {
    act(() => renderer.unmount());
    await act(async () => { renderer = TestRenderer.create(<Harness {...props} />); });
  }

  beforeEach(async () => {
    profileLoadoutRegistry.clear();
    jest.clearAllMocks();
    mockLiveUser = mockUser;
    mockCacheFresh = true;
    mockHasRankCache = true;
    mockIdleTasks.length = 0;
    mockIdleCancels.length = 0;
    mockGetPublicWeapons.mockReset().mockResolvedValue([]);
    fetchMatches.mockReset().mockResolvedValue(undefined);
    fetchSeasonStats.mockReset().mockResolvedValue(undefined);
    mockCache = {
      authKey: "ap:user", loadoutSnapshot: loadout, loadoutCacheVersion: 5, competitiveRank: rank, rankCacheVersion: 11,
      ownedSkinItemIds: ["skin"], ownedSprayItemIds: ["spray"], ownedFlexItemIds: ["flex"],
      ownedPlayerCardItemIds: ["card"], ownedPlayerTitleItemIds: ["title"], updatedAt: 10,
      componentUpdatedAt: { loadout: 10, rank: 20, ownership: [30, 40, 50, 60, 70, 80] },
    };
    jest.mocked(playerLoadout).mockReset().mockResolvedValue(loadout);
    jest.mocked(ownedItems).mockReset().mockResolvedValue([] as never);
    jest.mocked(fetchCompetitiveRankOutcome).mockReset().mockResolvedValue({ status: "failure" });
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
    setProfileCache.mockClear();
    mockGetPublicWeapons.mockClear();
  });
  afterEach(() => {
    act(() => renderer.unmount()); profileLoadoutRegistry.clear();
    jest.useRealTimers(); jest.restoreAllMocks();
  });

  it("retains rank and owned items when their refreshes fail", async () => {
    jest.mocked(ownedItems).mockRejectedValue(new Error("offline"));
    await act(async () => { await actions.handleRefresh(); });
    expect(state.competitiveRank).toEqual(rank);
    expect(state.ownedSprayItemIds).toEqual(["spray"]);
    expect(mockCache.componentUpdatedAt?.rank).toBe(20);
    expect(mockCache.componentUpdatedAt?.ownership).toEqual([30, 40, 50, 60, 70, 80]);
    expect(state.refreshing).toBe(false);
  });

  it.each(["before", "after"] as const)("isolates a deferred A read from uncached B when A finishes %s B", async (oldFinishes) => {
    jest.useFakeTimers();
    const nextUser = { ...mockUser, id: "user-b", accessToken: "access-b", ownedSkinIds: [] };
    const nextLoadout = { ...loadout, Subject: nextUser.id, Identity: { ...loadout.Identity, PlayerCardID: "card-b" } };
    let finishA!: (value: PlayerLoadoutResponse) => void;
    let finishB!: (value: PlayerLoadoutResponse) => void;
    const cancelPicker = jest.fn();
    jest.mocked(playerLoadout).mockReturnValueOnce(new Promise((resolve) => { finishA = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { finishB = resolve; }));
    let oldRead!: Promise<void>;
    act(() => {
      state.setPickerState({ type: "player-card", options: [] });
      state.setIdentityPickerQuery("old query");
      state.setPickerLoading(true);
      state.setPickerError("old error");
      state.setUpdatingLoadout(true);
      state.pickerTaskRef.current = { cancel: cancelPicker };
      oldRead = actions.handleRefresh();
    });
    mockLiveUser = nextUser;
    await act(async () => { renderer.update(<Harness user={nextUser} cache={null} />); });
    expect(state.loadoutSnapshot).toBeNull();
    expect(state.loadoutSnapshotRef.current).toBeNull();
    expect(state.identity).toBeNull();
    expect([state.rawGuns, state.rawSprays, state.rawActiveExpressions]).toEqual([[], [], []]);
    expect([state.ownedSkinItemIds, state.ownedSprayItemIds, state.ownedFlexItemIds,
      state.ownedPlayerCardItemIds, state.ownedPlayerTitleItemIds]).toEqual([[], [], [], [], []]);
    expect(state.competitiveRank).toBeNull();
    expect(state.pickerState).toBeNull();
    expect(state.identityPickerQuery).toBe("");
    expect(state.pickerLoading).toBe(false);
    expect(state.pickerError).toBeNull();
    expect(state.updatingLoadout).toBe(false);
    expect(cancelPicker).toHaveBeenCalledTimes(1);
    expect(state.pickerTaskRef.current).toBeNull();
    expect(state.refreshing).toBe(false);
    expect(state.loading).toBe(true);
    act(() => { mockIdleTasks[mockIdleTasks.length - 1](); });
    await act(async () => { jest.advanceTimersByTime(260); });
    expect(jest.mocked(playerLoadout).mock.calls.map((call) => call[3])).toEqual(["user", "user-b"]);
    if (oldFinishes === "before") {
      await act(async () => { finishA(loadout); await oldRead; });
      expect(state.loading).toBe(true);
      expect(state.fetchLoadoutInFlightRef.current).toBe(true);
      expect(setProfileCache).not.toHaveBeenCalled();
    }
    await act(async () => { finishB(nextLoadout); });
    if (oldFinishes === "after") await act(async () => { finishA(loadout); await oldRead; });
    expect(state.loadoutSnapshot).toEqual(nextLoadout);
    expect(state.identity).toEqual(nextLoadout.Identity);
    expect(state.loading).toBe(false);
    expect(state.fetchLoadoutInFlightRef.current).toBe(false);
    expect(setProfileCache).toHaveBeenCalledTimes(1);
    expect(mockCache.authKey).toBe("ap:user-b");
    expect(jest.mocked(ownedItems).mock.calls.every((call) => call[3] === nextUser.id)).toBe(true);
  });

  it("keeps B's stats refresh spinner active when a retired A stats refresh finishes", async () => {
    const nextUser = { ...mockUser, id: "user-b", accessToken: "access-b", ownedSkinIds: [] };
    let finishA!: () => void;
    let finishB!: () => void;
    fetchSeasonStats.mockReturnValueOnce(new Promise<void>((resolve) => { finishA = resolve; }))
      .mockReturnValueOnce(new Promise<void>((resolve) => { finishB = resolve; }));
    let oldRefresh!: Promise<void>;
    act(() => { oldRefresh = actions.handleStatsRefresh(); });
    mockLiveUser = nextUser;
    await act(async () => { renderer.update(<Harness user={nextUser} cache={null} />); });
    expect(state.statsRefreshing).toBe(false);
    let newRefresh!: Promise<void>;
    act(() => { newRefresh = actions.handleStatsRefresh(); });
    expect(state.statsRefreshing).toBe(true);
    await act(async () => { finishA(); await oldRefresh; });
    expect(state.statsRefreshing).toBe(true);
    await act(async () => { finishB(); await newRefresh; });
    expect(state.statsRefreshing).toBe(false);
  });

  it.each(["accessToken", "entitlementsToken", "generation"] as const)(
    "starts a new cold read after %s changes without changing the account cache key", async (field) => {
      jest.useFakeTimers();
      let finishOld!: (value: PlayerLoadoutResponse) => void;
      jest.mocked(playerLoadout).mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
      await remount({ cache: null });
      act(() => { mockIdleTasks[mockIdleTasks.length - 1](); });
      await act(async () => { jest.advanceTimersByTime(260); });
      expect(playerLoadout).toHaveBeenCalledTimes(1);
      const nextUser = field === "generation" ? mockUser : { ...mockUser, [field]: "renewed" };
      if (field === "generation") invalidateSessionOperations();
      mockLiveUser = nextUser;
      await act(async () => { renderer.update(<Harness user={nextUser} cache={null} />); });
      expect(mockIdleTasks).toHaveLength(2);
      act(() => { mockIdleTasks[1](); });
      await act(async () => { jest.advanceTimersByTime(260); });
      expect(playerLoadout).toHaveBeenCalledTimes(2);
      expect(state.loadoutSnapshot).toEqual(loadout);
      await act(async () => { finishOld({ ...loadout, Identity: { ...loadout.Identity, PlayerCardID: "retired" } }); });
      expect(state.identity).toEqual(loadout.Identity);
      expect(setProfileCache).toHaveBeenCalledTimes(1);
    },
  );

  it("shows a recoverable cold loadout error and clears it after an explicit refresh succeeds", async () => {
    jest.useFakeTimers();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await remount({ cache: null });
    jest.mocked(playerLoadout).mockRejectedValueOnce(new Error("offline"));
    act(() => { mockIdleTasks[mockIdleTasks.length - 1](); });
    await act(async () => { jest.advanceTimersByTime(260); });
    expect(state.loadoutSnapshot).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBe("equip_page.error_loading");
    expect(playerLoadout).toHaveBeenCalledTimes(1);
    await act(async () => { await actions.handleRefresh(); });
    expect(jest.mocked(playerLoadout).mock.calls[1][4]?.force).toBe(true);
    expect(state.loadoutSnapshot).toEqual(loadout);
    expect(state.error).toBeNull();
    expect(state.refreshing).toBe(false);
  });

  it("keeps a warm snapshot usable without a blocking error after a rejected loadout refresh", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.mocked(playerLoadout).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await actions.handleRefresh(); });
    expect(state.loadoutSnapshot).toEqual(loadout);
    expect(state.identity).toEqual(loadout.Identity);
    expect(state.error).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.refreshing).toBe(false);
    expect(mockCache.componentUpdatedAt?.loadout).toBe(10);
  });

  it.each([{ snapshot: null, delay: 260 }, { snapshot: loadout, delay: 120 }])(
    "starts the initial read only after idle and the $delay ms delay",
    async ({ snapshot, delay }) => {
      jest.useFakeTimers();
      mockCacheFresh = false;
      await remount({ snapshot });
      expect(mockIdleTasks).toHaveLength(1);
      await act(async () => { jest.advanceTimersByTime(1000); });
      expect(playerLoadout).not.toHaveBeenCalled();
      act(() => { mockIdleTasks[0](); });
      await act(async () => { jest.advanceTimersByTime(delay - 1); });
      expect(playerLoadout).not.toHaveBeenCalled();
      await act(async () => { jest.advanceTimersByTime(1); });
      expect(playerLoadout).toHaveBeenCalledTimes(1);
      expect(jest.mocked(playerLoadout).mock.calls[0][4]?.force).toBe(false);
      expect(state.loadoutSnapshot).toEqual(loadout);
      expect(state.loading).toBe(false);
      expect(state.initialFetchTimeoutRef.current).toBeNull();
      await act(async () => { jest.runOnlyPendingTimers(); });
      expect(playerLoadout).toHaveBeenCalledTimes(1);
    },
  );

  it("fetches once when a fresh loadout has no valid rank cache", async () => {
    jest.useFakeTimers();
    mockHasRankCache = false;
    await remount();
    expect(state.rankRefreshAuthKeyRef.current).toBe("ap:user");
    act(() => { mockIdleTasks[0](); });
    await act(async () => { jest.advanceTimersByTime(120); });
    expect(fetchCompetitiveRankOutcome).toHaveBeenCalledTimes(1);
    await act(async () => { renderer.update(<Harness />); });
    expect(mockIdleTasks).toHaveLength(1);
  });

  it.each([false, true])("cancels initial work on unmount (timer armed: %s)", async (armed) => {
    jest.useFakeTimers();
    mockCacheFresh = false;
    await remount({ snapshot: null });
    if (armed) act(() => { mockIdleTasks[0](); });
    act(() => renderer.unmount());
    expect(mockIdleCancels[0]).toHaveBeenCalled();
    expect(state.initialFetchTaskRef.current).toBeNull();
    expect(state.initialFetchTimeoutRef.current).toBeNull();
    await act(async () => { jest.runOnlyPendingTimers(); });
    expect(playerLoadout).not.toHaveBeenCalled();
    expect(setProfileCache).not.toHaveBeenCalled();
  });

  it("clears visible profile and picker data when authentication is lost", async () => {
    act(() => {
      state.setPickerState({ type: "player-card", options: [] });
      state.setIdentityPickerQuery("card search");
      state.setPickerLoading(true);
      state.setPickerError("old failure");
    });
    await act(async () => { renderer.update(<Harness hasAuth={false} />); });
    expect(state.loadoutSnapshot).toBeNull();
    expect(state.identity).toBeNull();
    expect([state.rawGuns, state.rawSprays, state.rawActiveExpressions]).toEqual([[], [], []]);
    expect([state.ownedSkinItemIds, state.ownedSprayItemIds, state.ownedFlexItemIds,
      state.ownedPlayerCardItemIds, state.ownedPlayerTitleItemIds]).toEqual([[], [], [], [], []]);
    expect(state.competitiveRank).toBeNull();
    expect(state.pickerState).toBeNull();
    expect(state.identityPickerQuery).toBe("");
    expect(state.pickerLoading).toBe(false);
    expect(state.pickerError).toBeNull();
    expect(state.error).toBe("equip_page.missing_auth");
    expect(state.loading).toBe(false);
    await act(async () => {
      await actions.handleRefresh(); await actions.handleStatsRefresh(); await actions.handleSeasonChange("season");
    });
    expect(playerLoadout).not.toHaveBeenCalled();
    expect(fetchMatches).not.toHaveBeenCalled();
    expect(fetchSeasonStats).not.toHaveBeenCalled();
  });

  it("leaves a cold unauthenticated profile loading without scheduling a read", async () => {
    await remount({ hasAuth: false, snapshot: null });
    expect(state.loading).toBe(true);
    expect(state.error).toBe("equip_page.missing_auth");
    expect(mockIdleTasks).toHaveLength(0);
  });

  it("hydrates account ownership when the cached skin list is empty", async () => {
    mockCache = { ...mockCache, ownedSkinItemIds: [] };
    await act(async () => { renderer.update(<Harness />); });
    expect(state.ownedSkinItemIds).toEqual(mockUser.ownedSkinIds);
    expect(state.identity).toEqual(loadout.Identity);
    expect(state.ownedPlayerTitleItemIds).toEqual(["title"]);
    expect(mockIdleTasks).toHaveLength(0);
  });

  it("indexes public weapon metadata by UUID", async () => {
    const weapon = { uuid: "vandal", displayName: "Vandal", category: "rifle" };
    mockGetPublicWeapons.mockResolvedValueOnce([weapon]);
    await remount();
    expect(state.weaponMetadata).toEqual({ vandal: weapon });
  });

  it("keeps profile data usable when weapon metadata fails", async () => {
    const error = new Error("metadata offline");
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetPublicWeapons.mockRejectedValueOnce(error);
    await remount();
    expect(state.weaponMetadata).toEqual({});
    expect(state.loadoutSnapshot).toEqual(loadout);
    expect(state.loading).toBe(false);
    expect(log).toHaveBeenCalledWith({ name: "Error" });
  });

  it("ignores metadata that resolves after unmount", async () => {
    let finish!: (weapons: PublicWeaponMetadata[]) => void;
    mockGetPublicWeapons.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    await remount();
    act(() => renderer.unmount());
    await act(async () => { finish([{ uuid: "late", displayName: "Late", category: "rifle" }]); });
    expect(state.weaponMetadata).toEqual({});
    expect(setProfileCache).not.toHaveBeenCalled();
  });

  it("preserves the loadout but publishes successful ownership after a failed loadout read", async () => {
    const log = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.mocked(playerLoadout).mockRejectedValueOnce(new Error("offline"));
    jest.mocked(ownedItems).mockImplementation(async (_access, _entitlements, _region, _id, itemType) => {
      if (itemType === VItemTypes.PlayerCard) return ["new-card"] as never;
      if (itemType === VItemTypes.Spray) throw new Error("sprays offline");
      return [] as never;
    });
    await act(async () => { await actions.handleRefresh(); });
    expect(state.loadoutSnapshot).toEqual(loadout);
    expect(state.ownedPlayerCardItemIds).toEqual(["card", "new-card"]);
    expect(state.ownedSprayItemIds).toEqual(["spray"]);
    expect(mockCache.componentUpdatedAt?.loadout).toBe(10);
    expect(mockCache.componentUpdatedAt?.ownership[2]).toBe(50);
    expect(mockCache.componentUpdatedAt?.ownership[4]).toBeGreaterThan(70);
    expect(setProfileCache).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[profile] loadout unavailable", { name: "Error" });
  });

  it("releases refresh state when rank unexpectedly rejects", async () => {
    const log = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.mocked(fetchCompetitiveRankOutcome).mockRejectedValueOnce(new Error("rank offline"));
    await act(async () => { await actions.handleRefresh(); });
    expect(setProfileCache).not.toHaveBeenCalled();
    expect(state.competitiveRank).toEqual(rank);
    expect(state.refreshing).toBe(false);
    expect(state.fetchLoadoutInFlightRef.current).toBe(false);
    expect(log).toHaveBeenCalledWith("[profile] fetchLoadoutData failed", { name: "Error" });
  });

  it.each([true, false])("handles a pending loadout without a queue (server matches: %s)", async (matches) => {
    const pending = { ...loadout, Identity: { ...loadout.Identity, PlayerCardID: "pending" } };
    state.pendingLoadoutRef.current = { loadout: pending, updatedAt: Date.now() };
    jest.mocked(playerLoadout).mockResolvedValueOnce(matches ? pending : loadout);
    let finishOwnership!: () => void;
    jest.mocked(ownedItems).mockReturnValue(new Promise<Awaited<ReturnType<typeof ownedItems>>>((resolve) => {
      finishOwnership = () => resolve([] as never);
    }));
    let refresh!: Promise<void>;
    await act(async () => { refresh = actions.handleRefresh(); });
    // The read correctly preserves pending display before cache publication.
    expect(state.loadoutSnapshot).toEqual(pending);
    await act(async () => { finishOwnership(); await refresh; });
    expect(state.pendingLoadoutRef.current).toEqual(matches ? null : { loadout: pending, updatedAt: expect.any(Number) });
    expect(mockCache.loadoutSnapshot).toEqual(matches ? pending : loadout);
    if (matches) expect(mockCache.componentUpdatedAt?.loadout).toBeGreaterThan(10);
    else expect(mockCache.componentUpdatedAt?.loadout).toBe(10);
    // Regression: hydration must also preserve an unconfirmed pending choice.
    expect(state.loadoutSnapshot).toEqual(pending);
  });

  it.each(["accessToken", "entitlementsToken", "region", "id", "generation"] as const)(
    "drops an orphaned pending display when hydration moves to another %s",
    async (field) => {
      const pending = { ...loadout, Identity: { ...loadout.Identity, PlayerCardID: "pending-old-session" } };
      state.pendingLoadoutRef.current = { loadout: pending, updatedAt: Date.now() };
      const nextUser = field === "generation" ? mockUser : { ...mockUser, [field]: "next-session" };
      if (field === "generation") invalidateSessionOperations();
      const confirmed = { ...loadout, Subject: nextUser.id, Identity: { ...loadout.Identity, PlayerCardID: "confirmed-next-session" } };
      mockLiveUser = nextUser;
      mockCache = { ...mockCache, loadoutSnapshot: confirmed };
      await act(async () => { renderer.update(<Harness user={nextUser} snapshot={confirmed} />); });
      expect(state.pendingLoadoutRef.current).toBeNull();
      expect(state.loadoutSnapshot).toEqual(confirmed);
      expect(playerLoadout).not.toHaveBeenCalled();
    },
  );

  it("clears orphaned pending display on auth loss before a later hydration", async () => {
    state.pendingLoadoutRef.current = { loadout, updatedAt: Date.now() };
    await act(async () => { renderer.update(<Harness hasAuth={false} />); });
    expect(state.pendingLoadoutRef.current).toBeNull();
    expect(state.loadoutSnapshot).toBeNull();
  });

  it.each(["accessToken", "entitlementsToken", "region", "id"] as const)(
    "does not request profile data when the session ref lacks %s",
    async (field) => {
      state.sessionUserRef.current = { ...mockUser, [field]: "" };
      await act(async () => { await actions.handleRefresh(); });
      expect(playerLoadout).not.toHaveBeenCalled();
      expect(ownedItems).not.toHaveBeenCalled();
      expect(setProfileCache).not.toHaveBeenCalled();
      expect(state.refreshing).toBe(false);
    },
  );

  it("does not start an ordinary initial read while another read is in flight", async () => {
    jest.useFakeTimers();
    mockCacheFresh = false;
    await remount({ snapshot: null });
    state.fetchLoadoutInFlightRef.current = true;
    act(() => { mockIdleTasks[0](); });
    await act(async () => { jest.advanceTimersByTime(260); });
    expect(playerLoadout).not.toHaveBeenCalled();
    expect(state.loading).toBe(true);
  });

  it("does not publish a refresh that resolves after unmount", async () => {
    let finish!: (value: PlayerLoadoutResponse) => void;
    jest.mocked(playerLoadout).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    let refresh!: Promise<void>;
    act(() => { refresh = actions.handleRefresh(); });
    act(() => renderer.unmount());
    await act(async () => { finish(loadout); await refresh; });
    expect(ownedItems).not.toHaveBeenCalled();
    expect(setProfileCache).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it("holds the stats spinner until both reads complete", async () => {
    let finish!: () => void;
    fetchSeasonStats.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
    let refresh!: Promise<void>;
    act(() => { refresh = actions.handleStatsRefresh(); });
    expect(state.statsRefreshing).toBe(true);
    expect(fetchMatches).toHaveBeenCalledWith(mockUser, true);
    expect(fetchSeasonStats).toHaveBeenCalledWith(mockUser, true, undefined);
    await act(async () => { finish(); await refresh; });
    expect(state.statsRefreshing).toBe(false);
  });

  it.each(["matches", "season"])("propagates %s stats failure and releases the spinner", async (part) => {
    const error = new Error("stats offline");
    (part === "matches" ? fetchMatches : fetchSeasonStats).mockRejectedValueOnce(error);
    await act(async () => { await expect(actions.handleStatsRefresh("season")).rejects.toBe(error); });
    expect(state.statsRefreshing).toBe(false);
    expect(fetchMatches).toHaveBeenCalledTimes(1);
    expect(fetchSeasonStats).toHaveBeenCalledTimes(1);
  });

  it("propagates a failed season selection without enabling refresh", async () => {
    const error = new Error("season offline");
    fetchSeasonStats.mockRejectedValueOnce(error);
    await act(async () => { await expect(actions.handleSeasonChange("season")).rejects.toBe(error); });
    expect(fetchMatches).not.toHaveBeenCalled();
    expect(state.statsRefreshing).toBe(false);
  });

  it("keeps demo stats actions offline", async () => {
    await remount({ isProfileDemo: true });
    await act(async () => { await actions.handleStatsRefresh(); await actions.handleSeasonChange("season"); });
    expect(fetchMatches).not.toHaveBeenCalled();
    expect(fetchSeasonStats).not.toHaveBeenCalled();
    expect(state.statsRefreshing).toBe(false);
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
    const requestOptions = jest.mocked(playerLoadout).mock.calls[0][4];
    expect(requestOptions?.isCurrent?.()).toBe(false);
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

  it("does not expire an active queue after eight seconds or persist optimistic display during refresh/hydration", async () => {
    const base: PlayerLoadoutResponse = { Subject: "user", Version: 1, SourceApiVersion: "v3", Guns: [], Sprays: [], ActiveExpressions: [], DynamicOptions: {},
      Identity: { PlayerCardID: "old", PlayerTitleID: "title", AccountLevel: 1, PreferredLevelBorderID: "border", HideAccountLevel: false }, Incognito: false };
    let finish!: (value: PlayerLoadoutResponse) => void;
    const queue = profileLoadoutRegistry.acquire({ ...mockUser, generation: getSessionGeneration() }, { initial: base, isCurrent: () => true,
      write: () => new Promise((resolve) => { finish = resolve; }), read: async () => base, onConfirmed: jest.fn(), onError: jest.fn() })!;
    void queue.enqueue({ key: "card", apply: (server) => ({ ...server, Identity: { ...server.Identity, PlayerCardID: "pending" } }),
      matches: (server) => server.Identity.PlayerCardID === "pending" });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    state.pendingLoadoutRef.current = { loadout: queue.getSnapshot().display, updatedAt: Date.now() - 9000 };
    jest.mocked(playerLoadout).mockResolvedValue(base);
    await act(async () => { await actions.handleRefresh(); });
    expect(state.loadoutSnapshot?.Identity.PlayerCardID).toBe("pending");
    expect(mockCache.loadoutSnapshot?.Identity.PlayerCardID).toBe("old");
    expect(mockCache.componentUpdatedAt?.loadout).toBe(10);
    expect(state.pendingLoadoutRef.current).not.toBeNull();
    await act(async () => { finish({ ...queue.getSnapshot().display, Version: 4 }); await queue.whenIdle(); });
  });
  it.each([undefined, ["account-owned"]])("initializes a cold profile from only available account ownership (%s), without fabricating loadout fields", async (ownedSkinIds) => {
    act(() => renderer.unmount());
    function ColdHarness() {
      // Persisted legacy/cold data can omit entries despite the nominal Record/store types.
      const cold = { cachedLoadoutSnapshot: null, cachedProfile: null,
        user: { ...mockUser, ownedSkinIds }, isProfileDemo: false, cachedCompetitiveRank: null };
      state = useProfileState(cold as unknown as Parameters<typeof useProfileState>[0]);
      return null;
    }
    await act(async () => { renderer = TestRenderer.create(<ColdHarness />); });
    expect(state.loadoutSnapshot).toBeNull(); expect(state.identity).toBeNull(); expect(state.loading).toBe(true);
    expect(state.rawGuns).toEqual([]); expect(state.rawSprays).toEqual([]); expect(state.rawActiveExpressions).toEqual([]);
    expect(state.ownedSkinItemIds).toEqual(ownedSkinIds ?? []);
    expect(state.ownedSprayItemIds).toEqual([]); expect(state.ownedFlexItemIds).toEqual([]);
    expect(state.ownedPlayerCardItemIds).toEqual([]); expect(state.ownedPlayerTitleItemIds).toEqual([]);
    expect(state.pendingLoadoutRef.current).toBeNull();
  });
});
