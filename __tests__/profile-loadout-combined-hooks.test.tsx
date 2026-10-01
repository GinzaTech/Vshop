import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { TFunction } from "i18next";
import { useProfileState } from "~/features/profile/useProfileState";
import { useProfileFetch } from "~/features/profile/useProfileFetch";
import { useProfileMutations } from "~/features/profile/useProfileMutations";
import { profileLoadoutRegistry } from "~/features/profile/profile-loadout-queue-registry";
import { defaultUser } from "~/utils/valorant-user";
import { getSessionGeneration, invalidateSessionOperations } from "~/utils/session-operations";
import { hasValidProfileLoadoutCache, PROFILE_LOADOUT_CACHE_VERSION, PROFILE_RANK_CACHE_VERSION, type ProfileWarmCache } from "~/utils/profile-cache";
import type { PlayerLoadoutResponse } from "~/services/riot/api-types";

const mockRead = jest.fn();
const mockWrite = jest.fn();
const mockOwned = jest.fn();
const mockRank = jest.fn();
let mockIdleTask: (() => void) | null = null;
let mockUser = { ...defaultUser, id: "self", region: "ap", accessToken: "access", entitlementsToken: "ent", ownedSkinIds: ["owned-skin"] };
let mockCache: ProfileWarmCache | null = null;
const mockCacheListeners = new Set<() => void>();
const mockSetCache = jest.fn((cache: ProfileWarmCache) => {
  mockCache = cache;
  mockCacheListeners.forEach((listener) => listener());
});
const subscribeCache = (listener: () => void) => { mockCacheListeners.add(listener); return () => { mockCacheListeners.delete(listener); }; };
const getCache = () => mockCache;

jest.mock("~/utils/valorant-api", () => ({
  playerLoadout: (...args: unknown[]) => mockRead(...args),
  updatePlayerLoadoutV3First: (...args: unknown[]) => mockWrite(...args),
  ownedItems: (...args: unknown[]) => mockOwned(...args),
  extractOwnedItemIds: (value: string[]) => value,
}));
jest.mock("~/utils/profile-cache", () => ({
  ...jest.requireActual<typeof import("~/utils/profile-cache")>("~/utils/profile-cache"),
  fetchCompetitiveRankOutcome: (...args: unknown[]) => mockRank(...args),
}));
jest.mock("~/hooks/useUserStore", () => ({ useUserStore: { getState: () => ({ user: mockUser }) } }));
jest.mock("~/hooks/useProfileCacheStore", () => ({ useProfileCacheStore: { getState: () => ({
  cacheByAuth: mockCache ? { "ap|self": mockCache } : {}, setProfileCache: mockSetCache,
}) } }));
jest.mock("~/utils/idle-task", () => ({ runWhenIdle: (task: () => void) => { mockIdleTask = task; return { cancel: jest.fn() }; } }));
jest.mock("~/utils/valorant-assets", () => ({ getAssets: () => ({ competitiveTiers: [] }) }));
jest.mock("~/services/valorant/public-api", () => ({ getPublicWeapons: async () => [] }));
jest.mock("~/mocks/profile-ui", () => ({ PROFILE_DEMO_RANK: null }));

function loadout(version = 1, card = "old-card"): PlayerLoadoutResponse {
  return { Subject: "self", Version: version, SourceApiVersion: "v3", Guns: [], Sprays: [], ActiveExpressions: [],
    DynamicOptions: { keep: true }, Incognito: false,
    Identity: { PlayerCardID: card, PlayerTitleID: "old-title", AccountLevel: 1, PreferredLevelBorderID: "border", HideAccountLevel: false } };
}
function warmCache(snapshot = loadout()): ProfileWarmCache {
  const now = Date.now();
  return { authKey: "ap|self", loadoutSnapshot: snapshot, loadoutCacheVersion: PROFILE_LOADOUT_CACHE_VERSION,
    competitiveRank: null, rankCacheVersion: PROFILE_RANK_CACHE_VERSION, ownedSkinItemIds: ["owned-skin"],
    ownedSprayItemIds: ["owned-spray"], ownedFlexItemIds: ["owned-flex"], ownedPlayerCardItemIds: ["owned-card"],
    ownedPlayerTitleItemIds: ["owned-title"], componentUpdatedAt: { loadout: now, rank: now, ownership: Array(6).fill(now) }, updatedAt: now };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
async function flush() { for (let index = 0; index < 30; index++) await Promise.resolve(); }

describe("Profile fetch and mutation authority together", () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  let state: ReturnType<typeof useProfileState>;
  let fetch: ReturnType<typeof useProfileFetch>;
  let mutations: ReturnType<typeof useProfileMutations>;
  const noop = jest.fn();
  const t = ((key: string) => key) as TFunction;
  const queue = () => profileLoadoutRegistry.peek({ ...mockUser, generation: getSessionGeneration() })!;
  function Harness() {
    const cache = React.useSyncExternalStore(subscribeCache, getCache, getCache);
    const cachedLoadoutSnapshot = hasValidProfileLoadoutCache(cache) ? cache!.loadoutSnapshot : null;
    state = useProfileState({ cachedLoadoutSnapshot, cachedProfile: cache!, user: mockUser, isProfileDemo: false, cachedCompetitiveRank: null });
    fetch = useProfileFetch({ ...state, user: mockUser, hasAuth: true, cachedProfile: cache!, cachedLoadoutSnapshot,
      cachedCompetitiveRank: null, authKey: "ap|self", isProfileDemo: false, setProfileCache: mockSetCache,
      setUser: noop, fetchMatches: noop, fetchSeasonStats: noop, t });
    mutations = useProfileMutations({ ...state, ...fetch, user: mockUser, hasAuth: true, authKey: "ap|self",
      cachedProfile: cache!, cachedCompetitiveRank: null, setProfileCache: mockSetCache, handleDismissPicker: noop,
      showLoadoutUpdateError: noop, handleOpenWeaponPicker: noop, loadoutDetails: [], buildOwnedSkinOptions: () => [], t });
    return null;
  }
  const mount = async () => { await act(async () => { renderer = TestRenderer.create(<Harness />); }); };
  beforeEach(() => {
    profileLoadoutRegistry.clear(); mockCacheListeners.clear(); jest.clearAllMocks();
    mockUser = { ...defaultUser, id: "self", region: "ap", accessToken: "access", entitlementsToken: "ent", ownedSkinIds: ["owned-skin"] };
    mockCache = null; mockIdleTask = null;
    mockRead.mockReset().mockResolvedValue(loadout());
    mockWrite.mockReset().mockImplementation(async (...args: unknown[]) => ({ ...(args[4] as PlayerLoadoutResponse), Version: 2 }));
    mockOwned.mockReset().mockResolvedValue([]);
    mockRank.mockReset().mockResolvedValue({ status: "success", value: null });
  });
  afterEach(() => { if (renderer) act(() => renderer!.unmount()); renderer = undefined; profileLoadoutRegistry.clear(); jest.restoreAllMocks(); });

  async function startColdRefresh() {
    const ownership = deferred<string[]>(); mockOwned.mockReturnValue(ownership.promise);
    await mount();
    let refreshing!: Promise<void>;
    await act(async () => { refreshing = fetch.handleRefresh(); await flush(); });
    expect(state.loadoutSnapshot?.Version).toBe(1);
    expect(mockSetCache).not.toHaveBeenCalled();
    return { ownership, refreshing };
  }
  it("persists the first server GET when ownership finishes after queue initialization", async () => {
    const { ownership, refreshing } = await startColdRefresh();
    expect(state.loadoutMutationVersionRef.current).toBe(0);
    await act(async () => { ownership.resolve(["owned"]); await refreshing; });
    expect(mockCache?.loadoutSnapshot).toEqual(loadout());
    expect(mockCache?.componentUpdatedAt?.loadout).toBeGreaterThan(0);
    expect(state.updatingLoadout).toBe(false);
  });
  it("persists ACK Version 2 before cold ownership completes, never the newer pending display", async () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(1_000);
    const { ownership, refreshing } = await startColdRefresh();
    await act(async () => { await mutations.handleEquipIdentity("player-card", "ack-card"); await queue().whenIdle(); });
    expect(mockCache?.loadoutSnapshot).toEqual(loadout(2, "ack-card"));
    expect(mockCache?.componentUpdatedAt?.rank).toBe(0);
    expect(mockCache?.componentUpdatedAt?.ownership).toEqual(Array(6).fill(0));
    const blocked = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(blocked.promise);
    let pending!: Promise<boolean>;
    await act(async () => { pending = mutations.handleEquipIdentity("player-title", "pending-title"); await flush(); });
    expect(state.identity?.PlayerTitleID).toBe("pending-title");
    clock.mockReturnValue(100_000);
    await act(async () => { ownership.resolve([]); await refreshing; });
    expect(mockCache?.loadoutSnapshot).toMatchObject({ Version: 2, Identity: { PlayerCardID: "ack-card", PlayerTitleID: "old-title" } });
    expect(state.identity?.PlayerTitleID).toBe("pending-title");
    expect(mockCache?.componentUpdatedAt?.loadout).toBe(1_000);
    await act(async () => { blocked.resolve({ ...loadout(3, "ack-card"), Identity: { ...loadout().Identity, PlayerCardID: "ack-card", PlayerTitleID: "pending-title" } }); await pending; await queue().whenIdle(); });
    expect(mockCache?.loadoutSnapshot?.Version).toBe(3);
  });
  it("retains only server authority when a cold GET is followed by an unacknowledged choice", async () => {
    const { ownership, refreshing } = await startColdRefresh();
    const blocked = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(blocked.promise);
    let pending!: Promise<boolean>;
    await act(async () => { pending = mutations.handleEquipIdentity("player-card", "pending-card"); await flush(); });
    await act(async () => { ownership.resolve([]); await refreshing; });
    expect(mockCache?.loadoutSnapshot).toEqual(loadout());
    expect(state.identity?.PlayerCardID).toBe("pending-card");
    await act(async () => { blocked.resolve(loadout(2, "pending-card")); await pending; await queue().whenIdle(); });
  });
  it.each(["accessToken", "entitlementsToken"] as const)("automatically reconciles renewed %s without a selection or manual refresh", async (credential) => {
    mockCache = warmCache(); await mount();
    const fresh = loadout(8, "external-card"); const read = deferred<PlayerLoadoutResponse>(); mockRead.mockReturnValueOnce(read.promise);
    mockCache = warmCache(fresh); mockUser = { ...mockUser, [credential]: "renewed" };
    await act(async () => { renderer!.update(<Harness />); await flush(); });
    expect(state.loadoutSnapshot?.Version).toBe(8);
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(mockRead.mock.calls[0][4]).toMatchObject({ force: true });
    expect(mockWrite).not.toHaveBeenCalled();
    await act(async () => { read.resolve(fresh); await queue().whenIdle(); });
    expect(state.identity?.PlayerCardID).toBe("external-card");
    expect(state.updatingLoadout).toBe(false);
    expect(state.pendingLoadoutRef.current).toBeNull();
  });
  it("waits for the old PUT before auto-reconciliation and never replays its unsent choices", async () => {
    mockCache = warmCache(); await mount();
    const oldWrite = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(oldWrite.promise);
    let oldAction!: Promise<boolean>;
    await act(async () => { oldAction = mutations.handleEquipIdentity("player-card", "old-session-card"); await flush(); });
    act(() => { void mutations.handleEquipIdentity("player-title", "old-unsent-title"); });
    mockUser = { ...mockUser, accessToken: "renewed" }; const reconciled = loadout(4, "server-card"); mockRead.mockResolvedValue(reconciled);
    await act(async () => { renderer!.update(<Harness />); await flush(); });
    expect(mockRead).not.toHaveBeenCalled(); expect(mockWrite).toHaveBeenCalledTimes(1);
    await act(async () => { oldWrite.resolve(loadout(3, "old-session-card")); await queue().whenIdle(); });
    expect(await oldAction).toBe(false);
    expect(mockRead).toHaveBeenCalledTimes(1); expect(mockWrite).toHaveBeenCalledTimes(1);
    expect(state.loadoutSnapshot).toEqual(reconciled);
    expect(state.updatingLoadout).toBe(false);
  });
  it("reconciles after logout retirement without carrying old intents into the next generation", async () => {
    mockCache = warmCache(); await mount();
    const oldWrite = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(oldWrite.promise);
    await act(async () => { void mutations.handleEquipIdentity("player-card", "old-session-card"); await flush(); });
    act(() => { void mutations.handleEquipIdentity("player-title", "old-unsent-title"); });
    invalidateSessionOperations(); profileLoadoutRegistry.retire(); mockCache = warmCache();
    mockRead.mockResolvedValue(loadout(3));
    await act(async () => { renderer!.update(<Harness />); await flush(); });
    expect(mockRead).not.toHaveBeenCalled();
    await act(async () => { oldWrite.resolve(loadout(2, "old-session-card")); await queue().whenIdle(); });
    expect(mockWrite).toHaveBeenCalledTimes(1); expect(mockRead).toHaveBeenCalledTimes(1);
    expect(state.identity).toEqual(loadout().Identity); expect(state.updatingLoadout).toBe(false);
  });
  it("excludes legacy optimistic hydration and accepts the true GET at the same server Version", async () => {
    const legacy = warmCache(loadout(1, "unconfirmed-legacy-card"));
    mockCache = { ...legacy, loadoutCacheVersion: 5 };
    mockRank.mockResolvedValue({ status: "failure" }); mockOwned.mockRejectedValue(new Error("offline"));
    await mount();
    expect(state.loadoutSnapshot).toBeNull();
    expect(profileLoadoutRegistry.peek({ ...mockUser, generation: getSessionGeneration() })).toBeNull();
    await act(async () => { await fetch.handleRefresh(); });
    expect(state.identity?.PlayerCardID).toBe("old-card");
    expect(mockCache?.loadoutSnapshot).toEqual(loadout());
    expect(mockCache?.loadoutCacheVersion).toBe(PROFILE_LOADOUT_CACHE_VERSION);
    expect(mockCache?.componentUpdatedAt?.rank).toBe(legacy.componentUpdatedAt?.rank);
    expect(mockCache?.componentUpdatedAt?.ownership).toEqual(legacy.componentUpdatedAt?.ownership);
    expect(mockCache?.ownedFlexItemIds).toEqual(legacy.ownedFlexItemIds);
  });
  it("does not renew confirmed cache age when an existing queue's refresh fails", async () => {
    mockCache = warmCache(); const before = mockCache.componentUpdatedAt?.loadout;
    mockRead.mockResolvedValue(null); await mount();
    await act(async () => { await fetch.handleRefresh(); });
    expect(mockCache?.loadoutSnapshot).toEqual(loadout());
    expect(mockCache?.componentUpdatedAt?.loadout).toBe(before);
    expect(mockWrite).not.toHaveBeenCalled();
  });
  it("recovers an uncertain replacement from a successful refresh GET after reconciliation fails", async () => {
    mockCache = warmCache(); await mount(); mockRead.mockResolvedValueOnce(null);
    mockUser = { ...mockUser, accessToken: "renewed" };
    await act(async () => { renderer!.update(<Harness />); await flush(); });
    await act(async () => { await queue().whenIdle(); });
    expect(queue().getSnapshot().uncertain).toBe(true);
    const server = loadout(5, "server-card");
    mockRead.mockResolvedValueOnce(null).mockResolvedValueOnce(server);
    await act(async () => { await fetch.handleRefresh(); await queue().whenIdle(); });
    expect(mockRead).toHaveBeenCalledTimes(3); expect(mockWrite).not.toHaveBeenCalled();
    expect(state.loadoutSnapshot).toEqual(server);
    expect(mockCache?.loadoutSnapshot).toEqual(server);
    expect(queue().getSnapshot()).toMatchObject({ uncertain: false, pending: false });
    expect(state.updatingLoadout).toBe(false);
  });
  it("never reconciles an ambiguous PUT from a non-forced cached initial fetch", async () => {
    mockCache = { ...warmCache(), updatedAt: 0, componentUpdatedAt: { loadout: 0, rank: 0, ownership: Array(6).fill(0) } };
    await mount();
    expect(mockIdleTask).not.toBeNull();
    mockWrite.mockRejectedValueOnce(new Error("lost receipt"));
    mockRead.mockResolvedValueOnce(null);
    await act(async () => { await mutations.handleEquipIdentity("player-card", "pending-card"); await queue().whenIdle(); });
    expect(queue().getSnapshot().uncertain).toBe(true);
    mockRead.mockResolvedValue(loadout());
    jest.useFakeTimers();
    try {
      await act(async () => { mockIdleTask!(); await jest.advanceTimersByTimeAsync(260); await flush(); });
      expect(mockRead.mock.calls.at(-1)?.[4]).toMatchObject({ force: false });
      expect(queue().getSnapshot()).toMatchObject({ uncertain: true, pending: true });
      expect(state.identity?.PlayerCardID).toBe("pending-card");
      expect(mockWrite).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });
  it("uses refresh authority to settle an ambiguous batch and rebase only the later authorized field", async () => {
    mockCache = warmCache(); await mount();
    const failed = deferred<PlayerLoadoutResponse>(); mockWrite.mockReturnValueOnce(failed.promise);
    mockRead.mockResolvedValueOnce(null);
    let first!: Promise<boolean>; let later!: Promise<boolean>;
    await act(async () => { first = mutations.handleEquipIdentity("player-card", "ambiguous-card"); await flush(); });
    act(() => { later = mutations.handleEquipIdentity("player-title", "later-title"); });
    await act(async () => { failed.reject(new Error("timeout")); await queue().whenIdle(); });
    expect(await first).toBe(false); expect(await later).toBe(false);
    mockRead.mockResolvedValueOnce(null).mockResolvedValueOnce(loadout(5));
    mockWrite.mockImplementationOnce(async (...args: unknown[]) => ({ ...(args[4] as PlayerLoadoutResponse), Version: 6 }));
    await act(async () => { await fetch.handleRefresh(); await queue().whenIdle(); });
    expect(mockWrite).toHaveBeenCalledTimes(2);
    expect(mockWrite.mock.calls[1][4]).toMatchObject({ Version: 5, Identity: { PlayerCardID: "old-card", PlayerTitleID: "later-title" } });
    expect(state.identity?.PlayerCardID).toBe("old-card");
    expect(mockCache?.loadoutSnapshot).toMatchObject({ Version: 6, Identity: { PlayerTitleID: "later-title" } });
    expect(state.updatingLoadout).toBe(false);
  });
});
